import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS & Response Helpers ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://food-whisperer-health.lovable.app",
  "https://id-preview--1764e644-44c7-4500-bf0b-0dd59c1a1055.lovable.app",
  "https://1764e644-44c7-4500-bf0b-0dd59c1a1055.lovableproject.com",
];

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    ...SECURITY_HEADERS,
  };
}

function jsonResponse(cors: Record<string, string>, body: object, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const RATE_LIMITS = { ip: 20, user: 15, windowSec: 60 } as const;

async function checkRateLimit(client: any, key: string, max: number): Promise<boolean> {
  const { data, error } = await client.rpc("check_and_increment_rate_limit", {
    p_key: key, p_max_requests: max, p_window_seconds: RATE_LIMITS.windowSec,
  });
  if (error) { console.error("Rate limit check failed:", error.message); return true; }
  return data === true;
}

// ─── Input Validation ─────────────────────────────────────────────────────────
const ALLOWED_BODY_KEYS = new Set(["query", "useAI"]);
const DANGEROUS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F]|<\s*script|javascript:/i;

interface ValidatedInput { query: string; useAI: boolean; }

function validateInput(body: unknown): { valid: true; data: ValidatedInput } | { valid: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, error: "Request body must be a JSON object" };
  }
  const obj = body as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_BODY_KEYS.has(key)) return { valid: false, error: `Unexpected field: '${key}'` };
  }

  if (typeof obj.query !== "string") return { valid: false, error: "Field 'query' is required and must be a string" };
  const query = obj.query.trim();
  if (query.length < 2) return { valid: false, error: "Query too short. Minimum 2 characters." };
  if (query.length > 200) return { valid: false, error: "Query too long. Maximum 200 characters." };
  if (DANGEROUS_PATTERN.test(query)) return { valid: false, error: "Query contains invalid characters" };

  if ("useAI" in obj && typeof obj.useAI !== "boolean") return { valid: false, error: "Field 'useAI' must be a boolean" };

  return { valid: true, data: { query, useAI: (obj.useAI as boolean) ?? true } };
}

// ─── Nutrient Helpers ─────────────────────────────────────────────────────────
const VALID_NUTRIENT_KEYS = new Set([
  "energy-kcal", "fat", "saturated-fat", "carbohydrates", "sugars", "fiber",
  "proteins", "salt", "sodium", "potassium", "calcium", "magnesium", "iron",
  "zinc", "vitamin-a", "vitamin-c", "vitamin-d", "vitamin-e", "vitamin-b6",
  "vitamin-b12", "vitamin-k", "water",
]);

type NutrientData = Partial<Record<string, number>>;

// Conversion multipliers for OFF data (base unit → display unit)
const OFF_MULTIPLIERS: Record<string, number> = {
  sodium: 1000, potassium: 1000, calcium: 1000, magnesium: 1000,
  iron: 1000, zinc: 1000, "vitamin-c": 1000, "vitamin-e": 1000,
  "vitamin-b6": 1000, "vitamin-a": 1e6, "vitamin-d": 1e6, "vitamin-b12": 1e6,
};

function extractNutrients(product: any): NutrientData {
  const n = product.nutriments || {};
  const result: NutrientData = {
    "energy-kcal": n["energy-kcal_100g"] || n["energy_100g"] / 4.184,
    fat: n["fat_100g"], "saturated-fat": n["saturated-fat_100g"],
    carbohydrates: n["carbohydrates_100g"], sugars: n["sugars_100g"],
    fiber: n["fiber_100g"], proteins: n["proteins_100g"], salt: n["salt_100g"],
  };
  // Apply unit conversions for micronutrients
  for (const [key, mult] of Object.entries(OFF_MULTIPLIERS)) {
    const val = n[`${key}_100g`];
    if (val != null) result[key] = val * mult;
  }
  return result;
}

async function searchOpenFoodFacts(query: string): Promise<any | null> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()).products?.[0] ?? null;
  } catch { return null; }
}

async function estimateWithAI(query: string, apiKey: string): Promise<{ name: string; nutrients: NutrientData } | null> {
  const sanitized = query.replace(/[\n\r\t]/g, " ").replace(/\s+/g, " ").trim().substring(0, 200);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `You are a nutrition expert. Given a food description, estimate the nutritional values per 100g.
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{"name":"formatted food name","nutrients":{"energy-kcal":number,"fat":number,"saturated-fat":number,"carbohydrates":number,"sugars":number,"fiber":number,"proteins":number,"salt":number,"sodium":number(mg),"potassium":number(mg),"calcium":number(mg),"magnesium":number(mg),"iron":number(mg),"zinc":number(mg),"vitamin-a":number(μg),"vitamin-c":number(mg),"vitamin-d":number(μg),"vitamin-e":number(mg),"vitamin-b6":number(mg),"vitamin-b12":number(μg),"vitamin-k":number(μg),"water":number(ml per 100g)}}
Only include nutrients you're confident about. Use null for unknown values.` },
        { role: "user", content: `Estimate nutrition for: ${sanitized}` },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error("AI service temporarily unavailable");
  }

  const content = (await res.json()).choices?.[0]?.message?.content;
  if (!content) return null;

  const jsonStr = content.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(jsonStr);

  if (typeof parsed.name !== "string" || parsed.name.length > 200) return null;

  const nutrients: NutrientData = {};
  for (const [k, v] of Object.entries(parsed.nutrients || {})) {
    if (VALID_NUTRIENT_KEYS.has(k) && typeof v === "number" && isFinite(v) && v >= 0) nutrients[k] = v;
  }
  return { name: parsed.name, nutrients };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse(cors, { error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse(cors, { error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data, error: authError } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !data?.user) return jsonResponse(cors, { error: "Invalid or expired token" }, 401);

    const userId = data.user.id;
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

    // Rate limiting
    if (!await checkRateLimit(serviceClient, `ip:${clientIP}`, RATE_LIMITS.ip) ||
        !await checkRateLimit(serviceClient, `user:${userId}`, RATE_LIMITS.user)) {
      return jsonResponse(cors, { error: "Too many requests. Please try again shortly." }, 429, { "Retry-After": "60" });
    }

    // Premium check
    const { data: isPremium } = await serviceClient.rpc("is_premium", { p_user_id: userId });
    if (!isPremium) return jsonResponse(cors, { error: "This is a premium feature. Please unlock premium to continue." }, 403);

    // Parse input
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { return jsonResponse(cors, { error: "Invalid JSON body" }, 400); }

    const validation = validateInput(rawBody);
    if (!validation.valid) return jsonResponse(cors, { error: validation.error }, 400);

    const { query, useAI } = validation.data;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse(cors, { error: "Server configuration error" }, 500);

    // Try Open Food Facts first
    const product = await searchOpenFoodFacts(query);
    if (product) {
      return jsonResponse(cors, {
        source: "openfoodfacts",
        name: product.product_name || product.product_name_en || query,
        brand: product.brands,
        nutrients: extractNutrients(product),
        barcode: product.code,
      });
    }

    // Fall back to AI
    if (useAI) {
      const result = await estimateWithAI(query, apiKey);
      if (result) return jsonResponse(cors, { source: "ai", name: result.name, nutrients: result.nutrients });
    }

    return jsonResponse(cors, { error: "Could not find nutrition data for this food" }, 404);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("Rate limit")) return jsonResponse(cors, { error: msg }, 429);
    if (msg.includes("credits")) return jsonResponse(cors, { error: msg }, 402);
    return jsonResponse(cors, { error: "An unexpected error occurred" }, 500);
  }
});
