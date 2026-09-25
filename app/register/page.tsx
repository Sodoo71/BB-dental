"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";

export default function RegisterPage() {
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("DOCTOR");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Бүртгэл үүсгэхэд алдаа гарлаа.");
      }

      setSuccess(data.data.status === "ACTIVE" ? "Бүртгэл үүслээ. Та нэвтэрч болно." : "Бүртгэл үүслээ. Админ баталгаажуулалт хүлээнэ үү.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Бүртгэл үүсгэхэд алдаа гарлаа.",
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
            Бүртгэл үүсгэх
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Ажилтны бүртгэл үүсгэх
          </p>
        </div>

        {success && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success} <Link href="/login" className="underline">Нэвтрэх</Link></p>}
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Нэр
            <div className="relative mt-1">
              <UserRound className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                required
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="Батнасан"
              />
            </div>
          </label>

          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            И-мэйл
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                required
                autoComplete="email"
              type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="name@example.com"
              />
            </div>
          </label>

          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Нууц үг
            <div className="relative mt-1">
              <LockKeyhole className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                required
                minLength={12}
                maxLength={256}
                autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
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

          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Эхлэх эрх
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              <option value="DOCTOR">DOCTOR</option>
              <option value="RECEPTION">RECEPTION</option>
            </select>
          </label>
        </div>

        <button
          disabled={loading || Boolean(success)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Бүртгүүлэх
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Бүртгэлтэй юу?{" "}
          <Link
            href="/login"
            className="font-bold text-brand-600 underline hover:text-brand-700"
          >
            Нэвтрэх
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
