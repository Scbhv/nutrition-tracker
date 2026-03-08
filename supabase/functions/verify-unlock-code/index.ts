import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://food-whisperer-health.lovable.app",
  "https://id-preview--1764e644-44c7-4500-bf0b-0dd59c1a1055.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function jsonResponse(cors: Record<string, string>, body: object, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

async function checkRateLimitDb(
  client: any, key: string, max: number, windowSec: number
): Promise<boolean> {
  const { data, error } = await client.rpc("check_and_increment_rate_limit", {
    p_key: key, p_max_requests: max, p_window_seconds: windowSec,
  });
  if (error) { console.error("Rate limit check failed:", error.message); return true; }
  return data === true;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(cors, { error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await anonClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return jsonResponse(cors, { error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting: 5 attempts per 10 min per user, 10 per IP
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || "unknown";

    if (!await checkRateLimitDb(serviceClient, `unlock_ip:${clientIP}`, 10, 600) ||
        !await checkRateLimitDb(serviceClient, `unlock_user:${userId}`, 5, 600)) {
      return jsonResponse(cors, { error: "Too many attempts. Please try again later." }, 429, { "Retry-After": "600" });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length === 0 || code.length > 100) {
      return jsonResponse(cors, { error: "Invalid code" }, 400);
    }

    // Atomic code redemption via DB function
    const { data: result, error: redeemError } = await serviceClient.rpc("redeem_unlock_code", {
      p_code: code.trim(), p_user_id: userId,
    });

    if (redeemError) {
      console.error("Redeem error:", redeemError);
      return jsonResponse(cors, { error: "Failed to process code" }, 500);
    }

    const status = result?.status;
    if (status === "already_premium") return jsonResponse(cors, { success: true, message: "Already unlocked" });
    if (status === "invalid_code") return jsonResponse(cors, { error: "Invalid or expired code" }, 400);
    if (status === "success") return jsonResponse(cors, { success: true, message: "Premium unlocked!" });

    return jsonResponse(cors, { error: "Unexpected error" }, 500);
  } catch (e) {
    console.error("Error:", e);
    return jsonResponse(getCorsHeaders(req), { error: "Internal error" }, 500);
  }
});
