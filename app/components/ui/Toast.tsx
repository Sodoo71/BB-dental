"use client";
import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function Toast({
  toast,
}: {
  toast: { success: boolean; message: string };
}) {
  return (
    <div
      className={`fixed right-4 top-20 z-[80] flex max-w-sm gap-3 rounded-2xl border p-4 text-sm font-bold shadow-lg transition-all ${
        toast.success
          ? "border-brand-200 bg-brand-50 text-brand-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      {toast.success ? (
        <CheckCircle2 className="text-brand-600" />
      ) : (
        <XCircle className="text-red-600" />
      )}
      {toast.message}
    </div>
  );
}
