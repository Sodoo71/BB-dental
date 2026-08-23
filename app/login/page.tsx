"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import Image from "next/image";
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
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-blue-900 to-blue-600 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[28px] bg-white p-7 shadow-2xl sm:p-9"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo.jpg"
            alt="BB Dental Clinic"
            width={120}
            height={40}
            priority
            className="mx-auto h-12 w-auto rounded-2xl object-contain"
          />
          <h1 className="mt-3 text-3xl font-black text-slate-900">
            Удирдлагын нэвтрэх хэсэг
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Эрхтэй хэрэглэгчийн мэдээллээр нэвтэрнэ үү.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <label className="mb-4 block text-sm font-bold text-slate-700">
          Имэйл
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
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
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Нэвтрэх
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Шинэ хэрэглэгч үү?{" "}
          <Link
            href="/register"
            className="font-bold text-blue-600 underline hover:text-blue-700"
          >
            Бүртгүүлэх (Sign Up)
          </Link>
        </p>
      </form>
    </main>
  );
}
