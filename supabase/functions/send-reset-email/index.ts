import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetEmailRequest {
  email: string;
  resetLink: string;
  userName?: string;
}

// Simple SMTP sender using Deno's built-in TCP
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

  // Connect to SMTP server
  let conn: Deno.Conn;
  
  if (port === 465) {
    // Implicit TLS
    conn = await Deno.connectTls({ hostname: host, port });
  } else {
    // Plain connection first, then STARTTLS
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
    console.log(`SMTP: ${cmd.split(" ")[0]} -> ${response.trim()}`);
    if (expectedCode && !response.startsWith(expectedCode)) {
      throw new Error(`SMTP error: ${response}`);
    }
    return response;
  };

  try {
    // Read greeting
    const greeting = await read();
    console.log(`SMTP Greeting: ${greeting.trim()}`);

    // EHLO
    await sendCommand(`EHLO localhost`, "250");

    // STARTTLS for port 587
    if (port === 587) {
      await sendCommand("STARTTLS", "220");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
      await sendCommand(`EHLO localhost`, "250");
    }

    // AUTH LOGIN
    await sendCommand("AUTH LOGIN", "334");
    await sendCommand(btoa(username), "334");
    await sendCommand(btoa(password), "235");

    // MAIL FROM
    await sendCommand(`MAIL FROM:<${from}>`, "250");

    // RCPT TO
    await sendCommand(`RCPT TO:<${to}>`, "250");

    // DATA
    await sendCommand("DATA", "354");

    // Build email with proper headers
    const boundary = "----=_Part_" + Math.random().toString(36).substring(2);
    const emailContent = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      `Reset your password by clicking the link: ${htmlContent.match(/href="([^"]+)"/)?.[1] || 'See HTML version'}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      htmlContent,
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    await write(emailContent);
    const dataResponse = await read();
    console.log(`SMTP DATA response: ${dataResponse.trim()}`);

    // QUIT
    await sendCommand("QUIT", "221");
  } finally {
    try {
      conn.close();
    } catch {
      // Ignore close errors
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, resetLink, userName }: ResetEmailRequest = await req.json();

    console.log(`Sending password reset email to ${email}`);

    const smtpHost = Deno.env.get("SMTP_HOST") || "";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      throw new Error("SMTP configuration is incomplete");
    }

    const subject = "Reset Your Password - DocuFlow";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hello${userName ? ` ${userName}` : ''},
          </p>
          <p style="font-size: 16px; margin-bottom: 20px;">
            We received a request to reset your password for your DocuFlow account.
          </p>
          <p style="font-size: 16px; margin-bottom: 30px;">
            Click the button below to set a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            This link will expire in 1 hour for security reasons.
          </p>
          <p style="font-size: 14px; color: #6b7280;">
            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color: #667eea; word-break: break-all;">${resetLink}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      email,
      subject,
      htmlContent
    );

    console.log(`Password reset email sent successfully to ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
