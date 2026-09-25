"use client";
import { LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/components/ui/Toast";
export default function LogoutButton({ label = "Гарах" }: { label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const handleLogout = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      router.push("/login"); router.refresh();
    } catch { showToast("Системээс гарч чадсангүй. Дахин оролдоно уу.", "error"); }
    finally { setPending(false); }
  };
  return <button type="button" disabled={pending} onClick={handleLogout} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60">{pending ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}{label}</button>;
}
