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

  let body: { image?: unknown; fields?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const image = body.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp|heic|heif);base64,/.test(image)) {
    return json({ error: "Please send a JPEG, PNG or WebP photo." }, 400);
  }
  if (image.length > MAX_IMAGE_CHARS) return json({ error: "Photo is too large." }, 400);
  const fields: Record<string, string> = {};
  if (body.fields && typeof body.fields === "object") {
    for (const [k, v] of Object.entries(body.fields as Record<string, unknown>).slice(0, 80)) {
      if (KEY_RE.test(k) && typeof v === "string" && v.length < 10) fields[k] = v;
    }
  }
  if (!fields["energy-kcal"]) fields["energy-kcal"] = "kcal";

  const instructions = `You read nutrition-facts labels from photos of packaged food.
Return ONLY a JSON object, no prose, with this shape:
{"isLabel": boolean, "name": string|null, "brand": string|null, "servingSize": number|null, "servingUnit": "g"|"ml"|null, "per100": {<key>: number}, "notes": string|null}
Rules:
- "per100" values are per 100 g (or 100 ml). If the label only shows per-serving values, convert using the serving size.
- Use ONLY these keys, in these units (convert units if needed, e.g. kJ->kcal only when kcal is absent, mg<->g, µg): ${JSON.stringify(fields)}
- "salt" and "sodium" are both allowed when present; do not invent values that aren't on the label.
- servingSize is the label's stated serving in grams/ml (null if none).
- If the photo is not a nutrition label, set isLabel false and per100 {}.
- "notes": short remark if something was unreadable, else null.`;

  try {
    const { result } = createResponsesCall(
      req,
      { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
      [{
        role: "user",
        content: [
          { type: "text", text: "Extract the nutrition data from this label as json." },
          { type: "image", image: new URL(image) },
        ],
      }],
      instructions,
    );
    const text = await result.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Couldn't read the label. Try a sharper, well-lit photo." }, 422);
    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch { return json({ error: "Couldn't read the label. Try again with a clearer photo." }, 422); }
    if (!parsed.isLabel) return json({ error: "That doesn't look like a nutrition label." }, 422);

    const nutrients: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.per100 ?? {})) {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (fields[k] && Number.isFinite(n) && n >= 0 && n < 100000) nutrients[k] = Math.round(n * 100) / 100;
    }
    if (!Object.keys(nutrients).length) return json({ error: "No nutrient values were readable on this photo." }, 422);
    const size = Number(parsed.servingSize);
    return json({
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 200) : null,
      brand: typeof parsed.brand === "string" ? parsed.brand.slice(0, 100) : null,
      servingSize: Number.isFinite(size) && size > 0 && size < 5000 ? size : null,
      servingUnit: parsed.servingUnit === "ml" ? "ml" : "g",
      nutrients,
      notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : null,
    });
  } catch (e: any) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: cors });
    const status: number = e?.statusCode ?? e?.lastError?.statusCode ?? 500;
    console.error("nutrition-label error", status, e?.message);
    const msg =
      status === 429 ? "Too many requests — please wait a moment and try again."
      : status === 402 ? "AI credits are used up. Add credits in workspace billing to continue."
      : status === 403 ? "AI access is blocked for this workspace right now."
      : "Label reading failed. Please try again later.";
    return json({ error: msg }, status >= 400 && status < 600 ? status : 500);
  }
});
