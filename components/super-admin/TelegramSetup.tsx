"use client";
import { useState } from "react";

export function TelegramSetup() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(connect: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/telegram/setup", { method: connect ? "POST" : "GET" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Холболтыг шалгаж чадсангүй.");
      setMessage(connect ? data.message : !data.data.url ? "Холболт хийгдээгүй. Telegram холбох товчийг дарна уу." : `Холбогдсон: ${data.data.url}${data.data.lastError ? ` · Сүүлийн алдаа: ${data.data.lastError}` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Холболт амжилтгүй."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
    <p className="text-sm font-semibold text-brand-900">Баталгаажуулах / цуцлах товчны холболт</p>
    <p className="text-xs text-slate-600">Нийтэд нээлттэй сайт дээрээс нэг удаа холбоно. Дараа нь Telegram-ийн товчоор захиалгын төлөвийг өөрчилж болно.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => run(false)} className="button-secondary">Холболт шалгах</button><button type="button" disabled={busy} onClick={() => run(true)} className="button-primary">{busy ? "Уншиж байна…" : "Telegram холбох"}</button></div>
    {message && <p role="status" className="break-words text-xs text-brand-900">{message}</p>}
  </div>;
}
