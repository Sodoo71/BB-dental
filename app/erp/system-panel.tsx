"use client";
import { useMessage } from "./ui";
import { useState } from "react";
import { Activity, Download, Save } from "lucide-react";
import { api, Feedback, LoadingSkeleton, useResource, type Entity } from "./ui";

type Health = {
  status: string;
  latencyMs: number;
  timestamp: string;
  counts: Record<string, number>;
};
export default function SystemPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useMessage();
  const {
    data: settings,
    error: loadError,
    loading,
    retry,
  } = useResource<{ items: Entity[] }>("/api/erp/settings");
  const policy = loaded
    ? autoApprove
    : !!settings?.items.some(
        (s) => s.key === "autoApproveDoctors" && s.value === "true",
      );
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <LoadingSkeleton />;
  if (loadError || !settings)
    return (
      <Feedback retry={retry}>
        {loadError || "Тохиргоо ачаалж чадсангүй."}
      </Feedback>
    );
  return (
    <div className="system-settings" aria-busy={busy}>
      {busy && <p role="status">Үйлдлийг гүйцэтгэж байна…</p>}
      {error && (
        <p className="erp-alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="erp-toast" role="status">
          {message}
        </p>
      )}
      <section className="settings-section">
        <h2>Бүртгэлийн бодлого</h2>
        <p>
          Идэвхжүүлбэл шинээр бүртгүүлсэн эмч шууд нэвтэрнэ. Ресепшний
          бүртгэлийг админ хянана. Өмнөх хүлээгдэж буй бүртгэлүүдэд нөлөөлөхгүй.
        </p>
        <label className="system-policy">
          <input
            type="checkbox"
            checked={policy}
            disabled={loading || busy}
            onChange={(e) => {
              setLoaded(true);
              setAutoApprove(e.target.checked);
            }}
          />
          Шинэ эмчийн бүртгэлийг автоматаар зөвшөөрөх
        </label>
        <button
          className="erp-primary"
          disabled={loading || busy}
          onClick={() =>
            perform(async () => {
              await api("/api/erp/settings/autoApproveDoctors", "PATCH", {
                value: String(policy),
              });
              setMessage("Бүртгэлийн бодлого хадгалагдлаа.");
            })
          }
        >
          <Save size={16} />
          Бодлого хадгалах
        </button>
      </section>
      <section className="settings-section">
        <h2>Системийн холболт</h2>
        <p>Өгөгдлийн сангийн холболт болон бүртгэлийн тоог шалгана.</p>
        <button
          className="erp-secondary"
          disabled={busy}
          onClick={() =>
            perform(async () => {
              setHealth(await api<Health>("/api/erp/system-status"));
            })
          }
        >
          <Activity size={16} />
          Холболт шалгах
        </button>
        {health && (
          <div className="system-health" role="status">
            <strong>Холболт хэвийн · {health.latencyMs} мс</strong>
            <small>
              {new Date(health.timestamp).toLocaleString("mn-MN", {
                timeZone: "Asia/Ulaanbaatar",
              })}
            </small>
            <dl>
              {Object.entries(health.counts).map(([key, count]) => (
                <div key={key}>
                  <dt>
                    {{
                      users: "Ажилтан",
                      doctors: "Эмч",
                      patients: "Өвчтөн",
                      appointments: "Захиалга",
                      services: "Үйлчилгээ",
                    }[key] || key}
                  </dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
      <section className="settings-section">
        <h2>Эмнэлгийн өгөгдөл экспортлох</h2>
        <p>
          Өвчтөн, захиалга, эмчилгээ, санхүү, бараа материал болон тохиргоог
          JSON файл болгон татна. Нууц үг, session, сэргээх token болон
          integration түлхүүрүүд орохгүй. Энэ нь өгөгдлийн санг бүрэн сэргээх
          backup биш.
        </p>
        <button
          className="erp-secondary"
          disabled={busy}
          onClick={() =>
            perform(async () => {
              const response = await fetch("/api/export/data", {
                cache: "no-store",
              });
              if (!response.ok)
                throw new Error(
                  (await response.json()).error || "Экспорт амжилтгүй.",
                );
              const url = URL.createObjectURL(await response.blob());
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "bb-dental-data.json";
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMessage("Өгөгдлийн JSON файл татагдлаа.");
            })
          }
        >
          <Download size={16} />
          JSON татах
        </button>
      </section>
    </div>
  );
}
