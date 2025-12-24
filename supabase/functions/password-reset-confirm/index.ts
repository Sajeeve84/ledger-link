import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(JSON.stringify({ error: "token and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Password reset confirm request");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hash the token to compare with DB
    const tokenHash = await hashToken(token);

    // Find valid token
    const { data: resetToken, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError) {
      console.error("Token lookup error:", tokenError);
      throw new Error("Database error");
    }

    if (!resetToken) {
      console.log("No matching token found");
      return new Response(JSON.stringify({ error: "Invalid or expired reset token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resetToken.used_at) {
      console.log("Token already used");
      return new Response(JSON.stringify({ error: "Reset token has already been used" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      console.log("Token expired");
      return new Response(JSON.stringify({ error: "Reset token has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      resetToken.user_id,
      { password }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      throw new Error("Failed to update password");
    }

    // Mark token as used
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetToken.id);

    console.log("Password reset successful for user:", resetToken.user_id);

    return new Response(JSON.stringify({ success: true, message: "Password has been reset successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Password reset confirm error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
