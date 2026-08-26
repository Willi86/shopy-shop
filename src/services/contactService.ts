import { supabase } from "../lib/supabase";

export type CreateSupportTicketInput = {
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  orderId?: string | null;
};

export type CreateSupportTicketResult = {
  ticketId: string;
  ticketNumber: number;
};

type EdgeFunctionResponse = {
  ticketId?: string;
  ticketNumber?: number;
  error?: string;
};

export async function createSupportTicket(
  input: CreateSupportTicketInput,
): Promise<CreateSupportTicketResult> {
  const { data, error } = await supabase.functions.invoke(
    "create-support-ticket",
    {
      body: {
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail.trim(),
        subject: input.subject.trim(),
        message: input.message.trim(),
        orderId: input.orderId ?? null,
      },
    },
  );

  if (error) {
    throw new Error(
      `Kunde inte skapa supportärendet: ${error.message}`,
    );
  }

  const response = data as EdgeFunctionResponse | null;

  if (response?.error) {
    throw new Error(response.error);
  }

  if (
    !response ||
    typeof response.ticketId !== "string" ||
    typeof response.ticketNumber !== "number"
  ) {
    throw new Error(
      "Supportärendet skapades inte korrekt.",
    );
  }

  return {
    ticketId: response.ticketId,
    ticketNumber: response.ticketNumber,
  };
}
