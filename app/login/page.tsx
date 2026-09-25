"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { getDashboardRouteForRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const redirectIfAuthenticated = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok || !active) return;

        const payload = await response.json();
        const destination = getDashboardRouteForRole(payload?.data?.role);

        if (destination !== "/login") {
          router.replace(destination);
        }
      } catch {
        // Ignore and keep the login page visible.
      }
    };

    void redirectIfAuthenticated();

    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Нэвтрэхэд алдаа гарлаа.");

      const destination = getDashboardRouteForRole(data.data?.role);
      router.replace(destination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Сервертэй холбогдож чадсангүй.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form
        onSubmit={submit}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="page-title">
            Системд нэвтрэх
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Эрхтэй хэрэглэгчийн мэдээллээр нэвтэрнэ үү.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <label className="mb-4 block text-sm font-bold text-slate-700">
          Имэйл
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              required
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="admin@example.com"
            />
          </div>
        </label>

        <label className="block text-sm font-bold text-slate-700">
          Нууц үг
          <div className="relative mt-1">
            <LockKeyhole className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              required
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              aria-label={showPassword ? "Нууц үг нуух" : "Нууц үг харах"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </label>

        <button
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Нэвтрэх
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Шинэ хэрэглэгч үү?{" "}
          <Link
            href="/register"
            className="font-bold text-brand-600 underline hover:text-brand-700"
          >
            Бүртгүүлэх
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
