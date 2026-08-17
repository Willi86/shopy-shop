import { useEffect, useState } from "react";

import { useAuth } from "../features/auth/useAuth";
import { getAdminOrders, type AdminOrder } from "../services/adminOrderService";

function AdminPage() {
  const { user, role } = useAuth();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        setError(null);

        const data = await getAdminOrders();

        setOrders(data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Kunde inte ladda ordrar.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadOrders();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Adminpanel
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
            Ordrar
          </h1>

          <p className="mt-3 text-slate-600">Inloggad som {user?.email}</p>
        </div>

        <span className="inline-flex w-fit rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white">
          {role}
        </span>
      </div>

      {isLoading && (
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-3xl bg-slate-200"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-xl font-bold text-slate-950">Inga ordrar ännu</h2>

          <p className="mt-2 text-slate-600">
            Nya beställningar kommer att visas här.
          </p>
        </div>
      )}

      {!isLoading && !error && orders.length > 0 && (
        <div className="mt-8 space-y-6">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Order</p>

                  <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">
                    {order.id}
                  </p>
                </div>

                <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                  {order.status}
                </span>
              </div>

              <div className="mt-6 grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-2">
                <div>
                  <h2 className="font-bold text-slate-950">Kund</h2>

                  <p className="mt-2 text-slate-700">{order.customerName}</p>

                  <p className="text-sm text-slate-500">
                    {order.customerEmail}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {order.customerAddress}, {order.postalCode} {order.city}
                  </p>
                </div>

                <div>
                  <h2 className="font-bold text-slate-950">Produkter</h2>

                  <div className="mt-2 space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-4 text-sm"
                      >
                        <span className="text-slate-600">
                          {item.productName} × {item.quantity}
                        </span>

                        <span className="font-semibold text-slate-950">
                          {(item.price * item.quantity).toLocaleString("sv-SE")}{" "}
                          kr
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-slate-200 pt-6">
                <p className="text-lg font-bold text-slate-950">
                  Totalt: {order.totalPrice.toLocaleString("sv-SE")} kr
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default AdminPage;
