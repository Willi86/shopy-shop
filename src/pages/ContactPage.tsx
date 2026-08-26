import { useState, type ChangeEvent, type FormEvent } from "react";

import { useToast } from "../components/ui/useToast";

import {
  createSupportTicket,
  type CreateSupportTicketInput,
} from "../services/contactService";

const initialForm: CreateSupportTicketInput = {
  customerName: "",
  customerEmail: "",
  subject: "",
  message: "",
  orderId: null,
};

function ContactPage() {
  const { showToast } = useToast();

  const [form, setForm] = useState<CreateSupportTicketInput>(initialForm);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createdTicketNumber, setCreatedTicketNumber] = useState<number | null>(
    null,
  );

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function validateForm(): string | null {
    if (
      form.customerName.trim().length < 2 ||
      form.customerName.trim().length > 100
    ) {
      return "Namnet måste innehålla mellan 2 och 100 tecken.";
    }

    if (
      form.customerEmail.trim().length < 5 ||
      form.customerEmail.trim().length > 254 ||
      !form.customerEmail.includes("@")
    ) {
      return "Ange en giltig e-postadress.";
    }

    if (form.subject.trim().length < 3 || form.subject.trim().length > 150) {
      return "Ämnet måste innehålla mellan 3 och 150 tecken.";
    }

    if (form.message.trim().length < 10 || form.message.trim().length > 5000) {
      return "Meddelandet måste innehålla mellan 10 och 5000 tecken.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      showToast({
        title: "Kontrollera formuläret",
        description: validationError,
        variant: "error",
      });

      return;
    }

    try {
      setIsSubmitting(true);
      setCreatedTicketNumber(null);

      const result = await createSupportTicket(form);

      setCreatedTicketNumber(result.ticketNumber);

      setForm(initialForm);

      showToast({
        title: "Supportärendet har skapats",
        description: `Ditt ärendenummer är #${result.ticketNumber}.`,
        variant: "success",
        duration: 6000,
      });
    } catch (error) {
      showToast({
        title: "Kunde inte skapa supportärendet",
        description:
          error instanceof Error
            ? error.message
            : "Ett oväntat fel inträffade.",
        variant: "error",
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12 lg:py-16">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <section>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Support
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            Hur kan vi hjälpa dig?
          </h1>

          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
            Har du frågor om en produkt, specialbeställning, leverans, retur
            eller en befintlig order? Skapa ett supportärende så får du ett
            ärendenummer som används för fortsatt kontakt.
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">
                Produktfrågor
              </p>

              <p className="mt-1 font-bold text-slate-950">
                Anpassningar och specialbeställningar
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Orderhjälp</p>

              <p className="mt-1 font-bold text-slate-950">
                Leverans, retur, ersättningsvara och orderstatus
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">
                Supportärende
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                När du skickar formuläret skapas ett ärende med ett unikt
                ärendenummer.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {createdTicketNumber !== null && (
            <div
              role="status"
              className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
            >
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
                Ärende skapat
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Tack! Ditt ärende är #{createdTicketNumber}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Spara gärna ärendenumret om du behöver hänvisa till ärendet
                senare.
              </p>
            </div>
          )}

          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            Skapa supportärende
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Fyll i formuläret så sparas ditt ärende i vårt supportsystem.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="customerName"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Namn
              </label>

              <input
                id="customerName"
                name="customerName"
                type="text"
                value={form.customerName}
                onChange={updateField}
                required
                maxLength={100}
                autoComplete="name"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Ditt namn"
              />
            </div>

            <div>
              <label
                htmlFor="customerEmail"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                E-post
              </label>

              <input
                id="customerEmail"
                name="customerEmail"
                type="email"
                value={form.customerEmail}
                onChange={updateField}
                required
                maxLength={254}
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="namn@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="subject"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Ämne
              </label>

              <input
                id="subject"
                name="subject"
                type="text"
                value={form.subject}
                onChange={updateField}
                required
                maxLength={150}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Vad gäller ditt ärende?"
              />
            </div>

            <div>
              <label
                htmlFor="orderId"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Order-ID
                <span className="ml-2 font-normal text-slate-400">
                  Valfritt
                </span>
              </label>

              <input
                id="orderId"
                name="orderId"
                type="text"
                value={form.orderId ?? ""}
                onChange={updateField}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="UUID för ordern om ärendet gäller en beställning"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Lämna tomt om frågan inte gäller en specifik order.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <label
                  htmlFor="message"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Meddelande
                </label>

                <span className="text-xs text-slate-400">
                  {form.message.length}/5000
                </span>
              </div>

              <textarea
                id="message"
                name="message"
                rows={8}
                value={form.message}
                onChange={updateField}
                required
                maxLength={5000}
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                placeholder="Beskriv hur vi kan hjälpa dig..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] hover:bg-slate-800 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
              {isSubmitting ? "Skapar ärende..." : "Skicka supportärende"}
            </button>

            <p className="text-center text-xs leading-5 text-slate-400">
              Dina uppgifter används för att hantera och besvara ditt ärende.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

export default ContactPage;
