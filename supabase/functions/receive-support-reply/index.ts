import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

type ResendReceivedEvent = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    message_id?: string;
  };
};

Deno.serve(async (request: Request) => {
  console.log("=== INBOUND WEBHOOK START ===");
  console.log("Method:", request.method);
  console.log(
    "Has svix-id:",
    Boolean(request.headers.get("svix-id")),
  );
  console.log(
    "Has svix-timestamp:",
    Boolean(request.headers.get("svix-timestamp")),
  );
  console.log(
    "Has svix-signature:",
    Boolean(request.headers.get("svix-signature")),
  );

  if (request.method !== "POST") {
    console.log("Rejected: method is not POST");

    return jsonResponse(
      { error: "Method not allowed." },
      405,
    );
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_INBOUND_API_KEY");

    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supportInboundEmail = Deno.env.get("SUPPORT_INBOUND_EMAIL");

    console.log(
      "Has RESEND_INBOUND_API_KEY:",
      Boolean(resendApiKey),
    );
    console.log(
      "Has RESEND_WEBHOOK_SECRET:",
      Boolean(webhookSecret),
    );
    console.log(
      "Has SUPABASE_URL:",
      Boolean(supabaseUrl),
    );
    console.log(
      "Has SUPABASE_SERVICE_ROLE_KEY:",
      Boolean(serviceRoleKey),
    );
    console.log(
      "Has SUPPORT_INBOUND_EMAIL:",
      Boolean(supportInboundEmail),
    );

    if (
      !resendApiKey ||
      !webhookSecret ||
      !supabaseUrl ||
      !serviceRoleKey ||
      !supportInboundEmail
    ) {
      console.error(
        "Missing required environment variables.",
      );

      return jsonResponse(
        {
          error: "Server configuration error.",
          diagnostic: "MISSING_ENVIRONMENT_VARIABLE",
        },
        500,
      );
    }

    const webhookId = request.headers.get("svix-id");

    const webhookTimestamp = request.headers.get("svix-timestamp");

    const webhookSignature = request.headers.get("svix-signature");

    if (
      !webhookId ||
      !webhookTimestamp ||
      !webhookSignature
    ) {
      console.error(
        "Missing one or more Svix signature headers.",
      );

      return jsonResponse(
        {
          error: "Missing webhook signature headers.",
          diagnostic: "MISSING_SIGNATURE_HEADERS",
        },
        400,
      );
    }

    /*
     * Resend webhook verification must use the exact,
     * unmodified raw request body.
     */
    const rawBody = await request.text();

    console.log(
      "Raw body length:",
      rawBody.length,
    );

    const resend = new Resend(resendApiKey);

    let event: ResendReceivedEvent;

    try {
      event = resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: webhookId,
          timestamp: webhookTimestamp,
          signature: webhookSignature,
        },
        webhookSecret,
      }) as ResendReceivedEvent;

      console.log(
        "Webhook signature verified",
      );

      console.log(
        "Event type:",
        event.type,
      );

      console.log(
        "Email ID:",
        event.data?.email_id,
      );

      console.log(
        "From:",
        event.data?.from,
      );

      console.log(
        "To:",
        event.data?.to,
      );

      console.log(
        "Subject:",
        event.data?.subject,
      );
    } catch (error) {
      console.error(
        "WEBHOOK VERIFICATION FAILED:",
        error,
      );

      return jsonResponse(
        {
          error: "Invalid webhook signature.",
          diagnostic: "INVALID_WEBHOOK_SIGNATURE",
        },
        400,
      );
    }

    if (event.type !== "email.received") {
      console.log(
        "Ignored unsupported event:",
        event.type,
      );

      return jsonResponse({
        success: true,
        ignored: true,
        reason: "Unsupported event type.",
      });
    }

    const emailId = event.data?.email_id;

    if (!emailId) {
      console.error(
        "Webhook event has no email_id.",
      );

      return jsonResponse(
        {
          error: "Webhook has no email ID.",
          diagnostic: "MISSING_EMAIL_ID",
        },
        400,
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    console.log(
      "Checking duplicate inbound event...",
    );

    const {
      data: existingEvent,
      error: existingEventError,
    } = await supabaseAdmin
      .from("support_inbound_events")
      .select("id")
      .or(
        `webhook_id.eq.${webhookId},resend_email_id.eq.${emailId}`,
      )
      .maybeSingle();

    if (existingEventError) {
      console.error(
        "Duplicate check failed:",
        existingEventError,
      );

      return jsonResponse(
        {
          error: "Could not check inbound event.",
          diagnostic: "DUPLICATE_CHECK_FAILED",
        },
        500,
      );
    }

    if (existingEvent) {
      console.log(
        "Duplicate webhook/email already processed.",
      );

      return jsonResponse({
        success: true,
        duplicate: true,
      });
    }

    const recipients = (
      event.data.to ?? []
    ).map((address) => address.toLowerCase().trim());

    console.log(
      "Expected inbound email:",
      supportInboundEmail,
    );

    console.log(
      "Actual recipients:",
      recipients,
    );

    if (
      !recipients.includes(
        supportInboundEmail
          .toLowerCase()
          .trim(),
      )
    ) {
      console.warn(
        "Ignoring email sent to another inbound address.",
      );

      return jsonResponse({
        success: true,
        ignored: true,
        reason: "Wrong inbound recipient.",
        diagnostic: "WRONG_INBOUND_RECIPIENT",
      });
    }

    /*
     * email.received gives us metadata.
     * Now retrieve the actual received email body.
     */
    console.log(
      "Retrieving received email from Resend...",
    );

    const {
      data: receivedEmail,
      error: receivedEmailError,
    } = await resend.emails.receiving.get(
      emailId,
    );

    if (
      receivedEmailError ||
      !receivedEmail
    ) {
      console.error(
        "Could not retrieve received email:",
        receivedEmailError,
      );

      return jsonResponse(
        {
          error: "Could not retrieve received email content.",
          diagnostic: "RESEND_EMAIL_RETRIEVAL_FAILED",
        },
        502,
      );
    }

    console.log(
      "Received email retrieved successfully.",
    );

    console.log(
      "Received email from:",
      receivedEmail.from,
    );

    console.log(
      "Received email subject:",
      receivedEmail.subject,
    );

    console.log(
      "Has text body:",
      Boolean(receivedEmail.text),
    );

    console.log(
      "Has HTML body:",
      Boolean(receivedEmail.html),
    );

    const subject = receivedEmail.subject ??
      event.data.subject ??
      "";

    const ticketMatch = subject.match(
      /\[Priamos Support #(\d+)\]/i,
    );

    if (!ticketMatch) {
      console.warn(
        "Inbound email has no ticket number in subject:",
        subject,
      );

      return jsonResponse({
        success: true,
        ignored: true,
        reason: "No support ticket number in subject.",
        diagnostic: "TICKET_NUMBER_NOT_FOUND_IN_SUBJECT",
      });
    }

    const ticketNumber = Number(ticketMatch[1]);

    console.log(
      "Parsed ticket number:",
      ticketNumber,
    );

    if (
      !Number.isSafeInteger(ticketNumber) ||
      ticketNumber < 1
    ) {
      console.warn(
        "Invalid ticket number:",
        ticketNumber,
      );

      return jsonResponse({
        success: true,
        ignored: true,
        reason: "Invalid ticket number.",
        diagnostic: "INVALID_TICKET_NUMBER",
      });
    }

    console.log(
      "Looking up support ticket...",
    );

    const {
      data: ticket,
      error: ticketError,
    } = await supabaseAdmin
      .from("support_tickets")
      .select(`
        id,
        ticket_number,
        customer_email,
        status
      `)
      .eq(
        "ticket_number",
        ticketNumber,
      )
      .maybeSingle();

    if (ticketError) {
      console.error(
        "Ticket lookup failed:",
        ticketError,
      );

      return jsonResponse(
        {
          error: "Ticket lookup failed.",
          diagnostic: "TICKET_LOOKUP_FAILED",
        },
        500,
      );
    }

    if (!ticket) {
      console.warn(
        "No support ticket found:",
        ticketNumber,
      );

      return jsonResponse({
        success: true,
        ignored: true,
        reason: "Ticket not found.",
        diagnostic: "TICKET_NOT_FOUND",
      });
    }

    console.log(
      "Ticket found:",
      ticket.ticket_number,
    );

    const senderEmail = extractEmailAddress(
      receivedEmail.from ??
        event.data.from,
    );

    console.log(
      "Parsed sender email:",
      senderEmail,
    );

    console.log(
      "Expected customer email:",
      ticket.customer_email,
    );

    if (
      senderEmail.toLowerCase() !==
        ticket.customer_email
          .toLowerCase()
          .trim()
    ) {
      console.warn(
        "Sender does not match ticket customer.",
      );

      return jsonResponse({
        success: true,
        ignored: true,
        reason: "Sender does not match ticket customer.",
        diagnostic: "CUSTOMER_EMAIL_MISMATCH",
      });
    }

    let customerMessage = receivedEmail.text?.trim() ??
      "";

    if (
      !customerMessage &&
      receivedEmail.html
    ) {
      customerMessage = htmlToPlainText(
        receivedEmail.html,
      );
    }

    customerMessage = cleanCustomerReply(
      customerMessage,
    );

    console.log(
      "Clean customer message length:",
      customerMessage.length,
    );

    if (!customerMessage) {
      console.warn(
        "Inbound email has no usable message body.",
      );

      return jsonResponse({
        success: true,
        ignored: true,
        reason: "Inbound email had no usable text.",
        diagnostic: "EMPTY_CUSTOMER_MESSAGE",
      });
    }

    if (
      customerMessage.length > 5000
    ) {
      customerMessage = customerMessage.slice(
        0,
        5000,
      );
    }

    console.log(
      "Saving customer reply...",
    );

    const {
      error: messageInsertError,
    } = await supabaseAdmin
      .from(
        "support_ticket_messages",
      )
      .insert({
        ticket_id: ticket.id,
        sender_type: "customer",
        sender_user_id: null,
        message: customerMessage,
      });

    if (messageInsertError) {
      console.error(
        "Could not save customer reply:",
        messageInsertError,
      );

      return jsonResponse(
        {
          error: "Could not save customer reply.",
          diagnostic: "MESSAGE_INSERT_FAILED",
        },
        500,
      );
    }

    console.log(
      "Customer reply saved successfully.",
    );

    const now = new Date().toISOString();

    const {
      error: ticketUpdateError,
    } = await supabaseAdmin
      .from("support_tickets")
      .update({
        status: "open",
        updated_at: now,
        resolved_at: null,
        closed_at: null,
        last_message_at: now,
      })
      .eq(
        "id",
        ticket.id,
      );

    if (ticketUpdateError) {
      console.error(
        "Could not update ticket state:",
        ticketUpdateError,
      );
    } else {
      console.log(
        "Ticket state updated.",
      );
    }

    console.log(
      "Recording inbound event...",
    );

    const {
      error: eventInsertError,
    } = await supabaseAdmin
      .from(
        "support_inbound_events",
      )
      .insert({
        webhook_id: webhookId,
        resend_email_id: emailId,
        ticket_id: ticket.id,
      });

    if (eventInsertError) {
      if (
        eventInsertError.code ===
          "23505"
      ) {
        console.log(
          "Inbound event already recorded.",
        );

        return jsonResponse({
          success: true,
          duplicate: true,
        });
      }

      console.error(
        "Could not record inbound event:",
        eventInsertError,
      );

      return jsonResponse(
        {
          error: "Reply saved but inbound event could not be recorded.",
          diagnostic: "INBOUND_EVENT_INSERT_FAILED",
        },
        500,
      );
    }

    console.log(
      "Inbound event recorded successfully.",
    );

    console.log(
      "=== INBOUND WEBHOOK SUCCESS ===",
    );

    return jsonResponse({
      success: true,
      ticketNumber,
    });
  } catch (error) {
    console.error(
      "receive-support-reply failed:",
      error,
    );

    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : "Unexpected server error.",
        diagnostic: "UNEXPECTED_FUNCTION_ERROR",
      },
      500,
    );
  }
});

