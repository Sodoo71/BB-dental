"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordInput from "../components/password-input";
import AuthStory, { AuthMobileBrand } from "../components/auth-story";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Phone } from "lucide-react";
export default function LoginPage() {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push("/erp");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Холболтын алдаа.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <AuthStory />
      <div className="login-form-side">
        <AuthMobileBrand />
        <Link href="/" className="back-link">
          <ArrowLeft size={17} /> Нүүр хуудас
        </Link>
        <form onSubmit={submit} className="login-form">
          <div className="login-lock">
            <LockKeyhole size={27} />
          </div>
          <p className="erp-kicker">АЖИЛТНЫ НЭВТРЭЛТ</p>
          <h2>Тавтай морилно уу</h2>
          <p>Бүртгэлтэй утас, нууц үгээ оруулна уу.</p>
          <label htmlFor="login-phone">
            Утасны дугаар
            <div className="login-input">
              <Phone size={18} />
              <input
                id="login-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                required
                placeholder="8 оронтой утас"
                maxLength={12}
              />
            </div>
          </label>
          <label htmlFor="login-password">
            Нууц үг
            <div className="login-input">
              <LockKeyhole size={18} />
              <PasswordInput
                id="login-password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="Нууц үг"
                maxLength={128}
              />
            </div>
          </label>
          {error && (
            <div
              role="alert"
              className="erp-alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {error}
            </div>
          )}
          <button className="erp-primary" disabled={busy}>
            {busy ? "Нэвтэрч байна…" : "Нэвтрэх"}
            <ArrowRight size={18} />
          </button>
          <div className="auth-links">
            <Link href="/forgot-password">Нууц үг мартсан?</Link>
            <Link href="/register">Бүртгэл үүсгэх</Link>
          </div>
          <small>Бүртгэлийг эмнэлгийн админ хянаж, идэвхжүүлнэ.</small>
        </form>
        <span className="login-footer">© 2026 BB Dental Clinic</span>
      </div>
    </main>
  );
}
