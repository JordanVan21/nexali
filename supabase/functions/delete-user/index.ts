/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Comma-separated list of allowed browser origins, e.g.
// "https://nexali.app,https://www.nexali.app". Configure this as an Edge
// Function secret/environment variable in the deployed project
// (`supabase secrets set ALLOWED_ORIGINS=...`). No production hostname is
// hardcoded here since none is established in this repository yet --
// until this is configured, only the local Vite dev origins below are
// allowed, so the function fails closed rather than open.
const EXTRA_ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

const ALLOWED_ORIGINS = [...EXTRA_ALLOWED_ORIGINS, ...DEV_ORIGINS];

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  // Only echo the requesting origin back when it's on the allowlist. An
  // unrecognized origin gets no Access-Control-Allow-Origin header at all,
  // so the browser withholds the response from that page's script.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Safe, generic client-facing message. The real detail is logged server-side only. */
function safeErrorResponse(status: number, message: string, origin: string | null, logDetail?: unknown) {
  if (logDetail !== undefined) {
    console.error(`[delete-user] ${message}:`, logDetail);
  }
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Verify caller with their JWT. The target user is derived only
    // from this verified session -- no client-supplied id is trusted or
    // even required in the request body.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return safeErrorResponse(401, "Unauthorized", origin, authErr?.message);
    }
    const userId = authData.user.id;

    // 2) Admin client for destructive ops
    const admin = createClient(supabaseUrl, serviceKey);

    // 3) Best-effort: delete avatar from storage. Never blocks account
    // deletion -- a Storage cleanup failure is logged, not surfaced.
    const { data: prof } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.avatar_url) {
      const pathFromPublicUrl = (publicUrl: string) => {
        try {
          const u = new URL(publicUrl);
          const prefix = "/storage/v1/object/public/avatars/";
          const i = u.pathname.indexOf(prefix);
          if (i === -1) return null;
          return decodeURIComponent(u.pathname.slice(i + prefix.length));
        } catch {
          return null;
        }
      };
      const path = pathFromPublicUrl(prof.avatar_url);
      if (path) {
        try {
          const { error: storageErr } = await admin.storage.from("avatars").remove([path]);
          if (storageErr) {
            console.error("[delete-user] avatar cleanup failed (continuing):", storageErr.message);
          }
        } catch (storageException) {
          console.error("[delete-user] avatar cleanup threw (continuing):", storageException);
        }
      }
    }

    // 4) DB cleanup via RPC. This RPC is restricted to service_role only
    // (see supabase/migrations/20260913000000_secure_delete_user_rpc.sql)
    // and this admin client is the only caller with that privilege.
    const { error: rpcErr } = await admin.rpc("delete_user_everything", { p_user_id: userId });
    if (rpcErr) {
      return safeErrorResponse(
        500,
        "We couldn't delete your account data. Please try again or contact support.",
        origin,
        rpcErr.message
      );
    }

    // 5) Delete the Auth user (last)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return safeErrorResponse(
        500,
        "We couldn't finish deleting your account. Please try again or contact support.",
        origin,
        delErr.message
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    return safeErrorResponse(500, "Something went wrong while deleting your account.", origin, e);
  }
});
