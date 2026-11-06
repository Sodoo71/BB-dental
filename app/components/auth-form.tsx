"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ClinicLogo } from "./clinic-branding";
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";
import PasswordInput from "./password-input";
import { api } from "../erp/ui";
import "../erp/erp.css";
export default function AuthForm({
  mode,
}: {
  mode: "register" | "forgot" | "reset";
}) {
  const [busy, setBusy] = useState(false);
  const [resetChannel, setResetChannel] = useState("telegram");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const title =
    mode === "register"
      ? "Ажилтны бүртгэл"
      : mode === "forgot"
        ? "Нууц үг мартсан уу?"
        : "Шинэ нууц үг";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data: Record<string, unknown> = Object.fromEntries(
      new FormData(form),
    );
    if (mode !== "forgot" && data.password !== data.passwordConfirmation) {
      setError("Давтан нууц үг таарахгүй байна.");
      return;
    }
    if (mode === "reset")
      data.token =
        new URLSearchParams(window.location.search).get("token") || "";
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>(
        `/api/auth/${mode === "register" ? "register" : mode === "forgot" ? "forgot-password" : "reset-password"}`,
        "POST",
        data,
      );
      setSuccess(result.message);
      form.reset();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-story">
        <ClinicLogo
          width={86}
          height={86}
          alt="BB Dental"
        />
        <span className="login-eyebrow">BB DENTAL · CLINIC WORKSPACE</span>
        <h1>
          Нэг баг.
          <br />
          Нэгдсэн ажлын орчин.
        </h1>
        <p>Эмч, ресепшн, админы ажлыг нэг дор холбоно.</p>
        <div className="login-role-pills">
          <span>Эмч</span>
          <span>Ресепшн</span>
          <span>Админ</span>
        </div>
      </div>
      <div className="login-form-side">
        <Link className="back-link" href="/login">
          <ArrowLeft size={17} />
          Нэвтрэх хэсэг
        </Link>
        <form
          className={`login-form ${mode === "register" ? "register-form" : ""}`}
          onSubmit={submit}
        >
          <div className="login-lock">
            {success ? <Check size={27} /> : <LockKeyhole size={27} />}
          </div>
          <p className="erp-kicker">BB DENTAL CLINIC</p>
          <h2>{title}</h2>
          <p>
            {mode === "register"
              ? "Анхны бүртгэл админ эрхтэй. Дараагийн бүртгэлийг админ хянана."
              : mode === "forgot"
                ? resetChannel === "telegram"
                  ? "Бүртгэлтэй утсаа оруулна уу. Сэргээх холбоос таны бүртгэлтэй Telegram руу очно."
                  : "Бүртгэлтэй имэйл рүү сэргээх холбоос илгээнэ."
                : "Шинэ нууц үгээ хоёр удаа оруулна уу."}
          </p>
          {success ? (
            <div className="auth-success" role="status">
              <p>{success}</p>
              <Link className="erp-primary" href="/login">
                Нэвтрэх <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              {mode === "register" && (
                <>
                  <label>
                    Овог нэр
                    <div className="login-input">
                      <input
                        name="name"
                        required
                        maxLength={200}
                        autoComplete="name"
                      />
                    </div>
                  </label>
                  <label>
                    Утасны дугаар
                    <div className="login-input">
                      <input
                        name="phone"
                        type="tel"
                        required
                        maxLength={15}
                        autoComplete="tel"
                        placeholder="8 оронтой утас"
                      />
                    </div>
                  </label>
                </>
              )}
              {mode === "forgot" && (
                <label>
                  Сэргээх арга
                  <div className="login-input">
                    <select
                      name="channel"
                      aria-label="Сэргээх арга"
                      value={resetChannel}
                      onChange={(e) => {
                        setResetChannel(e.target.value);
                        setError("");
                      }}
                    >
                      <option value="telegram">Telegram</option>
                      <option value="email">Имэйл</option>
                    </select>
                  </div>
                </label>
              )}
              {mode === "forgot" && resetChannel === "telegram" && (
                <>
                  <label>
                    Бүртгэлтэй утас
                    <div className="login-input">
                      <input
                        name="phone"
                        type="tel"
                        required
                        maxLength={15}
                        autoComplete="tel"
                        placeholder="8 оронтой утас"
                      />
                    </div>
                  </label>
                  <small className="telegram-help">
                    Эмнэлгийн bot дээр /start дарсан байх шаардлагатай. Холбоос
                    бүртгэл дээр хадгалсан хувийн Telegram Chat ID руу очно.
                  </small>
                </>
              )}
              {(mode === "register" ||
                (mode === "forgot" && resetChannel === "email")) && (
                <label>
                  Имэйл
                  <div className="login-input">
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                      placeholder="name@example.com"
                    />
                  </div>
                </label>
              )}
              {mode === "register" && (
                <>
                  <label>
                    Хүсэж буй эрх
                    <div className="login-input">
                      <select name="requestedRole" defaultValue="DOCTOR">
                        <option value="DOCTOR">Эмч</option>
                        <option value="RECEPTION">Ресепшн</option>
                      </select>
                    </div>
                  </label>
                  <label>
                    Telegram ID <small>(заавал биш)</small>
                    <div className="login-input">
                      <input
                        name="telegramChatId"
                        inputMode="numeric"
                        maxLength={20}
                        placeholder="Тоон Chat ID"
                      />
                    </div>
                  </label>
                  <small className="telegram-help">
                    Эмнэлгийн Telegram bot дээр /start дарсны дараа Chat ID-гаа
                    оруулна уу.
                  </small>
                </>
              )}
              {mode !== "forgot" && (
                <>
                  <label>
                    Нууц үг
                    <div className="login-input">
                      <PasswordInput
                        name="password"
                        required
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        placeholder="Хамгийн багадаа 8 тэмдэгт"
                      />
                    </div>
                  </label>
                  <label>
                    Нууц үг давтах
                    <div className="login-input">
                      <PasswordInput
                        name="passwordConfirmation"
                        visibilityLabel="Давтан нууц үг"
                        required
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                      />
                    </div>
                  </label>
                </>
              )}
              {error && (
                <div className="erp-alert" role="alert">
                  {error}
                </div>
              )}
              <button className="erp-primary" disabled={busy}>
                {busy
                  ? "Түр хүлээнэ үү…"
                  : mode === "register"
                    ? "Бүртгэл үүсгэх"
                    : mode === "forgot"
                      ? "Сэргээх холбоос авах"
                      : "Нууц үг шинэчлэх"}
                <ArrowRight size={17} />
              </button>
              <div className="auth-links">
                <Link href="/login">Нэвтрэх</Link>
                {mode !== "register" && (
                  <Link href="/register">Бүртгэл үүсгэх</Link>
                )}
              </div>
            </>
          )}
        </form>
        <span className="login-footer">© 2026 BB Dental Clinic</span>
      </div>
    </main>
  );
}
