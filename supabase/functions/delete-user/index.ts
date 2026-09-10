/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { userId } = await req.json().catch(() => ({}));
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Verify caller with their JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    if (authData.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // 2) Admin client for destructive ops
    const admin = createClient(supabaseUrl, serviceKey);

    // 3) Best-effort: delete avatar from storage
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
        await admin.storage.from("avatars").remove([path]).catch(() => {});
      }
    }

    // 4) DB cleanup via RPC (your plpgsql function)
    const { error: rpcErr } = await admin.rpc("delete_user_everything", { p_user_id: userId });
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // 5) Delete the Auth user (last)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});