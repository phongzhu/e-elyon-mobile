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

const BASE_SYSTEM_PROMPT = `
You are an AI Christian counseling companion inside a church app (EECM).
Your job: listen, comfort, and guide with faith-based encouragement.

Rules:
- Be warm, empathetic, and non-judgmental.
- Provide 1-2 Bible verse references max (avoid long quotes).
- Offer simple practical next steps (prayer prompt, reflection question, healthy action).
- Do not provide medical/legal/professional directives.
- If the user mentions self-harm, suicide, or immediate danger:
  - Encourage immediate help (Philippines: call 911).
  - Encourage contacting trusted people/pastor right away.
- End with one gentle question to continue the conversation.

Behavior guidance:
- If this is the first message in a conversation, start with the "Counseling Starter" template.
- If the user's issue matches a pattern (anxiety/overthinking, grief/loss, guilt/shame,
  relationship conflict, or burnout), use the matching structure below.
- Keep tone kind, humble, and conversational. Avoid long paragraphs.
`.trim();

const COUNSELING_TEMPLATES = `
Counseling Starter (Tagalog - default):
Kumusta. Salamat sa pag-share. Nandito ako para makinig at magbigay ng mahinahong encouragement na may Bible verses.

Para mas matulungan kita:
Ano ang pinaka-mabigat sa’yo ngayon?
Gaano na katagal ‘to?
Ano ang kailangan mo today—comfort, guidance, o prayer?

Paalala: Hindi ito kapalit ng professional o pastoral care. Kung may panganib ka sa sarili/iba,
mag-reach out agad sa trusted person o emergency services.

Sample: Anxiety / Overthinking:
Naiintindihan ko—kapag sobrang daming iniisip, parang ang bigat huminga.
Subukan natin ito ngayon: inhale 4 seconds, hold 2, exhale 6 (3 times).
Tapos tanong ko: Ano ang specific na kinakatakutan mo—worst-case scenario?
At ano ang pinaka-likely na mangyayari kung magiging realistic tayo?
Verse: “Huwag kayong mabalisa…” (Philippians 4:6–7).
Pwede ba kitang samahan sa maikling prayer?
“Lord, bigyan Mo po siya ng kapayapaan at linaw ng isip. Palitan Mo ang takot ng tiwala sa Iyo. Amen.”

Sample: Grief / Loss:
Ang sakit mawalan—at okay lang umiyak. Hindi weakness ang pagdadalamhati; normal ‘yan kapag may minahal kang nawala.
Ano yung pinaka-miss mo sa kanya/sa nangyari?
Verse: “Malapit ang Panginoon sa mga may bagbag na puso…” (Psalm 34:18).
Kung okay sa’yo, pwede mong i-share isang memory na gusto mong alalahanin.

Sample: Guilt / Shame:
Salamat sa honesty. Yung guilt minsan reminder na may kailangang itama—pero yung shame sinasabi na “wala na akong kwenta.”
Ano ang nagawa/nangyari?
Ano ang maaari mong ayusin today (kahit 1 step lang)?
Verse: “Kung ipinahahayag natin ang ating mga kasalanan…” (1 John 1:9).
Practical step: simple apology plan: (1) acknowledge, (2) take responsibility, (3) make amends,
(4) set boundary para di maulit.

Sample: Relationship Conflict:
Mukhang mabigat yung tension. Bago tayo mag-decide, linawin natin:
Ano ang nangyari—facts lang muna (walang interpretation)?
Ano ang naramdaman mo at bakit?
Ano ang gusto mong outcome—peace, clarity, apology, boundary?
Verse: “Maging mabilis sa pakikinig, mabagal sa pagsasalita at sa galit.” (James 1:19)
Pwede kitang tulungan gumawa ng message na calm at respectful.

Sample: Burnout / Pagod na Pagod:
Sobrang nakakapagod kapag parang ikaw lagi ang kailangang tumayo.
Quick check: 0–10, gaano kabigat pakiramdam mo today?
Ano yung isang bagay na nagde-drain at isang bagay na nagbibigay lakas?
Verse: “Lumapit kayo sa Akin… at kayo’y aking pagpapahingahin.” (Matthew 11:28)
Micro-step ngayon: pumili ng isa—15-min rest, water/meal, short walk, o message sa trusted person.

Closing template:
Salamat sa pag-open up. Bago tayo magtapos, pili tayo ng 1 small step na gagawin mo within 24 hours.
Gusto mo bang i-summarize ko yung napag-usapan natin at gumawa ng simple action plan + short prayer?
`.trim();

type ReqBody = {
  message?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  conversation_id?: string;
  language?: "English" | "Tagalog";
  bible_version?: string;
};

function safeParseDescription(
  desc: string | null,
): { role: "user" | "assistant"; text: string } | null {
  if (!desc) return null;
  try {
    const p = JSON.parse(desc);
    const role = p?.role === "user" ? "user" : "assistant";
    const text = String(p?.text ?? "").trim();
    if (!text) return null;
    return { role, text };
  } catch {
    const text = String(desc).trim();
    if (!text) return null;
    return { role: "assistant", text };
  }
}

