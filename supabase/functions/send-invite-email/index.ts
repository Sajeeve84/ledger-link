import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  inviteLink: string;
  inviteType: "accountant" | "client";
  firmName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviteLink, inviteType, firmName }: InviteEmailRequest = await req.json();

    console.log(`Sending invite email to ${email} for ${inviteType}`);

    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "",
        port: smtpPort,
        // Port 465 uses implicit TLS, port 587 uses STARTTLS
        tls: smtpPort === 465,
        auth: {
          username: Deno.env.get("SMTP_USER") || "",
          password: Deno.env.get("SMTP_PASS") || "",
        },
      },
    });

    const subject = inviteType === "accountant" 
      ? `You're invited to join ${firmName || "our firm"} as an Accountant`
      : `You're invited to join ${firmName || "our firm"} as a Client`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hello,
          </p>
          <p style="font-size: 16px; margin-bottom: 20px;">
            You've been invited to join <strong>${firmName || "our firm"}</strong> as ${inviteType === "accountant" ? "an <strong>Accountant</strong>" : "a <strong>Client</strong>"}.
          </p>
          <p style="font-size: 16px; margin-bottom: 30px;">
            Click the button below to accept your invitation and create your account:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            This invitation link will expire in 48 hours.
          </p>
          <p style="font-size: 14px; color: #6b7280;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    await client.send({
      from: Deno.env.get("SMTP_FROM") || "",
      to: email,
      subject: subject,
      content: "You've been invited! Please view this email in an HTML-capable client.",
      html: htmlContent,
    });

    await client.close();

    console.log(`Invite email sent successfully to ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invite email:", error);
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
