"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

// Global event bus for non-hook usage
type ToastListener = (toast: ToastMessage) => void;
const listeners: Set<ToastListener> = new Set();

export function showToast(message: string, type: ToastType = "success", duration = 3500) {
  const toast: ToastMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    type,
    duration,
  };
  listeners.forEach((listener) => listener(toast));
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleNewToast: ToastListener = (newToast) => {
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 3500);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${
            toast.type === "success"
              ? "border-emerald-200 bg-white/95 text-emerald-950 shadow-emerald-500/10"
              : toast.type === "error"
                ? "border-red-200 bg-white/95 text-red-950 shadow-red-500/10"
                : "border-cyan-200 bg-white/95 text-cyan-950 shadow-cyan-500/10"
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === "success" && (
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            )}
            {toast.type === "error" && (
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <XCircle className="h-4 w-4" />
              </div>
            )}
            {toast.type === "info" && (
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                <Info className="h-4 w-4" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold leading-relaxed text-slate-800">
              {toast.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
