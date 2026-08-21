"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      router.replace("/admin");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Сервертэй холбогдож чадсангүй.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-950 via-teal-800 to-emerald-600 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[28px] bg-white p-7 shadow-2xl sm:p-9"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
            ✦
          </div>
          <p className="mt-4 text-xs font-bold tracking-[.2em] text-emerald-600">
            SMILECARE
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">
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
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 outline-none focus:border-emerald-500"
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
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400"
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
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}Нэвтрэх
        </button>
      </form>
    </main>
  );
}
