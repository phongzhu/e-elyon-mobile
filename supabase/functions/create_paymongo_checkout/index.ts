/* eslint-disable import/no-unresolved */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type NotesMode = "anonymous" | "family" | "individual";

type Payload = {
  amount_php: number;
  wallet?: string;
  donor_note_key?: NotesMode;
  donor_note_label?: string;
  message?: string;
  payment_method_types?: string[];
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, unknown>;
};

function toCentavos(amountPhp: number) {
  return Math.round(Number(amountPhp) * 100);
}

function pickNotesMode(p: Payload): NotesMode {
  const v = (p.donor_note_key ?? "individual") as NotesMode;
  return v === "anonymous" || v === "family" || v === "individual"
    ? v
    : "individual";
}

function safeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isHttps(urlStr: string) {
  try {
    const u = new URL(urlStr);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedInsecureUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    if (u.protocol === "http:") {
      return u.hostname === "localhost" || u.hostname === "127.0.0.1";
    }
    return u.protocol === "exp:" || u.protocol === "expo:";
  } catch {
    return false;
  }
}

function normalizeReturnUrl(
  raw: string,
  webBase: string | null,
  allowInsecure: boolean,
) {
  // If already HTTPS (or allowed insecure), keep it
  if (isHttps(raw) || (allowInsecure && isAllowedInsecureUrl(raw))) return raw;

  if (webBase) {
    try {
      const incoming = new URL(raw);
      const base = new URL(webBase);
      base.pathname = incoming.pathname;
      base.search = incoming.search;
      return base.toString();
    } catch {
      // Fall through to error
    }
  }

  return null;
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true }, 200);
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const PAYMONGO_SK = Deno.env.get("PAYMONGO_SECRET_KEY");
    const WEB_BASE_URL =
      Deno.env.get("WEB_BASE_URL") || Deno.env.get("SITE_URL");
    const ALLOW_INSECURE_RETURN_URLS =
      Deno.env.get("ALLOW_INSECURE_RETURN_URLS") === "true";

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        500,
      );
    }
    if (!PAYMONGO_SK) {
      return json({ error: "Missing PAYMONGO_SECRET_KEY" }, 500);
    }

    const body = (await req.json().catch(() => null)) as Payload | null;
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const amountPhp = Number(body.amount_php);
    if (!Number.isFinite(amountPhp) || amountPhp <= 0) {
      return json({ error: "amount_php must be > 0" }, 400);
    }
    if (!body.success_url || !body.cancel_url) {
      return json({ error: "success_url and cancel_url are required" }, 400);
    }

    const normalizedSuccess = normalizeReturnUrl(
      body.success_url,
      WEB_BASE_URL,
      ALLOW_INSECURE_RETURN_URLS,
    );
    const normalizedCancel = normalizeReturnUrl(
      body.cancel_url,
      WEB_BASE_URL,
      ALLOW_INSECURE_RETURN_URLS,
    );

    if (!normalizedSuccess || !normalizedCancel) {
      return json(
        {
          error:
            "success_url and cancel_url must be HTTPS. Provide WEB_BASE_URL or SITE_URL for mobile redirects, or set ALLOW_INSECURE_RETURN_URLS=true for localhost/Expo dev.",
        },
        400,
      );
    }

    const paymentMethodTypes = body.payment_method_types?.length
      ? body.payment_method_types
      : ["gcash"];

    const notesMode = pickNotesMode(body);

    const meta = body.metadata ?? {};
    const createdBy = safeNum((meta as any).app_user_id);
    const branchId = safeNum((meta as any).branch_id);

    if (!createdBy) {
      return json(
        {
          error:
            "Missing metadata.app_user_id (must be BIGINT public.users.user_id, not auth UUID).",
        },
        400,
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const insertWithColumnFallback = async (
      table: string,
      payload: Record<string, unknown>,
      selectCols: string,
    ) => {
      let current = { ...payload };
      for (let i = 0; i < 5; i += 1) {
        const res = await admin
          .from(table)
          .insert(current)
          .select(selectCols)
          .single();
        if (!res.error) return res;
        const msg = res.error.message || "";
        const match = msg.match(/'([^']+)' column/);
        const missingCol = match?.[1];
        if (
          missingCol &&
          Object.prototype.hasOwnProperty.call(current, missingCol)
        ) {
          delete current[missingCol as keyof typeof current];
          continue;
        }
        return res;
      }
      return await admin
        .from(table)
        .insert(current)
        .select(selectCols)
        .single();
    };

    const notesParts: string[] = [];
    if (body.donor_note_label)
      notesParts.push(`Note: ${body.donor_note_label}`);
    else notesParts.push(`Note: ${notesMode}`);
    if (body.wallet) notesParts.push(`Wallet: ${String(body.wallet)}`);
    if (body.message?.trim())
      notesParts.push(`Message: ${body.message.trim()}`);

    const notesText = notesParts.join(" | ");
    const transactionType =
      (body.wallet ?? "").toString().trim() ||
      paymentMethodTypes[0] ||
      "paymongo";

    const donorId = notesMode === "anonymous" ? null : createdBy;

    const donationPayloadBase: Record<string, unknown> = {
      donor_id: donorId,
      account_id: null,
      is_anonymous: notesMode === "anonymous",
      amount: amountPhp,
      donation_date: new Date().toISOString(),
      notes: notesText,
    };

    const donationPayload: Record<string, unknown> =
      branchId != null
        ? { ...donationPayloadBase, branch_id: branchId }
        : donationPayloadBase;

    const donationInsert = await insertWithColumnFallback(
      "donations",
      donationPayload,
      "donation_id",
    );
    const { data: donationRow, error: donationErr } = donationInsert;

    if (donationErr || !donationRow?.donation_id) {
      console.error("❌ donations insert failed:", donationErr);
      return json(
        {
          error: "Failed to create donation",
          details: donationErr?.message ?? donationErr,
        },
        500,
      );
    }

    const donationId = donationRow.donation_id as number;

    const txPayloadBase: Record<string, unknown> = {
      account_id: null,
      transaction_type: transactionType,
      expense_id: null,
      transfer_id: null,
      release_id: null,
      donation_id: donationId,
      amount: amountPhp,
      status: "pending",
      notes: notesText,
      created_by: createdBy,
      transaction_date: new Date().toISOString(),
      updated_at: null,
    };

    const txPayload: Record<string, unknown> =
      branchId != null
        ? { ...txPayloadBase, branch_id: branchId }
        : txPayloadBase;

    const txInsert = await insertWithColumnFallback(
      "transactions",
      txPayload,
      "transaction_id",
    );
    const { data: txRow, error: txErr } = txInsert;

    if (txErr || !txRow?.transaction_id) {
      console.error("❌ transactions insert failed:", txErr);
      await admin.from("donations").delete().eq("donation_id", donationId);
      return json(
        {
          error: "Failed to create transaction",
          details: txErr?.message ?? txErr,
        },
        500,
      );
    }

    const transactionId = txRow.transaction_id as number;

    const auth = "Basic " + btoa(`${PAYMONGO_SK}:`);

    const description = "Church Giving";
    const itemName = "Donation";

    const successUrl = new URL(normalizedSuccess);
    successUrl.searchParams.set("transaction_id", String(transactionId));
    successUrl.searchParams.set("donation_id", String(donationId));

    const cancelUrl = new URL(normalizedCancel);
    cancelUrl.searchParams.set("transaction_id", String(transactionId));
    cancelUrl.searchParams.set("donation_id", String(donationId));

    const pmRes = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method_types: paymentMethodTypes,
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description,
            line_items: [
              {
                currency: "PHP",
                amount: toCentavos(amountPhp),
                name: itemName,
                quantity: 1,
                description,
              },
            ],
            success_url: successUrl.toString(),
            cancel_url: cancelUrl.toString(),
            metadata: {
              transaction_id: String(transactionId),
              donation_id: String(donationId),
              donor_note_key: notesMode,
              wallet: body.wallet ?? null,
              ...meta,
            },
          },
        },
      }),
    });

    const pmJson = await pmRes.json().catch(() => ({}));

    if (!pmRes.ok) {
      console.error("❌ PayMongo error:", pmRes.status, pmJson);

      await admin
        .from("transactions")
        .update({ status: "failed" })
        .eq("transaction_id", transactionId);

      return json(
        {
          error: "PayMongo error",
          status: pmRes.status,
          details: pmJson,
          transaction_id: transactionId,
          donation_id: donationId,
        },
        502,
      );
    }

    const checkoutSessionId = pmJson?.data?.id as string | undefined;
    const checkoutUrl = pmJson?.data?.attributes?.checkout_url as
      | string
      | undefined;

    if (!checkoutSessionId || !checkoutUrl) {
      console.error("❌ PayMongo missing session id/url:", pmJson);

      await admin
        .from("transactions")
        .update({ status: "failed" })
        .eq("transaction_id", transactionId);

      return json(
        {
          error: "Missing checkout session id/url from PayMongo",
          transaction_id: transactionId,
          donation_id: donationId,
          raw: pmJson,
        },
        502,
      );
    }

    const { error: updErr } = await admin
      .from("transactions")
      .update({
        reference_id: checkoutSessionId,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    if (updErr) {
      console.error("⚠️ transactions update failed (refence_id):", updErr);
    }

    return json({
      checkout_url: checkoutUrl,
      checkout_session_id: checkoutSessionId,
      transaction_id: transactionId,
      donation_id: donationId,
    });
  } catch (e) {
    console.error("❌ Unexpected error:", e);
    return json({ error: "Unexpected error", message: String(e) }, 500);
  }
});
