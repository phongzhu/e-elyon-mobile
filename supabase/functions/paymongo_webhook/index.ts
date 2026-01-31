import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, paymongo-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parsePaymongoSignature(headerValue: string | null) {
  if (!headerValue) return null;
  const parts = headerValue.split(",").map((p) => p.trim());
  const kv = new Map<string, string>();
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k && v) kv.set(k, v);
  }
  return {
    t: kv.get("t") ?? null,
    te: kv.get("te") ?? null,
    li: kv.get("li") ?? null,
  };
}

async function hmacSha256Hex(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true }, 200);
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const WEBHOOK_SECRET = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        500,
      );
    }
    if (!WEBHOOK_SECRET) {
      return json({ error: "Missing PAYMONGO_WEBHOOK_SECRET" }, 500);
    }

    const rawBody = await req.text();
    const sigHeader = req.headers.get("Paymongo-Signature") ||
      req.headers.get("paymongo-signature");
    const sig = parsePaymongoSignature(sigHeader);

    if (!sig?.t) {
      return json({ error: "Missing Paymongo-Signature header" }, 401);
    }

    const signedPayload = `${sig.t}.${rawBody}`;
    const computed = await hmacSha256Hex(WEBHOOK_SECRET, signedPayload);

    const matchesTest = sig.te && computed === sig.te;
    const matchesLive = sig.li && computed === sig.li;
    if (!matchesTest && !matchesLive) {
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type as string | undefined;
    const resource = event?.data?.attributes?.data;

    const metadata = resource?.attributes?.metadata ?? {};
    const txId =
      metadata?.transaction_id ??
      metadata?.transactionId ??
      metadata?.tx_id ??
      null;

    if (!txId) {
      return json({ ok: true, ignored: "missing transaction_id in metadata" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    let newStatus: string | null = null;
    if (eventType === "checkout_session.payment.paid" || eventType === "payment.paid") {
      newStatus = "completed";
    } else if (eventType === "payment.failed") {
      newStatus = "failed";
    }

    if (!newStatus) {
      return json({ ok: true, ignored: `event ${eventType}` });
    }

    const { error: updErr } = await admin
      .from("transactions")
      .update({ status: newStatus })
      .eq("transaction_id", Number(txId));

    if (updErr) {
      return json({ error: "update failed", details: updErr }, 500);
    }

    return json({ ok: true, updated: txId, status: newStatus });
  } catch (e) {
    console.error("❌ webhook error:", e);
    return json({ error: "Unexpected error", message: String(e) }, 500);
  }
});
