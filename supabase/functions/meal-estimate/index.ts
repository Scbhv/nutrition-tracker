import { createResponsesCall } from "../_shared/responses.ts";
import { getLovableAiGatewayResponseHeaders } from "../_shared/run-id.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => {
  const headers = getLovableAiGatewayResponseHeaders(undefined, cors);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
};

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as base64
const KEY_RE = /^[a-z0-9-]{1,40}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured." }, 500);

  let body: { image?: unknown; description?: unknown; fields?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const image = typeof body.image === "string" && body.image ? body.image : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";
  if (image && !/^data:image\/(jpeg|png|webp|heic|heif);base64,/.test(image)) {
    return json({ error: "Please send a JPEG, PNG or WebP photo." }, 400);
  }
  if (image && image.length > MAX_IMAGE_CHARS) return json({ error: "Photo is too large." }, 400);
  if (!image && description.length < 3) return json({ error: "Describe the meal or add a photo." }, 400);
  const fields: Record<string, string> = {};
  if (body.fields && typeof body.fields === "object") {
    for (const [k, v] of Object.entries(body.fields as Record<string, unknown>).slice(0, 80)) {
      if (KEY_RE.test(k) && typeof v === "string" && v.length < 10) fields[k] = v;
    }
  }
  if (!fields["energy-kcal"]) fields["energy-kcal"] = "kcal";

  const instructions = `You are a nutrition estimator. From a meal description and/or photo, estimate the whole portion shown/described.
Return ONLY a JSON object, no prose:
{"isFood": boolean, "name": string, "servingSize": number, "servingUnit": "g"|"ml", "per100": {<key>: number}, "items": [string], "confidence": "low"|"medium"|"high", "notes": string|null}
Rules:
- servingSize = estimated total weight of the whole meal in grams (ml for drinks). Use visual cues (plate size, cutlery) and the description; the description wins when they conflict.
- per100 = nutrients per 100 g of the whole meal (weighted mix of its components), using standard food-composition data.
- Use ONLY these keys and units: ${JSON.stringify(fields)}. Always include energy-kcal, proteins, carbohydrates, fat; add fiber, sugars, salt, saturated-fat and micronutrients when reasonably estimable.
- items = short list of components with estimated grams, e.g. "Rice 150 g".
- name = short meal name in the user's language.
- If it isn't food, isFood false.
- notes = one short sentence on the main uncertainty.`;

  const content: any[] = [{ type: "text", text: `Estimate this meal as json.${description ? `\nDescription: ${description}` : ""}` }];
  if (image) content.push({ type: "image", image: new URL(image) });

  try {
    const { result } = createResponsesCall(
      req,
      { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
      [{ role: "user", content }],
      instructions,
    );
    const text = await result.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Couldn't estimate this meal. Try adding more detail." }, 422);
    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch { return json({ error: "Couldn't estimate this meal. Please try again." }, 422); }
    if (!parsed.isFood) return json({ error: "That doesn't look like a meal." }, 422);

    const nutrients: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.per100 ?? {})) {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (fields[k] && Number.isFinite(n) && n >= 0 && n < 100000) nutrients[k] = Math.round(n * 100) / 100;
    }
    if (!Object.keys(nutrients).length) return json({ error: "Couldn't estimate nutrients. Add more detail and try again." }, 422);
    const size = Number(parsed.servingSize);
    return json({
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 200) : null,
      brand: typeof parsed.brand === "string" ? parsed.brand.slice(0, 100) : null,
      servingSize: Number.isFinite(size) && size > 0 && size < 5000 ? size : null,
      servingUnit: parsed.servingUnit === "ml" ? "ml" : "g",
      nutrients,
      items: Array.isArray(parsed.items) ? parsed.items.filter((i: unknown) => typeof i === "string").slice(0, 15).map((i: string) => i.slice(0, 80)) : [],
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
      notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : null,
    });
  } catch (e: any) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: cors });
    const status: number = e?.statusCode ?? e?.lastError?.statusCode ?? 500;
    console.error("meal-estimate error", status, e?.message);
    const msg =
      status === 429 ? "Too many requests — please wait a moment and try again."
      : status === 402 ? "AI credits are used up. Add credits in workspace billing to continue."
      : status === 403 ? "AI access is blocked for this workspace right now."
      : "Meal estimate failed. Please try again later.";
    return json({ error: msg }, status >= 400 && status < 600 ? status : 500);
  }
});
