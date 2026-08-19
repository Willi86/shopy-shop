import { createContext } from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastAction = {
  label: string;
  to: string;
};

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
};

export type Toast = ToastInput & {
  id: string;
};

export type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  dismissToast: (toastId: string) => void;
};

export const ToastContext = createContext<ToastContextValue | undefined>(
  undefined,
);