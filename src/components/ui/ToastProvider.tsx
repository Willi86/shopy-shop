import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router";

import {
  ToastContext,
  type Toast,
  type ToastInput,
} from "./toastContext";

type ToastProviderProps = {
  children: ReactNode;
};

const DEFAULT_DURATION = 3500;
const MAX_TOASTS = 4;

function ToastIcon({
  variant,
}: {
  variant: Toast["variant"];
}) {
  if (variant === "error") {
    return (
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg font-bold text-red-700"
      >
        !
      </span>
    );
  }

  if (variant === "info") {
    return (
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700"
      >
        i
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700"
    >
      ✓
    </span>
  );
}

export function ToastProvider({
  children,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const timeoutIds = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );

    const timeoutId = timeoutIds.current.get(toastId);

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIds.current.delete(toastId);
    }
  }, []);

  const showToast = useCallback(
    (input: ToastInput): string => {
      const id = crypto.randomUUID();

      const toast: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "success",
        action: input.action,
        duration: input.duration ?? DEFAULT_DURATION,
      };

      setToasts((currentToasts) => {
        const nextToasts = [...currentToasts, toast];

        return nextToasts.slice(-MAX_TOASTS);
      });

      const timeoutId = setTimeout(() => {
        dismissToast(id);
      }, toast.duration);

      timeoutIds.current.set(id, timeoutId);

      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    const currentTimeoutIds = timeoutIds.current;

    return () => {
      currentTimeoutIds.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });

      currentTimeoutIds.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        dismissToast,
      }}
    >
      {children}

      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-100 flex flex-col items-end gap-3 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className="pointer-events-auto w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/10"
          >
            <div className="flex items-start gap-3">
              <ToastIcon variant={toast.variant} />

              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-950">
                  {toast.title}
                </p>

                {toast.description && (
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {toast.description}
                  </p>
                )}

                {toast.action && (
                  <Link
                    to={toast.action.to}
                    onClick={() => dismissToast(toast.id)}
                    className="mt-3 inline-flex text-sm font-bold text-slate-950 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {toast.action.label} →
                  </Link>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Stäng meddelande"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}