function extractEmailAddress(
  value: string,
): string {
  const match = value.match(
    /<([^<>@\s]+@[^<>@\s]+)>/,
  );

  if (match) {
    return match[1]
      .trim()
      .toLowerCase();
  }

  return value
    .trim()
    .toLowerCase();
}

function cleanCustomerReply(text: string): string {
  if (!text) return "";

  let cleaned = text
    .replace(/&#x20;/gi, " ")
    .replace(/&#32;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&amp;/gi, "&")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  /*
   * Yahoo may put:
   *
   * "my reply    En sábado, ... escribió:"
   *
   * on ONE line, so first cut the text anywhere the quoted
   * message marker begins.
   */
  const quoteMarkers = [
    /\s+En\s+(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo),[\s\S]*?escribió:/i,
    /\s+El\s+[\s\S]*?escribió:/i,
    /\s+On\s+[\s\S]*?wrote:/i,
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\n-{2,}\s*Mensaje original\s*-{2,}/i,
    /\n(?:From|De):\s+/i,
    /\n(?:Sent|Enviado):\s+/i,
  ];

  let cutAt = cleaned.length;

  for (const marker of quoteMarkers) {
    const match = cleaned.match(marker);

    if (
      match &&
      typeof match.index === "number" &&
      match.index < cutAt
    ) {
      cutAt = match.index;
    }
  }

  cleaned = cleaned.slice(0, cutAt);

  /*
   * Additional protection for standard quoted lines.
   */
  const lines = cleaned.split("\n");
  const replyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith(">")) {
      break;
    }

    replyLines.push(line);
  }

  return replyLines
    .join("\n")
    .replace(/\\\|/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(
  html: string,
): string {
  return html
    .replace(
      /<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi,
      "\n",
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      "",
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      "",
    )
    .replace(
      /<[^>]+>/g,
      "",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#039;/gi,
      "'",
    )
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
}

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
