import { create } from "zustand";
import { ErrorKind } from "../lib/errors";

export type Toast = {
  id: string;
  kind: ErrorKind;
  message: string;
  /** Whether the toast is in its exit animation */
  dismissing: boolean;
};

type ToastsStore = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "dismissing">) => void;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
};

const AUTO_DISMISS_KINDS: ErrorKind[] = ["not_found", "network", "invalid_input"];
const AUTO_DISMISS_MS = 4000;
const EXIT_ANIMATION_MS = 350;

export const useToasts = create<ToastsStore>((set, get) => ({
  toasts: [],

  addToast: ({ kind, message }) => {
    const id = crypto.randomUUID();

    set((state) => ({
      toasts: [...state.toasts, { id, kind, message, dismissing: false }],
    }));

    if (AUTO_DISMISS_KINDS.includes(kind)) {
      setTimeout(() => get().dismissToast(id), AUTO_DISMISS_MS);
    }
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, dismissing: true } : t
      ),
    }));
    setTimeout(() => get().removeToast(id), EXIT_ANIMATION_MS);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
