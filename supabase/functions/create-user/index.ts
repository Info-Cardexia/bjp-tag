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
    const { email, password, role, area_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Try to create user
    let userId: string | null = null;
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const msg = createError.message || "";
      const alreadyExists =
        msg.toLowerCase().includes("already been registered") ||
        msg.toLowerCase().includes("already exists") ||
        (createError as { code?: string }).code === "email_exists";

      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // User already exists — look them up and update password
      const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const existing = list.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (!existing) {
        return new Response(JSON.stringify({ error: "User exists but could not be located" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = existing.id;
      // Update password so the admin can re-set it from the form
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    } else {
      userId = createData.user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not resolve user id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role) {
      // Check if a row already exists for this (user_id, role) — unique constraint is on these two columns
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", role)
        .maybeSingle();

      if (existingRole) {
        // Update area_id on existing role
        const { error: updateError } = await supabaseAdmin
          .from("user_roles")
          .update({ area_id: area_id || null })
          .eq("id", existingRole.id);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message, user_id: userId }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: userId,
            role,
            area_id: area_id || null,
          });

        if (roleError) {
          return new Response(JSON.stringify({ error: roleError.message, user_id: userId }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ user_id: userId, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
