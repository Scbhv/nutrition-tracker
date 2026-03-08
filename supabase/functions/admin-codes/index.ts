import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://food-whisperer-health.lovable.app",
  "https://id-preview--1764e644-44c7-4500-bf0b-0dd59c1a1055.lovable.app",
  "https://1764e644-44c7-4500-bf0b-0dd59c1a1055.lovableproject.com",
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

function jsonResponse(cors: Record<string, string>, body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const ADMIN_EMAILS = ["simonstechprojects@gmail.com"];

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
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

    const userEmail = claimsData.claims.email as string;
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return jsonResponse(cors, { error: "Forbidden" }, 403);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Resolve action from query param or POST body
    let body: any = {};
    if (req.method === "POST") body = await req.json();
    const action = new URL(req.url).searchParams.get("action") || body.action;

    // LIST codes
    if (req.method === "GET" || action === "list") {
      const { data: codes, error } = await serviceClient
        .from("unlock_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      const { data: premiumUsers } = await serviceClient
        .from("premium_users").select("id, user_id, unlocked_at, unlock_method");

      return jsonResponse(cors, { codes, premiumUsers: premiumUsers || [] });
    }

    // CREATE code
    if (action === "create") {
      const { code, max_uses } = body;
      if (!code || typeof code !== "string" || code.length > 50) {
        return jsonResponse(cors, { error: "Invalid code" }, 400);
      }
      const { error } = await serviceClient.from("unlock_codes").insert({
        code: code.trim(), max_uses: max_uses || 1, is_active: true,
      });
      if (error) return jsonResponse(cors, { error: error.message }, 400);
      return jsonResponse(cors, { success: true });
    }

    // TOGGLE code
    if (action === "toggle") {
      const { error } = await serviceClient
        .from("unlock_codes").update({ is_active: body.is_active }).eq("id", body.id);
      if (error) throw error;
      return jsonResponse(cors, { success: true });
    }

    // DELETE code
    if (action === "delete") {
      const { error } = await serviceClient.from("unlock_codes").delete().eq("id", body.id);
      if (error) throw error;
      return jsonResponse(cors, { success: true });
    }

    return jsonResponse(cors, { error: "Unknown action" }, 400);
  } catch (e) {
    console.error("Admin error:", e);
    return jsonResponse(getCorsHeaders(req), { error: "Internal error" }, 500);
  }
});
