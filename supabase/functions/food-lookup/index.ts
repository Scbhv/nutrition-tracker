import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  ...securityHeaders,
};

const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org";

// ─── Rate Limiting ────────────────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const ipLimits = new Map<string, RateLimitEntry>();
const userLimits = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const IP_MAX_REQUESTS = 20;          // 20 req/min per IP
const USER_MAX_REQUESTS = 15;        // 15 req/min per user

function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  maxRequests: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// Periodically clean expired entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipLimits) {
    if (now > entry.resetAt) ipLimits.delete(key);
  }
  for (const [key, entry] of userLimits) {
    if (now > entry.resetAt) userLimits.delete(key);
  }
}, 300_000);

function rateLimitResponse(retryAfterMs: number) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again shortly." }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterMs),
      },
    }
  );
}

// ─── Input Validation ─────────────────────────────────────────────────────────
const ALLOWED_BODY_KEYS = new Set(["query", "useAI"]);
const MAX_QUERY_LENGTH = 200;
const MIN_QUERY_LENGTH = 2;
// Block control characters, script tags, and null bytes
const DANGEROUS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F]|<\s*script|javascript:/i;

interface ValidatedInput {
  query: string;
  useAI: boolean;
}

function validateAndSanitizeInput(body: unknown): { valid: true; data: ValidatedInput } | { valid: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const obj = body as Record<string, unknown>;

  // Reject unexpected fields
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return { valid: false, error: `Unexpected field: '${key}'` };
    }
  }

  // Validate query
  if (!("query" in obj) || typeof obj.query !== "string") {
    return { valid: false, error: "Field 'query' is required and must be a string" };
  }

  const trimmedQuery = obj.query.trim();

  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return { valid: false, error: `Query too short. Minimum ${MIN_QUERY_LENGTH} characters.` };
  }

  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: `Query too long. Maximum ${MAX_QUERY_LENGTH} characters.` };
  }

  if (DANGEROUS_PATTERN.test(trimmedQuery)) {
    return { valid: false, error: "Query contains invalid characters" };
  }

  // Validate useAI (optional boolean)
  let useAI = true;
  if ("useAI" in obj) {
    if (typeof obj.useAI !== "boolean") {
      return { valid: false, error: "Field 'useAI' must be a boolean" };
    }
    useAI = obj.useAI;
  }

  return { valid: true, data: { query: trimmedQuery, useAI } };
}

// ─── Nutrient Types & Helpers ─────────────────────────────────────────────────
interface NutrientData {
  "energy-kcal"?: number;
  fat?: number;
  "saturated-fat"?: number;
  carbohydrates?: number;
  sugars?: number;
  fiber?: number;
  proteins?: number;
  salt?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  magnesium?: number;
  iron?: number;
  zinc?: number;
  "vitamin-a"?: number;
  "vitamin-c"?: number;
  "vitamin-d"?: number;
  "vitamin-e"?: number;
  "vitamin-b6"?: number;
  "vitamin-b12"?: number;
  "vitamin-k"?: number;
  water?: number;
}

const VALID_NUTRIENT_KEYS = new Set<string>([
  "energy-kcal", "fat", "saturated-fat", "carbohydrates", "sugars", "fiber",
  "proteins", "salt", "sodium", "potassium", "calcium", "magnesium", "iron",
  "zinc", "vitamin-a", "vitamin-c", "vitamin-d", "vitamin-e", "vitamin-b6",
  "vitamin-b12", "vitamin-k", "water",
]);

