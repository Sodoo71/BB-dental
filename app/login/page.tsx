"use client";
import Link from "next/link";
import PasswordInput from "../components/password-input";
import { ClinicLogo } from "../components/clinic-branding";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Phone } from "lucide-react";
import "../erp/erp.css";
export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
      window.location.assign("/erp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Холболтын алдаа.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-story">
        <ClinicLogo
          alt="BB Dental"
          width={86}
          height={86}
        />
        <span className="login-eyebrow">BB DENTAL · CLINIC WORKSPACE</span>
        <h1>
          Эрүүл инээмсэглэлийн
          <br />
          ард, нэгдсэн баг.
        </h1>
        <p>
          Өвчтөн, эмчилгээ, цаг товлол болон санхүүгээ нэг ойлгомжтой орчноос
          удирдаарай.
        </p>
        <div className="login-role-pills">
          <span>Эмч</span>
          <span>Ресепшн</span>
          <span>Админ</span>
        </div>
      </div>
      <div className="login-form-side">
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
          <label>
            Утасны дугаар
            <div className="login-input">
              <Phone size={18} />
              <input
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
          <label>
            Нууц үг
            <div className="login-input">
              <LockKeyhole size={18} />
              <PasswordInput
                name="password"
                autoComplete="current-password"
                required
                placeholder="Нууц үг"
                maxLength={128}
              />
            </div>
          </label>
          {error && (
            <div role="alert" className="erp-alert">
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
