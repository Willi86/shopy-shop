import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { Link } from "react-router";

import { useToast } from "../components/ui/useToast";
import { useAuth } from "../features/auth/useAuth";

import {
  addAdminSupportReply,
  getAdminSupportTickets,
  getSupportTicketMessages,
  updateSupportTicket,
  type AdminSupportTicket,
  type SupportTicketMessage,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from "../services/adminSupportService";

type TicketDraft = {
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
};

type StatusFilter =
  | "all"
  | SupportTicketStatus;

const statusOptions: {
  value: SupportTicketStatus;
  label: string;
}[] = [
  {
    value: "new",
    label: "Nytt",
  },
  {
    value: "open",
    label: "Öppet",
  },
  {
    value: "waiting_for_customer",
    label: "Väntar på kund",
  },
  {
    value: "resolved",
    label: "Löst",
  },
  {
    value: "closed",
    label: "Stängt",
  },
];

const priorityOptions: {
  value: SupportTicketPriority;
  label: string;
}[] = [
  {
    value: "low",
    label: "Låg",
  },
  {
    value: "normal",
    label: "Normal",
  },
  {
    value: "high",
    label: "Hög",
  },
  {
    value: "urgent",
    label: "Akut",
  },
];

const statusLabels: Record<
  SupportTicketStatus,
  string
> = {
  new: "Nytt",
  open: "Öppet",
  waiting_for_customer:
    "Väntar på kund",
  resolved: "Löst",
  closed: "Stängt",
};

const priorityLabels: Record<
  SupportTicketPriority,
  string
> = {
  low: "Låg",
  normal: "Normal",
  high: "Hög",
  urgent: "Akut",
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString(
    "sv-SE",
  );
}

function createTicketDraft(
  ticket: AdminSupportTicket,
): TicketDraft {
  return {
    status: ticket.status,
    priority: ticket.priority,
  };
}

function AdminSupportPage() {
  const { user, role } = useAuth();
  const { showToast } = useToast();

  const [tickets, setTickets] =
    useState<AdminSupportTicket[]>([]);

  const [selectedTicketId, setSelectedTicketId] =
    useState<string | null>(null);

  const [messages, setMessages] =
    useState<SupportTicketMessage[]>([]);

  const [draft, setDraft] =
    useState<TicketDraft | null>(null);

  const [reply, setReply] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isLoadingMessages, setIsLoadingMessages] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isSendingReply, setIsSendingReply] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const selectedTicket =
    tickets.find(
      (ticket) =>
        ticket.id === selectedTicketId,
    ) ?? null;

  const filteredTickets =
    useMemo(() => {
      const normalizedSearch =
        searchQuery
          .trim()
          .toLowerCase();

      return tickets.filter(
        (ticket) => {
          if (
            statusFilter !== "all" &&
            ticket.status !== statusFilter
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          const searchableValue = [
            String(ticket.ticketNumber),
            ticket.customerName,
            ticket.customerEmail,
            ticket.subject,
            ticket.orderId ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return searchableValue.includes(
            normalizedSearch,
          );
        },
      );
    }, [
      tickets,
      searchQuery,
      statusFilter,
    ]);

  const ticketCounts =
    useMemo(() => {
      return {
        all: tickets.length,

        new: tickets.filter(
          (ticket) =>
            ticket.status === "new",
        ).length,

        open: tickets.filter(
          (ticket) =>
            ticket.status === "open",
        ).length,

        waiting: tickets.filter(
          (ticket) =>
            ticket.status ===
            "waiting_for_customer",
        ).length,

        resolved: tickets.filter(
          (ticket) =>
            ticket.status === "resolved",
        ).length,
      };
    }, [tickets]);

  useEffect(() => {
    let cancelled = false;

    getAdminSupportTickets()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setTickets(data);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Kunde inte ladda supportärenden.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadTickets() {
    const data =
      await getAdminSupportTickets();

    setTickets(data);

    return data;
  }

  async function loadTicket(
    ticket: AdminSupportTicket,
  ) {
    try {
      setSelectedTicketId(ticket.id);
      setDraft(
        createTicketDraft(ticket),
      );

      setReply("");
      setIsLoadingMessages(true);

      const ticketMessages =
        await getSupportTicketMessages(
          ticket.id,
        );

      setMessages(ticketMessages);
    } catch (loadError) {
      showToast({
        title:
          "Kunde inte öppna ärendet",

        description:
          loadError instanceof Error
            ? loadError.message
            : "Ett oväntat fel inträffade.",

        variant: "error",
      });
    } finally {
      setIsLoadingMessages(false);
    }
  }

  function closeTicket() {
    setSelectedTicketId(null);
    setDraft(null);
    setMessages([]);
    setReply("");
  }

  function handleStatusChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const value =
      event.target
        .value as SupportTicketStatus;

    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            status: value,
          }
        : currentDraft,
    );
  }

  function handlePriorityChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const value =
      event.target
        .value as SupportTicketPriority;

    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            priority: value,
          }
        : currentDraft,
    );
  }

  async function handleSaveTicket() {
    if (
      !selectedTicket ||
      !draft
    ) {
      return;
    }

    try {
      setIsSaving(true);

      await updateSupportTicket({
        ticketId:
          selectedTicket.id,

        status: draft.status,
        priority: draft.priority,
      });

      const updatedTickets =
        await reloadTickets();

      const updatedTicket =
        updatedTickets.find(
          (ticket) =>
            ticket.id ===
            selectedTicket.id,
        );

      if (updatedTicket) {
        setDraft(
          createTicketDraft(
            updatedTicket,
          ),
        );
      }

      showToast({
        title:
          "Supportärendet har uppdaterats",

        description:
          `Ärende #${selectedTicket.ticketNumber} har sparats.`,

        variant: "success",
      });
    } catch (saveError) {
      showToast({
        title:
          "Kunde inte uppdatera ärendet",

        description:
          saveError instanceof Error
            ? saveError.message
            : "Ett oväntat fel inträffade.",

        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendReply() {
    if (!selectedTicket) {
      return;
    }

    const trimmedReply =
      reply.trim();

    if (!trimmedReply) {
      showToast({
        title: "Skriv ett svar",
        description:
          "Svaret kan inte vara tomt.",
        variant: "error",
      });

      return;
    }

    try {
      setIsSendingReply(true);

      await addAdminSupportReply(
        selectedTicket.id,
        trimmedReply,
      );

      /*
       * A new ticket becomes open automatically from
       * the admin workflow when the first reply is sent.
       */
      if (
        selectedTicket.status === "new"
      ) {
        await updateSupportTicket({
          ticketId:
            selectedTicket.id,

          status: "open",

          priority:
            draft?.priority ??
            selectedTicket.priority,
        });
      }

      const [
        updatedMessages,
        updatedTickets,
      ] = await Promise.all([
        getSupportTicketMessages(
          selectedTicket.id,
        ),

        getAdminSupportTickets(),
      ]);

      setMessages(updatedMessages);
      setTickets(updatedTickets);
      setReply("");

      const updatedTicket =
        updatedTickets.find(
          (ticket) =>
            ticket.id ===
            selectedTicket.id,
        );

      if (updatedTicket) {
        setDraft(
          createTicketDraft(
            updatedTicket,
          ),
        );
      }

      showToast({
        title: "Svar sparat",
        description:
          `Ditt svar har lagts till i ärende #${selectedTicket.ticketNumber}.`,
        variant: "success",
      });
    } catch (replyError) {
      showToast({
        title:
          "Kunde inte skicka svaret",

        description:
          replyError instanceof Error
            ? replyError.message
            : "Ett oväntat fel inträffade.",

        variant: "error",
      });
    } finally {
      setIsSendingReply(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 lg:py-12">
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Adminpanel
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
            Support
          </h1>

          <p className="mt-3 text-slate-600">
            Inloggad som {user?.email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-[background-color,transform] hover:bg-slate-50 active:scale-[0.98]"
          >
            Ordrar
          </Link>

          <Link
            to="/admin/products"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-[background-color,transform] hover:bg-slate-50 active:scale-[0.98]"
          >
            Produkter
          </Link>

          <span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold capitalize text-white">
            {role}
          </span>
        </div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() =>
            setStatusFilter("all")
          }
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "all"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold opacity-70">
            Alla
          </p>

          <p className="mt-1 text-2xl font-bold">
            {ticketCounts.all}
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter("new")
          }
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "new"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold opacity-70">
            Nya
          </p>

          <p className="mt-1 text-2xl font-bold">
            {ticketCounts.new}
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter("open")
          }
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "open"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold opacity-70">
            Öppna
          </p>

          <p className="mt-1 text-2xl font-bold">
            {ticketCounts.open}
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(
              "waiting_for_customer",
            )
          }
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter ===
            "waiting_for_customer"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold opacity-70">
            Väntar
          </p>

          <p className="mt-1 text-2xl font-bold">
            {ticketCounts.waiting}
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter("resolved")
          }
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "resolved"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold opacity-70">
            Lösta
          </p>

          <p className="mt-1 text-2xl font-bold">
            {ticketCounts.resolved}
          </p>
        </button>
      </section>

      <div className="mt-6">
        <label
          htmlFor="support-search"
          className="sr-only"
        >
          Sök supportärende
        </label>

        <input
          id="support-search"
          type="search"
          value={searchQuery}
          onChange={(event) =>
            setSearchQuery(
              event.target.value,
            )
          }
          placeholder="Sök på ärendenummer, kund, e-post, ämne eller order-ID..."
          className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3.5 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
        />
      </div>

      {isLoading && (
        <div className="mt-6 space-y-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-3xl bg-slate-200"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {!isLoading &&
        !error &&
        filteredTickets.length ===
          0 && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <h2 className="text-xl font-bold text-slate-950">
              Inga supportärenden
            </h2>

            <p className="mt-2 text-slate-600">
              Det finns inga ärenden som
              matchar filtret.
            </p>
          </div>
        )}

      {!isLoading &&
        !error &&
        filteredTickets.length > 0 && (
          <div className="mt-6 space-y-4">
            {filteredTickets.map(
              (ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold text-white">
                          #
                          {
                            ticket.ticketNumber
                          }
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {
                            statusLabels[
                              ticket
                                .status
                            ]
                          }
                        </span>

                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          {
                            priorityLabels[
                              ticket
                                .priority
                            ]
                          }
                        </span>
                      </div>

                      <h2 className="mt-3 text-lg font-bold text-slate-950">
                        {ticket.subject}
                      </h2>

                      <p className="mt-2 text-sm text-slate-600">
                        {
                          ticket.customerName
                        }{" "}
                        ·{" "}
                        {
                          ticket.customerEmail
                        }
                      </p>

                      {ticket.orderId && (
                        <p className="mt-2 break-all font-mono text-xs text-slate-400">
                          Order:{" "}
                          {
                            ticket.orderId
                          }
                        </p>
                      )}

                      <p className="mt-3 text-xs text-slate-400">
                        Uppdaterad{" "}
                        {formatDate(
                          ticket.updatedAt,
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void loadTicket(
                          ticket,
                        )
                      }
                      className="shrink-0 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-slate-800 active:scale-[0.98]"
                    >
                      Öppna ärende
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        )}

      {selectedTicket && draft && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur sm:p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold text-white">
                      #
                      {
                        selectedTicket.ticketNumber
                      }
                    </span>

                    <span className="text-sm font-semibold text-slate-500">
                      Supportärende
                    </span>
                  </div>

                  <h2 className="mt-3 text-2xl font-bold text-slate-950">
                    {
                      selectedTicket.subject
                    }
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    {
                      selectedTicket.customerName
                    }{" "}
                    ·{" "}
                    {
                      selectedTicket.customerEmail
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeTicket}
                  aria-label="Stäng ärende"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="p-5 sm:p-6">
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="support-status"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Status
                  </label>

                  <select
                    id="support-status"
                    value={
                      draft.status
                    }
                    disabled={isSaving}
                    onChange={
                      handleStatusChange
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                  >
                    {statusOptions.map(
                      (option) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {
                            option.label
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="support-priority"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Prioritet
                  </label>

                  <select
                    id="support-priority"
                    value={
                      draft.priority
                    }
                    disabled={isSaving}
                    onChange={
                      handlePriorityChange
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                  >
                    {priorityOptions.map(
                      (option) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {
                            option.label
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {selectedTicket.orderId && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Relaterad order
                    </p>

                    <p className="mt-1 break-all font-mono text-sm text-slate-700">
                      {
                        selectedTicket.orderId
                      }
                    </p>
                  </div>
                )}

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      void handleSaveTicket()
                    }
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    {isSaving
                      ? "Sparar..."
                      : "Spara status"}
                  </button>
                </div>
              </div>

              <section className="mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-950">
                    Konversation
                  </h3>

                  {!isLoadingMessages && (
                    <span className="text-sm text-slate-400">
                      {
                        messages.length
                      }{" "}
                      meddelanden
                    </span>
                  )}
                </div>

                {isLoadingMessages ? (
                  <div className="mt-5 space-y-3">
                    {Array.from({
                      length: 3,
                    }).map(
                      (_, index) => (
                        <div
                          key={index}
                          className="h-24 animate-pulse rounded-2xl bg-slate-100"
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {messages.map(
                      (message) => {
                        const isAdmin =
                          message.senderType ===
                          "admin";

                        return (
                          <div
                            key={
                              message.id
                            }
                            className={`flex ${
                              isAdmin
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <article
                              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                isAdmin
                                  ? "bg-slate-950 text-white"
                                  : "border border-slate-200 bg-slate-50 text-slate-950"
                              }`}
                            >
                              <p
                                className={`text-xs font-bold uppercase tracking-wide ${
                                  isAdmin
                                    ? "text-slate-300"
                                    : "text-slate-500"
                                }`}
                              >
                                {isAdmin
                                  ? "Admin"
                                  : "Kund"}
                              </p>

                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                {
                                  message.message
                                }
                              </p>

                              <p
                                className={`mt-2 text-xs ${
                                  isAdmin
                                    ? "text-slate-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {formatDate(
                                  message.createdAt,
                                )}
                              </p>
                            </article>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </section>

              <section className="mt-8 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="admin-support-reply"
                    className="font-bold text-slate-950"
                  >
                    Svara kunden
                  </label>

                  <span className="text-xs text-slate-400">
                    {reply.length}
                    /5000
                  </span>
                </div>

                <textarea
                  id="admin-support-reply"
                  rows={6}
                  maxLength={5000}
                  value={reply}
                  disabled={
                    isSendingReply
                  }
                  onChange={(event) =>
                    setReply(
                      event.target.value,
                    )
                  }
                  placeholder="Skriv ditt svar..."
                  className="mt-3 w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                />

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={
                      isSendingReply ||
                      !reply.trim()
                    }
                    onClick={() =>
                      void handleSendReply()
                    }
                    className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-[background-color,transform] hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isSendingReply
                      ? "Skickar..."
                      : "Skicka svar"}
                  </button>
                </div>
              </section>

              <div className="mt-8 grid gap-3 border-t border-slate-200 pt-5 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Skapad
                  </p>

                  <p className="mt-1 text-slate-700">
                    {formatDate(
                      selectedTicket.createdAt,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Löst
                  </p>

                  <p className="mt-1 text-slate-700">
                    {formatDate(
                      selectedTicket.resolvedAt,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Stängt
                  </p>

                  <p className="mt-1 text-slate-700">
                    {formatDate(
                      selectedTicket.closedAt,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default AdminSupportPage;