async function searchOpenFoodFacts(query: string): Promise<any | null> {
  try {
    const searchUrl = `${OPEN_FOOD_FACTS_API}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
    const response = await fetch(searchUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return data.products?.[0] ?? null;
  } catch {
    return null;
  }
}

function extractNutrients(product: any): NutrientData {
  const n = product.nutriments || {};
  return {
    "energy-kcal": n["energy-kcal_100g"] || n["energy_100g"] / 4.184,
    fat: n["fat_100g"],
    "saturated-fat": n["saturated-fat_100g"],
    carbohydrates: n["carbohydrates_100g"],
    sugars: n["sugars_100g"],
    fiber: n["fiber_100g"],
    proteins: n["proteins_100g"],
    salt: n["salt_100g"],
    sodium: n["sodium_100g"] ? n["sodium_100g"] * 1000 : undefined,
    potassium: n["potassium_100g"] ? n["potassium_100g"] * 1000 : undefined,
    calcium: n["calcium_100g"] ? n["calcium_100g"] * 1000 : undefined,
    magnesium: n["magnesium_100g"] ? n["magnesium_100g"] * 1000 : undefined,
    iron: n["iron_100g"] ? n["iron_100g"] * 1000 : undefined,
    zinc: n["zinc_100g"] ? n["zinc_100g"] * 1000 : undefined,
    "vitamin-a": n["vitamin-a_100g"] ? n["vitamin-a_100g"] * 1000000 : undefined,
    "vitamin-c": n["vitamin-c_100g"] ? n["vitamin-c_100g"] * 1000 : undefined,
    "vitamin-d": n["vitamin-d_100g"] ? n["vitamin-d_100g"] * 1000000 : undefined,
    "vitamin-e": n["vitamin-e_100g"] ? n["vitamin-e_100g"] * 1000 : undefined,
    "vitamin-b6": n["vitamin-b6_100g"] ? n["vitamin-b6_100g"] * 1000 : undefined,
    "vitamin-b12": n["vitamin-b12_100g"] ? n["vitamin-b12_100g"] * 1000000 : undefined,
  };
}

function sanitizeQuery(query: string): string {
  return query
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200);
}

async function estimateWithAI(query: string, apiKey: string): Promise<{ name: string; nutrients: NutrientData } | null> {
  const sanitizedQuery = sanitizeQuery(query);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a nutrition expert. Given a food description, estimate the nutritional values per 100g.
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "name": "formatted food name",
  "nutrients": {
    "energy-kcal": number,
    "fat": number (grams),
    "saturated-fat": number (grams),
    "carbohydrates": number (grams),
    "sugars": number (grams),
    "fiber": number (grams),
    "proteins": number (grams),
    "salt": number (grams),
    "sodium": number (mg),
    "potassium": number (mg),
    "calcium": number (mg),
    "magnesium": number (mg),
    "iron": number (mg),
    "zinc": number (mg),
    "vitamin-a": number (μg),
    "vitamin-c": number (mg),
    "vitamin-d": number (μg),
    "vitamin-e": number (mg),
    "vitamin-b6": number (mg),
    "vitamin-b12": number (μg),
    "vitamin-k": number (μg),
    "water": number (ml per 100g)
  }
}
Only include nutrients you're confident about. Use null for unknown values.`,
        },
        { role: "user", content: `Estimate nutrition for: ${sanitizedQuery}` },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
    if (response.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error("AI service temporarily unavailable");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  let jsonStr = content.trim();
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

  const parsed = JSON.parse(jsonStr.trim());

  // Validate AI response structure
  if (typeof parsed.name !== "string" || parsed.name.length > 200) {
    return null;
  }

  const cleanedNutrients: NutrientData = {};
  for (const [key, value] of Object.entries(parsed.nutrients || {})) {
    if (VALID_NUTRIENT_KEYS.has(key) && typeof value === "number" && isFinite(value) && value >= 0) {
      (cleanedNutrients as any)[key] = value;
    }
  }

  return { name: parsed.name, nutrients: cleanedNutrients };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Extract client IP for rate limiting
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // IP-based rate limit
    const ipCheck = checkRateLimit(ipLimits, clientIP, IP_MAX_REQUESTS);
    if (!ipCheck.allowed) {
      return rateLimitResponse(ipCheck.retryAfterMs);
    }

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !data?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User-based rate limit
    const userCheck = checkRateLimit(userLimits, data.user.id, USER_MAX_REQUESTS);
    if (!userCheck.allowed) {
      return rateLimitResponse(userCheck.retryAfterMs);
    }

    // Parse and validate input
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateAndSanitizeInput(rawBody);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, useAI } = validation.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try Open Food Facts first
    const offProduct = await searchOpenFoodFacts(query);

    if (offProduct) {
      const nutrients = extractNutrients(offProduct);
      const name = offProduct.product_name || offProduct.product_name_en || query;
      const brand = offProduct.brands;

      return new Response(
        JSON.stringify({ source: "openfoodfacts", name, brand, nutrients, barcode: offProduct.code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fall back to AI
    if (useAI) {
      const aiResult = await estimateWithAI(query, LOVABLE_API_KEY);

      if (aiResult) {
        return new Response(
          JSON.stringify({ source: "ai", name: aiResult.name, nutrients: aiResult.nutrients }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Could not find nutrition data for this food" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("Rate limit")) {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (errorMessage.includes("credits")) {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
