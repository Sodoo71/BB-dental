"use client";
import { useState } from "react";
import type { PatientForm, ToastState } from "../types/booking";

export default function useBooking() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [result, setResult] = useState<ToastState>(null);
  const [form, setForm] = useState<PatientForm>({
    fullName: "",
    phone: "",
    age: "",
    gender: "MALE",
    startTime: "",
    chiefComplaint: "",
  });

  const notify = (success: boolean, message: string) => {
    setToast({ success, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const resetForm = () =>
    setForm({
      fullName: "",
      phone: "",
      age: "",
      gender: "MALE",
      startTime: "",
      chiefComplaint: "",
    });

  return {
    open,
    setOpen,
    sending,
    setSending,
    toast,
    setToast,
    result,
    setResult,
    form,
    setForm,
    notify,
    resetForm,
  } as const;
}
