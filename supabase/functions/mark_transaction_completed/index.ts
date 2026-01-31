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

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true }, 200);
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        500,
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { transaction_id?: number }
      | null;
    const txId = Number(body?.transaction_id);
    if (!Number.isFinite(txId) || txId <= 0) {
      return json({ error: "transaction_id is required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { error } = await admin
      .from("transactions")
      .update({ status: "completed" })
      .eq("transaction_id", txId);

    if (error) return json({ error: "update failed", details: error }, 500);
    return json({ ok: true, transaction_id: txId, status: "completed" });
  } catch (e) {
    return json({ error: "Unexpected error", message: String(e) }, 500);
  }
});
