import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendEmail(
  host: string,
  port: number,
  username: string,
  password: string,
  from: string,
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let conn: Deno.Conn;
  if (port === 465) {
    conn = await Deno.connectTls({ hostname: host, port });
  } else {
    conn = await Deno.connect({ hostname: host, port });
  }

  const read = async (): Promise<string> => {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    if (n === null) throw new Error("Connection closed");
    return decoder.decode(buffer.subarray(0, n));
  };

  const write = async (data: string): Promise<void> => {
    await conn.write(encoder.encode(data + "\r\n"));
  };

  const sendCommand = async (cmd: string, expectedCode?: string): Promise<string> => {
    await write(cmd);
    const response = await read();
    console.log(`SMTP: ${cmd.split(" ")[0]} -> ${response.trim().slice(0, 60)}`);
    if (expectedCode && !response.startsWith(expectedCode)) {
      throw new Error(`SMTP error: ${response}`);
    }
    return response;
  };

  try {
    const greeting = await read();
    console.log(`SMTP Greeting: ${greeting.trim().slice(0, 60)}`);
    await sendCommand("EHLO localhost", "250");
    if (port === 587) {
      await sendCommand("STARTTLS", "220");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
      await sendCommand("EHLO localhost", "250");
    }
    await sendCommand("AUTH LOGIN", "334");
    await sendCommand(btoa(username), "334");
    await sendCommand(btoa(password), "235");
    await sendCommand(`MAIL FROM:<${from}>`, "250");
    await sendCommand(`RCPT TO:<${to}>`, "250");
    await sendCommand("DATA", "354");

    const boundary = "----=_Part_" + Math.random().toString(36).substring(2);
    const emailContent = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      "",
      `Reset your password by clicking the link in the HTML version of this email.`,
      "",
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      "",
      htmlContent,
      "",
      `--${boundary}--`,
      ".",
    ].join("\r\n");

    await write(emailContent);
    await read();
    await sendCommand("QUIT", "221");
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, origin } = await req.json();
    if (!email || !origin) {
      return new Response(JSON.stringify({ error: "email and origin required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Password reset request for ${email}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user in profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
    }

    // Always return success to prevent email enumeration
    if (!profile) {
      console.log("No profile found for email:", email);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete existing tokens for this user
    await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", profile.id);

    // Generate token
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store hashed token
    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({ user_id: profile.id, token_hash: tokenHash, expires_at: expiresAt });

    if (insertError) {
      console.error("Token insert error:", insertError);
      throw new Error("Failed to create reset token");
    }

    // Build reset link
    const resetLink = `${origin}/reset-password?token=${rawToken}`;

    // Send email via SMTP
    const smtpHost = Deno.env.get("SMTP_HOST") || "";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      throw new Error("SMTP configuration incomplete");
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Hello${profile.full_name ? ` ${profile.full_name}` : ""},</p>
          <p>We received a request to reset your password for your DocuFlow account.</p>
          <p>Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280;">This link expires in 1 hour.</p>
          <p style="font-size: 14px; color: #6b7280;">If you didn't request this, ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center; word-break: break-all;">
            <a href="${resetLink}" style="color: #667eea;">${resetLink}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    await sendEmail(smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, email, "Reset Your Password - DocuFlow", htmlContent);
    console.log(`Password reset email sent to ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Password reset request error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
