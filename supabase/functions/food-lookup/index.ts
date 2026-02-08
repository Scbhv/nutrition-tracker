import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org";

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

// Search Open Food Facts for a product
async function searchOpenFoodFacts(query: string): Promise<any | null> {
  try {
    const searchUrl = `${OPEN_FOOD_FACTS_API}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.error("Open Food Facts search failed:", response.status);
      return null;
    }
    const data = await response.json();
    if (data.products && data.products.length > 0) {
      return data.products[0];
    }
    return null;
  } catch (error) {
    console.error("Open Food Facts error:", error);
    return null;
  }
}

// Extract nutrients from Open Food Facts product
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
    sodium: n["sodium_100g"] ? n["sodium_100g"] * 1000 : undefined, // Convert g to mg
    potassium: n["potassium_100g"] ? n["potassium_100g"] * 1000 : undefined,
    calcium: n["calcium_100g"] ? n["calcium_100g"] * 1000 : undefined,
    magnesium: n["magnesium_100g"] ? n["magnesium_100g"] * 1000 : undefined,
    iron: n["iron_100g"] ? n["iron_100g"] * 1000 : undefined,
    zinc: n["zinc_100g"] ? n["zinc_100g"] * 1000 : undefined,
    "vitamin-a": n["vitamin-a_100g"] ? n["vitamin-a_100g"] * 1000000 : undefined, // Convert to μg
    "vitamin-c": n["vitamin-c_100g"] ? n["vitamin-c_100g"] * 1000 : undefined,
    "vitamin-d": n["vitamin-d_100g"] ? n["vitamin-d_100g"] * 1000000 : undefined,
    "vitamin-e": n["vitamin-e_100g"] ? n["vitamin-e_100g"] * 1000 : undefined,
    "vitamin-b6": n["vitamin-b6_100g"] ? n["vitamin-b6_100g"] * 1000 : undefined,
    "vitamin-b12": n["vitamin-b12_100g"] ? n["vitamin-b12_100g"] * 1000000 : undefined,
  };
}

// Sanitize query for AI prompt
function sanitizeQuery(query: string): string {
  return query
    .replace(/[\n\r\t]/g, ' ')  // Remove newlines and tabs
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim()
    .substring(0, 200);          // Enforce max length as safety net
}

// Use AI to estimate nutrition for a food description
async function estimateWithAI(query: string, apiKey: string): Promise<{ name: string; nutrients: NutrientData } | null> {
  try {
    const sanitizedQuery = sanitizeQuery(query);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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
Only include nutrients you're confident about. Use null for unknown values.`
          },
          {
            role: "user",
            content: `Estimate nutrition for: ${sanitizedQuery}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("AI credits exhausted. Please add credits to continue.");
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service temporarily unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("No content in AI response");
      return null;
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }

    const parsed = JSON.parse(jsonStr.trim());
    
    // Clean up null values
    const cleanedNutrients: NutrientData = {};
    for (const [key, value] of Object.entries(parsed.nutrients || {})) {
      if (value !== null && value !== undefined && typeof value === 'number') {
        (cleanedNutrients as any)[key] = value;
      }
    }

    return {
      name: parsed.name || query,
      nutrients: cleanedNutrients,
    };
  } catch (error) {
    console.error("AI estimation error:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { query, useAI = true } = await req.json();

    // Input validation constants
    const MAX_QUERY_LENGTH = 200;
    const MIN_QUERY_LENGTH = 2;

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Query too short. Please provide a more detailed description." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Query too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First try Open Food Facts
    const offProduct = await searchOpenFoodFacts(trimmedQuery);
    
    if (offProduct) {
      const nutrients = extractNutrients(offProduct);
      const name = offProduct.product_name || offProduct.product_name_en || query;
      const brand = offProduct.brands;
      
      return new Response(
        JSON.stringify({
          source: "openfoodfacts",
          name,
          brand,
          nutrients,
          barcode: offProduct.code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fall back to AI estimation if enabled
    if (useAI) {
      const aiResult = await estimateWithAI(trimmedQuery, LOVABLE_API_KEY);
      
      if (aiResult) {
        return new Response(
          JSON.stringify({
            source: "ai",
            name: aiResult.name,
            nutrients: aiResult.nutrients,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Could not find nutrition data for this food" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Food lookup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for specific error types
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
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
