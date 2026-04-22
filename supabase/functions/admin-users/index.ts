import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller and check super_admin role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claims.claims.sub;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "super_admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    // List area heads with email + area
    if (action === "list") {
      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("id, user_id, role, area_id, areas(name, slug)")
        .eq("role", "area_head");
      if (rolesErr) {
        return new Response(JSON.stringify({ error: rolesErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userMap = new Map(list.users.map((u) => [u.id, u]));

      const result = (roles ?? []).map((r) => {
        const u = userMap.get(r.user_id);
        return {
          role_id: r.id,
          user_id: r.user_id,
          email: u?.email ?? null,
          last_sign_in_at: u?.last_sign_in_at ?? null,
          area_id: r.area_id,
          area_name: (r as { areas?: { name?: string } }).areas?.name ?? null,
          area_slug: (r as { areas?: { slug?: string } }).areas?.slug ?? null,
        };
      });

      return new Response(JSON.stringify({ users: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset password for any user
    if (action === "reset_password") {
      const userId = body.user_id as string | undefined;
      const password = body.password as string | undefined;
      if (!userId || !password || password.length < 8) {
        return new Response(
          JSON.stringify({ error: "user_id and password (min 8 chars) required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete user (removes role + auth user)
    if (action === "delete_user") {
      const userId = body.user_id as string | undefined;
      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (userId === callerId) {
        return new Response(JSON.stringify({ error: "You cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (roleErr) {
        return new Response(JSON.stringify({ error: roleErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
