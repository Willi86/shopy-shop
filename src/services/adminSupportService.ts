import { supabase } from "../lib/supabase";

export type SupportTicketStatus =
  | "new"
  | "open"
  | "waiting_for_customer"
  | "resolved"
  | "closed";

export type SupportTicketPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type SupportMessageSenderType =
  | "customer"
  | "admin"
  | "system";

export type AdminSupportTicket = {
  id: string;
  ticketNumber: number;
  userId: string | null;
  orderId: string | null;
  customerName: string;
  customerEmail: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
};

export type SupportTicketMessage = {
  id: string;
  ticketId: string;
  senderType: SupportMessageSenderType;
  senderUserId: string | null;
  message: string;
  createdAt: string;
};

type SupportTicketRow = {
  id: string;
  ticket_number: number;
  user_id: string | null;
  order_id: string | null;
  customer_name: string;
  customer_email: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
};

type SupportMessageRow = {
  id: string;
  ticket_id: string;
  sender_type: SupportMessageSenderType;
  sender_user_id: string | null;
  message: string;
  created_at: string;
};

function mapTicket(
  row: SupportTicketRow,
): AdminSupportTicket {
  return {
    id: row.id,
    ticketNumber: Number(row.ticket_number),
    userId: row.user_id,
    orderId: row.order_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
  };
}

function mapMessage(
  row: SupportMessageRow,
): SupportTicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderType: row.sender_type,
    senderUserId: row.sender_user_id,
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function getAdminSupportTickets(): Promise<
  AdminSupportTicket[]
> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select(`
      id,
      ticket_number,
      user_id,
      order_id,
      customer_name,
      customer_email,
      subject,
      status,
      priority,
      assigned_to,
      created_at,
      updated_at,
      resolved_at,
      closed_at
    `)
    .order("updated_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Kunde inte ladda supportärenden: ${error.message}`,
    );
  }

  return (data as SupportTicketRow[]).map(
    mapTicket,
  );
}

export async function getSupportTicketMessages(
  ticketId: string,
): Promise<SupportTicketMessage[]> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select(`
      id,
      ticket_id,
      sender_type,
      sender_user_id,
      message,
      created_at
    `)
    .eq("ticket_id", ticketId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Kunde inte ladda konversationen: ${error.message}`,
    );
  }

  return (data as SupportMessageRow[]).map(
    mapMessage,
  );
}

type UpdateSupportTicketInput = {
  ticketId: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
};

export async function updateSupportTicket(
  input: UpdateSupportTicketInput,
): Promise<void> {
  const now = new Date().toISOString();

  const updates: {
    status: SupportTicketStatus;
    priority: SupportTicketPriority;
    resolved_at?: string | null;
    closed_at?: string | null;
  } = {
    status: input.status,
    priority: input.priority,
  };

  if (input.status === "resolved") {
    updates.resolved_at = now;
    updates.closed_at = null;
  } else if (input.status === "closed") {
    updates.closed_at = now;
  } else {
    updates.resolved_at = null;
    updates.closed_at = null;
  }

  const { error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", input.ticketId);

  if (error) {
    throw new Error(
      `Kunde inte uppdatera supportärendet: ${error.message}`,
    );
  }
}

export async function addAdminSupportReply(
  ticketId: string,
  message: string,
): Promise<void> {
  const trimmedMessage = message.trim();

  if (
    trimmedMessage.length < 1 ||
    trimmedMessage.length > 5000
  ) {
    throw new Error(
      "Svaret måste innehålla mellan 1 och 5000 tecken.",
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "send-support-reply",
    {
      body: {
        ticketId,
        message: trimmedMessage,
      },
    },
  );

  if (error) {
    throw new Error(
      `Kunde inte skicka svaret: ${error.message}`,
    );
  }

  if (data?.error) {
    throw new Error(
      data.error,
    );
  }
}
