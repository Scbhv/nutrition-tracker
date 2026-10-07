import { createResponsesCall } from "../_shared/responses.ts";
import { getLovableAiGatewayResponseHeaders } from "../_shared/run-id.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200, extra?: Headers) => {
  const headers = getLovableAiGatewayResponseHeaders(extra, cors);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
};

const SYSTEM = `You are a practical nutrition coach. You receive a user's recent daily food log (averaged nutrient intake per day, plus the foods eaten) and their daily goals.
Identify the most meaningful nutrient gaps (intake clearly below goal) and any notable excesses. For each gap, suggest 2-3 practical, everyday foods with a realistic portion and the approximate amount of the nutrient it adds.
Prefer foods similar to what the user already eats. Keep it short and friendly. Use Markdown with these sections: "## Summary" (2 sentences), "## Biggest gaps", "## Watch out for" (only if relevant), "## Easy additions" (a short shopping list).
At most 5 gaps. No medical claims; suggest seeing a professional only if something looks extreme. Write in the same language as the food names when obvious, otherwise English.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured." }, 500);

  let payload: { days?: number; averages?: Record<string, number>; goals?: Record<string, number>; foods?: string[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!payload?.averages || !payload?.goals || !payload.days) {
    return json({ error: "Food log and goals are required." }, 400);
  }
  const data = JSON.stringify({
    days: payload.days,
    averageIntakePerDay: payload.averages,
    dailyGoals: payload.goals,
    foodsEaten: (payload.foods ?? []).slice(0, 80),
  }).slice(0, 20000);

  try {
    const { result } = createResponsesCall(
      req,
      { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
      [
        { role: "user", content: `Here is my data:\n${data}` },
      ],
      SYSTEM,
    );
    const text = await result.text;
    if (!text.trim()) return json({ error: "The AI didn't return an answer. Please try again later." }, 502);
    return json({ analysis: text });
  } catch (e: any) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: cors });
    const status: number = e?.statusCode ?? e?.lastError?.statusCode ?? 500;
    const msg =
      status === 429 ? "Too many requests — please wait a moment and try again."
      : status === 402 ? "AI credits are used up. Add credits in workspace billing to continue."
      : status === 403 ? "AI access is blocked for this workspace right now."
      : "AI analysis failed. Please try again later.";
    console.error("nutrient-gaps error", status, e?.message);
    return json({ error: msg }, status >= 400 && status < 600 ? status : 500);
  }
});
