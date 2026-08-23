"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
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

      router.replace("/login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Бүртгэл үүсгэхэд алдаа гарлаа.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-blue-900 to-blue-600 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-[28px] bg-white p-7 shadow-2xl sm:p-9"
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
            Бүртгэл үүсгэх
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Админ баталгаажуулалт хүлээнэ үү.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
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
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
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
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="DOCTOR">DOCTOR</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </label>
        </div>

        <button
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Бүртгүүлэх
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Бүртгэлтэй юу?{" "}
          <Link
            href="/login"
            className="font-bold text-blue-600 underline hover:text-blue-700"
          >
            Нэвтрэх
          </Link>
        </p>
      </form>
    </main>
  );
}
