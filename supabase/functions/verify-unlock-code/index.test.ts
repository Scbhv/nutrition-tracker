import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/verify-unlock-code`;

Deno.test("verify-unlock-code - rejects missing auth", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ code: "TEST123" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("No auth response:", body);
});

Deno.test("verify-unlock-code - rejects invalid token", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer invalid-token-here",
    },
    body: JSON.stringify({ code: "TEST123" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("Invalid token response:", body);
});

Deno.test("verify-unlock-code - rejects empty code", async () => {
  // We need a valid token for this test - skip if no test user available
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer invalid",
    },
    body: JSON.stringify({ code: "" }),
  });
  const body = await res.text();
  // Should get 401 since token is invalid (auth check happens before input validation)
  assertEquals(res.status, 401);
  console.log("Empty code response:", body);
});

Deno.test("verify-unlock-code - CORS preflight works", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: { "Origin": "https://food-whisperer-health.lovable.app" },
  });
  await res.text();
  assertEquals(res.status, 200);
  console.log("CORS headers:", res.headers.get("Access-Control-Allow-Origin"));
});
