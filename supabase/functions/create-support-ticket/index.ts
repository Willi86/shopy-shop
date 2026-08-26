import { createClient } from "npm:@supabase/supabase-js@2";

type CreateSupportTicketRequest = {
  customerName?: unknown;
  customerEmail?: unknown;
  subject?: unknown;
  message?: unknown;
  orderId?: unknown;
};

type TicketResult = {
  ticket_id: string;
  ticket_number: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function createJsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return createJsonResponse(
      {
        error: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return createJsonResponse(
        {
          error: "En giltig kundsession saknas.",
        },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        "Missing Supabase environment configuration.",
      );

      return createJsonResponse(
        {
          error: "Supporttjänsten är inte korrekt konfigurerad.",
        },
        500,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Could not verify support user:",
        userError?.message,
      );

      return createJsonResponse(
        {
          error: "Kundsessionen kunde inte verifieras.",
        },
        401,
      );
    }

    let body: CreateSupportTicketRequest;

    try {
      body = (await request.json()) as CreateSupportTicketRequest;
    } catch {
      return createJsonResponse(
        {
          error: "Ogiltig förfrågan.",
        },
        400,
      );
    }

    const customerName = getString(body.customerName);

    const customerEmail = getString(body.customerEmail)
      .toLowerCase();

    const subject = getString(body.subject);

    const message = getString(body.message);

    const orderId = body.orderId === null ||
        body.orderId === undefined ||
        body.orderId === ""
      ? null
      : getString(body.orderId);

    if (
      customerName.length < 2 ||
      customerName.length > 100
    ) {
      return createJsonResponse(
        {
          error: "Namnet måste innehålla mellan 2 och 100 tecken.",
        },
        400,
      );
    }

    if (
      customerEmail.length < 5 ||
      customerEmail.length > 254
    ) {
      return createJsonResponse(
        {
          error: "Ange en giltig e-postadress.",
        },
        400,
      );
    }

    if (
      subject.length < 3 ||
      subject.length > 150
    ) {
      return createJsonResponse(
        {
          error: "Ämnet måste innehålla mellan 3 och 150 tecken.",
        },
        400,
      );
    }

    if (
      message.length < 10 ||
      message.length > 5000
    ) {
      return createJsonResponse(
        {
          error: "Meddelandet måste innehålla mellan 10 och 5000 tecken.",
        },
        400,
      );
    }

    const { data, error } = await supabase.rpc(
      "create_support_ticket",
      {
        p_customer_name: customerName,

        p_customer_email: customerEmail,

        p_subject: subject,

        p_message: message,

        p_order_id: orderId,
      },
    );

    if (error) {
      console.error(
        "Failed to create support ticket:",
        error,
      );

      return createJsonResponse(
        {
          error: error.message,
        },
        400,
      );
    }

    const result = (data as TicketResult[] | null)?.[0];

    if (!result) {
      console.error(
        "Support RPC returned no ticket.",
      );

      return createJsonResponse(
        {
          error: "Ärendet kunde inte skapas.",
        },
        500,
      );
    }

    return createJsonResponse(
      {
        ticketId: result.ticket_id,

        ticketNumber: result.ticket_number,
      },
      201,
    );
  } catch (error) {
    console.error(
      "Unexpected support ticket error:",
      error,
    );

    return createJsonResponse(
      {
        error: "Ett oväntat fel inträffade.",
      },
      500,
    );
  }
});
