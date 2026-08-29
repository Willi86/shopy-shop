import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  ticketId: string;
  message: string;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supportFromEmail = Deno.env.get("SUPPORT_FROM_EMAIL");
    const supportFromName = Deno.env.get("SUPPORT_FROM_NAME") ??
      "Priamos 3D Lab Support";

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !resendApiKey ||
      !supportFromEmail
    ) {
      throw new Error("Missing required environment variables.");
    }

    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header." }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized." }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required." }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const body = (await request.json()) as RequestBody;

    const ticketId = body.ticketId?.trim();
    const message = body.message?.trim();

    if (!ticketId || !message) {
      return new Response(
        JSON.stringify({
          error: "ticketId and message are required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select(`
        id,
        ticket_number,
        customer_name,
        customer_email,
        subject
      `)
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: "Support ticket not found." }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticket.id,
        sender_type: "admin",
        sender_user_id: user.id,
        message,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      throw insertError;
    }

    const emailSubject =
      `[Priamos Support #${ticket.ticket_number}] ${ticket.subject}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(emailSubject)}</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background: #f5f5f5;
      font-family: Arial, Helvetica, sans-serif;
      color: #222;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background: #f5f5f5; padding: 32px 16px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width: 640px;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
            "
          >
            <tr>
              <td style="padding: 28px 32px 12px 32px;">
                <h1
                  style="
                    margin: 0;
                    font-size: 24px;
                    line-height: 1.3;
                  "
                >
                  Priamos 3D Lab Support
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding: 8px 32px 0 32px;">
                <p style="margin: 0 0 16px 0;">
                  Hi ${escapeHtml(ticket.customer_name)},
                </p>

                <p style="margin: 0 0 20px 0;">
                  We have replied to your support request.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 24px 32px;">
                <div
                  style="
                    padding: 18px;
                    background: #f7f7f7;
                    border-radius: 10px;
                    white-space: pre-wrap;
                    line-height: 1.6;
                  "
                >${escapeHtml(message)}</div>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 24px 32px;">
                <p
                  style="
                    margin: 0;
                    font-size: 14px;
                    color: #666;
                    line-height: 1.6;
                  "
                >
                  Ticket #${ticket.ticket_number}<br />
                  Subject: ${escapeHtml(ticket.subject)}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 28px 32px;">
                <p
                  style="
                    margin: 0;
                    font-size: 14px;
                    color: #666;
                    line-height: 1.6;
                  "
                >
                  You can reply directly to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

    const emailText = `
Hi ${ticket.customer_name},

We have replied to your support request:

${message}

Ticket #${ticket.ticket_number}
Subject: ${ticket.subject}

You can reply directly to this email.
    `.trim();

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${supportFromName} <${supportFromEmail}>`,
          to: [ticket.customer_email],
          reply_to: "support-3dlab@flenuemaik.resend.app",
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        }),
      },
    );

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendResult);

      return new Response(
        JSON.stringify({
          error: "Reply was saved, but the email could not be sent.",
          emailError: resendResult,
          messageId: insertedMessage.id,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: insertedMessage.id,
        emailId: resendResult.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "Unexpected server error.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