function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const out = data?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        const t = content.find((c: any) => c?.type === "output_text")?.text;
        if (typeof t === "string" && t.trim()) return t.trim();
      }
    }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => null)) as ReqBody | null;
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const incoming =
      String(body.message ?? "").trim() ||
      (Array.isArray(body.messages)
        ? String(
            [...body.messages]
              .reverse()
              .find((m) => m?.role === "user")?.content ?? "",
          ).trim()
        : "");

    if (!incoming) return json({ error: "message is required" }, 400);

    const conversationId =
      typeof body.conversation_id === "string" && body.conversation_id.trim()
        ? body.conversation_id.trim()
        : crypto.randomUUID();
    const language = body.language === "Tagalog" ? "Tagalog" : "English";
    const bibleVersion =
      typeof body.bible_version === "string" && body.bible_version.trim()
        ? body.bible_version.trim()
        : language === "Tagalog"
          ? "ASND"
          : "NIV";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnon) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user?.id) return json({ error: "Unauthorized" }, 401);

    const { data: appUser, error: appUserErr } = await supabase
      .from("users")
      .select("user_id, role, users_details:users_details (branch_id)")
      .eq("auth_user_id", authData.user.id)
      .eq("role", "member")
      .maybeSingle();

    if (appUserErr || !appUser?.user_id) {
      return json({ error: "App user not found" }, 404);
    }

    const userId = Number(appUser.user_id);
    const branchId = Array.isArray(appUser?.users_details)
      ? appUser.users_details?.[0]?.branch_id ?? null
      : appUser?.users_details?.branch_id ?? null;

    const HISTORY_LIMIT = 60;
    const { data: historyRows, error: histErr } = await supabase
      .from("counseling_requests")
      .select("message, description, requested_at")
      .eq("user_id", userId)
      .eq("type", "AI")
      .eq("conversation_id", conversationId)
      .order("requested_at", { ascending: true })
      .limit(HISTORY_LIMIT);

    if (histErr) {
      console.error("History load error:", histErr);
    }

    const historyMessages =
      (historyRows ?? [])
        .map((r: any) => {
          if (r?.message && typeof r.message === "object") {
            const role = r.message?.role === "user" ? "user" : "assistant";
            const text = String(r.message?.text ?? "").trim();
            return text ? { role, content: text } : null;
          }
          const parsed = safeParseDescription(r.description);
          return parsed ? { role: parsed.role, content: parsed.text } : null;
        })
        .filter(Boolean)
        .slice(-40) as Array<{ role: "user" | "assistant"; content: string }>;

    let memorySummary = "";
    const { data: memRow } = await supabase
      .from("counseling_ai_memory")
      .select("summary")
      .eq("user_id", userId)
      .maybeSingle();

    if (memRow?.summary) memorySummary = String(memRow.summary).trim();

    const localePrompt =
      language === "Tagalog"
        ? `Respond ONLY in Tagalog. Use Bible verse references in ${bibleVersion}. Do not mix languages.`
        : `Respond ONLY in English. Use Bible verse references in ${bibleVersion}. Do not mix languages.`;
    const firstTurn = historyMessages.length === 0;
    const systemPrompt = [
      BASE_SYSTEM_PROMPT,
      localePrompt,
      `First turn: ${firstTurn ? "YES" : "NO"}`,
      `Language override: ignore any prior language in history if it conflicts with the selected language.`,
      `Guidance templates (use when relevant; do not quote verbatim unless it fits):\n${COUNSELING_TEMPLATES}`,
      memorySummary
        ? `User memory (private summary; use gently):\n${memorySummary}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "Missing OPENAI_API_KEY secret" }, 500);

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const input = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: incoming },
    ];

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 380,
      }),
    });

    const oaiData = await resp.json().catch(() => null);
    if (!resp.ok) {
      console.error("OpenAI error:", oaiData);
      return json({ error: "OpenAI request failed", details: oaiData }, 500);
    }

    const reply =
      extractOutputText(oaiData) ||
      "I'm here with you. Can you share a little more about what you're feeling right now?";

    const userPayload = {
      user_id: userId,
      branch_id: branchId != null ? Number(branchId) : null,
      type: "AI",
      message: { role: "user", text: incoming },
      description: JSON.stringify({ role: "user", text: incoming }),
      status: "Completed",
      conversation_id: conversationId,
    };

    const aiPayload = {
      user_id: userId,
      branch_id: branchId != null ? Number(branchId) : null,
      type: "AI",
      message: { role: "assistant", text: reply },
      description: JSON.stringify({ role: "assistant", text: reply }),
      status: "Completed",
      conversation_id: conversationId,
    };

    const { error: insUserErr } = await supabase
      .from("counseling_requests")
      .insert(userPayload);
    if (insUserErr) console.error("Insert user chat failed:", insUserErr);

    const { error: insAiErr } = await supabase
      .from("counseling_requests")
      .insert(aiPayload);
    if (insAiErr) console.error("Insert ai chat failed:", insAiErr);

    const UPDATE_MEMORY = (Deno.env.get("UPDATE_COUNSELING_MEMORY") || "true") === "true";

    if (UPDATE_MEMORY) {
      const memPrompt = `
Update the user's memory summary for future counseling. Keep it short (max 8 lines).
Include: tone/communication style, recurring topics, spiritual preferences, what helps, what to avoid.
Do NOT include personal identifiers.
Existing summary:
${memorySummary || "(none)"}

New messages:
User: ${incoming}
Assistant: ${reply}

Return ONLY the updated summary text.
`.trim();

      const memResp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [{ role: "system", content: memPrompt }],
          max_output_tokens: 160,
        }),
      });

      const memData = await memResp.json().catch(() => null);
      const newSummary = memResp.ok ? extractOutputText(memData) : "";

      if (newSummary && newSummary.trim()) {
        await supabase
          .from("counseling_ai_memory")
          .upsert(
            {
              user_id: userId,
              summary: newSummary.trim(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
      }
    }

    return json({ reply, conversation_id: conversationId }, 200);
  } catch (e) {
    console.error("ai_counselor error:", e);
    return json(
      { error: "Internal server error", details: String((e as any)?.message ?? e) },
      500,
    );
  }
});
