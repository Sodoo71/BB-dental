"use client";
import BrandLoader from "../components/brand-loader";
import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Save,
  Globe,
  Send,
  ImageIcon,
  ShieldCheck,
  RefreshCw,
  Link2,
  Unplug,
  ExternalLink,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import ImageUpload from "../components/image-upload";
import PasswordInput from "../components/password-input";
import { api, type Entity } from "./ui";
import { useUser } from "./shell";
const defaults: Record<string, string> = {
  clinicName: "BB Dental Clinic",
  phone: "9596-3531",
  email: "sodoosodbileg71@gmail.com",
  address:
    "БГД, 12-р хороо, 3, 4-р хороолол, Бичлийн аркны автобусны буудал дээр, Азифармтай эмийн сангийн 3 давхарт, BB Dental Clinic",
  hours: "Даваа–Баасан: 09:00–19:00 | Бямба–Ням: 10:00–18:00",
  footerDescription:
    "Танд болон таны гэр бүлд чанартай, сэтгэл ханамжтай шүдний тусламж үйлчилгээг үзүүлэхэд бид бэлэн байна.",
  footerHoursTitle: "Цагийн хуваарь",
  footerContactTitle: "Холбоо барих",
  footerBookingTitle: "Онлайн цаг захиалга",
  footerBookingLabel: "Одоо цаг авах",
  copyrightText: "© 2026 BB Dental Clinic. Бүх эрх хуулиар хамгаалагдсан.",
  reportTitle: "BB Dental Clinic тайлан",
  facebookUrl: "",
  instagramUrl: "",
  logoUrl: "",
};
type TelegramStatus = {
  configured: boolean;
  configurationError?: string;
  source: string;
  booking: boolean;
  transfer: boolean;
  recovery: boolean;
  canStoreToken: boolean;
  name: string;
  username: string;
};
export default function SettingsPanel() {
  const actor = useUser();
  const [tab, setTab] = useState("clinic"),
    [values, setValues] = useState(defaults),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    api<{ items: Entity[] }>("/api/erp/settings")
      .then((r) =>
        setValues({
          ...defaults,
          ...Object.fromEntries(r.items.map((i) => [i.key!, i.value || ""])),
        }),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);
  const field = (key: string, label: string, multiline = false) => (
    <label key={key}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          aria-label={label}
          maxLength={5000}
          value={values[key]}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      ) : (
        <input
          aria-label={label}
          type={key === "email" ? "email" : "text"}
          value={values[key]}
          maxLength={5000}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      )}
    </label>
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/erp/settings/clinic", "PATCH", values);
      setMessage("Эмнэлэг болон footer-ийн мэдээлэл хадгалагдлаа.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (actor.role !== "ADMIN")
    return <div className="erp-alert">Тохиргооны админ эрх шаардлагатай.</div>;
  return (
    <div className="settings-page">
      <div className="workspace-heading">
        <div>
          <p className="erp-kicker">ЭМНЭЛГИЙН УДИРДЛАГА</p>
          <h1>Тохиргоо</h1>
          <p>Брэнд, вэбсайтын мэдээлэл болон Telegram-аа нэг дор тохируулна.</p>
        </div>
        <span className="settings-secure-label">
          <ShieldCheck size={16} />
          Зөвхөн админ
        </span>
      </div>
      <div className="settings-navigation">
        {[
          ["clinic", "Эмнэлэг ба footer", Globe],
          ["branding", "Лого ба тайлан", ImageIcon],
          ["telegram", "Telegram", Send],
        ].map(([key, label, Icon]) => {
          const I = Icon as typeof Globe;
          return (
            <button
              key={String(key)}
              className={tab === key ? "selected" : ""}
              onClick={() => {
                setTab(String(key));
                setError("");
              }}
            >
              <I size={18} />
              {String(label)}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="erp-alert" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="erp-toast" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
      {loading ? (
        <BrandLoader />
      ) : tab === "telegram" ? (
        <TelegramPanel onMessage={setMessage} />
      ) : (
        <form className="settings-editor" onSubmit={save}>
          {tab === "branding" ? (
            <section className="settings-section">
              <div className="settings-section-heading">
                <span>
                  <ImageIcon size={22} />
                </span>
                <div>
                  <h2>Таны эмнэлгийн брэнд</h2>
                  <p>Нүүр хуудас болон PDF баримтуудад ашиглана.</p>
                </div>
              </div>
              <ImageUpload
                value={values.logoUrl}
                purpose="logo"
                onChange={async (value) => {
                  await api("/api/erp/settings/logoUrl", "PATCH", { value });
                  setValues((v) => ({ ...v, logoUrl: value }));
                  setMessage("Лого хадгалагдлаа.");
                }}
              />
              <div className="settings-fields">
                {field("reportTitle", "Тайлангийн гарчиг")}
              </div>
            </section>
          ) : (
            <>
              <div className="settings-editor-main">
                <section className="settings-section">
                  <div className="settings-section-heading">
                    <span>
                      <Globe size={22} />
                    </span>
                    <div>
                      <h2>Холбоо барих мэдээлэл</h2>
                      <p>Нүүр хуудас, footer болон PDF-д харагдана.</p>
                    </div>
                  </div>
                  <div className="settings-fields">
                    {field("clinicName", "Эмнэлгийн нэр")}
                    {field("phone", "Холбоо барих утас")}
                    {field("email", "Холбоо барих имэйл")}
                    {field("hours", "Ажиллах цаг", true)}
                    {field("address", "Эмнэлгийн хаяг", true)}
                  </div>
                </section>
                <section className="settings-section">
                  <div className="settings-section-heading">
                    <span>
                      <Globe size={22} />
                    </span>
                    <div>
                      <h2>Footer-ийн агуулга</h2>
                      <p>Тайлбар, гарчиг, товч болон сошиал хаягууд.</p>
                    </div>
                  </div>
                  <div className="settings-fields">
                    {field(
                      "footerDescription",
                      "Эмнэлгийн товч танилцуулга",
                      true,
                    )}
                    {field("footerHoursTitle", "Цагийн хуваарийн гарчиг")}
                    {field("footerContactTitle", "Холбоо барих гарчиг")}
                    {field("footerBookingTitle", "Цаг захиалгын гарчиг")}
                    {field("footerBookingLabel", "Цаг захиалах товчны текст")}
                    {field("copyrightText", "Зохиогчийн эрхийн текст")}
                    {field("facebookUrl", "Facebook HTTPS холбоос")}
                    {field("instagramUrl", "Instagram HTTPS холбоос")}
                  </div>
                </section>
              </div>
              <aside className="footer-preview-panel">
                <p className="erp-kicker">FOOTER УРЬДЧИЛСАН ХАРАГДАЦ</p>
                <div className="footer-mini-preview">
                  <strong>{values.clinicName}</strong>
                  <small>CLINIC & CARE</small>
                  <p>{values.footerDescription}</p>
                  <h3>{values.footerHoursTitle}</h3>
                  <p>{values.hours}</p>
                  <h3>{values.footerContactTitle}</h3>
                  <p>
                    {values.phone}
                    <br />
                    {values.email}
                    <br />
                    {values.address}
                  </p>
                  <h3>{values.footerBookingTitle}</h3>
                  <span>{values.footerBookingLabel}</span>
                  <div>{values.copyrightText}</div>
                </div>
                <p>
                  Хадгалсны дараа нүүр хуудсыг дахин нээхэд шинэ мэдээлэл
                  харагдана.
                </p>
              </aside>
            </>
          )}
          <div className="settings-save-bar">
            <span>
              <CheckCircle2 size={16} />
              Нийтийн вебсайтын мэдээлэл
            </span>
            <button className="erp-primary" disabled={busy}>
              <Save size={16} />
              {busy ? "Хадгалж байна…" : "Өөрчлөлт хадгалах"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
function TelegramPanel({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const [status, setStatus] = useState<TelegramStatus | null>(null),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [flags, setFlags] = useState({
    booking: true,
    transfer: true,
    recovery: true,
  });
  const [webhook, setWebhook] = useState<{
    url: string;
    pending: number;
    lastError: string;
  } | null>(null);
  async function load() {
    try {
      const result = await api<TelegramStatus>("/api/erp/telegram-settings");
      setStatus(result);
      setFlags({
        booking: result.booking,
        transfer: result.transfer,
        recovery: result.recovery,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(name: string) {
    setBusy(name);
    setError("");
    try {
      const result = await api<
        TelegramStatus & { url: string; pending: number; lastError: string }
      >("/api/erp/telegram-settings", "POST", {
        action: name,
        ...(name === "save"
          ? { ...flags, ...(token.trim() ? { token: token.trim() } : {}) }
          : {}),
      });
      if (name.startsWith("webhook-")) setWebhook(result);
      else {
        setStatus(result);
        setFlags({
          booking: result.booking,
          transfer: result.transfer,
          recovery: result.recovery,
        });
        setToken("");
      }
      onMessage(
        name === "test"
          ? "Telegram bot холболт амжилттай."
          : "Telegram тохиргоо шинэчлэгдлээ.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="telegram-settings-grid">
      {error && (
        <div className="erp-alert" role="alert">
          {error}
        </div>
      )}
      <section className="settings-section telegram-bot-card">
        <div className="settings-section-heading">
          <span>
            <Send size={24} />
          </span>
          <div>
            <h2>Эмнэлгийн Telegram bot</h2>
            <p>
              {status?.configured
                ? "Bot token тохируулагдсан"
                : "Холболтоо тохируулж эхлээрэй"}
            </p>
          </div>
          <i className={status?.configured ? "online" : ""} />
        </div>
        <div className="bot-identity">
          <strong>{status?.name || "BB Dental Bot"}</strong>
          <span>
            {status?.username
              ? `@${status.username}`
              : "Холболт шалгахад bot-ийн нэр харагдана"}
          </span>
          <small>
            Token:{" "}
            {status?.source === "database"
              ? "Шифрлэгдсэн тохиргоо"
              : status?.source === "environment"
                ? "Серверийн environment"
                : "Тохируулаагүй"}
          </small>
        </div>
        <button
          className="erp-secondary"
          disabled={!!busy || !status?.configured}
          onClick={() => action("test")}
        >
          <RefreshCw size={16} />
          Bot холболт шалгах
        </button>
        {status?.username && (
          <a
            className="telegram-open-link"
            target="_blank"
            rel="noreferrer"
            href={`https://t.me/${status.username}`}
          >
            <ExternalLink size={15} />
            Bot нээх
          </a>
        )}
        <label className="token-setting">
          <span>Шинэ bot token (солих бол)</span>
          <PasswordInput
            aria-label="Шинэ bot token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="new-password"
            placeholder="BotFather-оос авсан token"
            visibilityLabel="Bot token"
          />
        </label>
        {!status?.canStoreToken && (
          <p className="settings-hint">
            UI-аас token хадгалахын тулд серверт SETTINGS_ENCRYPTION_KEY
            тохируулна. Environment дахь token хэвийн ашиглагдана.
          </p>
        )}
        <div className="telegram-token-actions">
          <button
            className="erp-primary"
            disabled={!!busy || Boolean(token && !status?.canStoreToken)}
            onClick={() => action("save")}
          >
            <Save size={16} />
            Тохиргоо хадгалах
          </button>
          {status?.source === "database" && (
            <button
              className="erp-secondary"
              disabled={!!busy}
              onClick={() => action("clear-token")}
            >
              Серверийн token ашиглах
            </button>
          )}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <span>
            <Send size={22} />
          </span>
          <div>
            <h2>Мэдэгдлийн төрөл</h2>
            <p>Эмнэлгийн bot-оос илгээх үйлдлүүд.</p>
          </div>
        </div>
        {[
          [
            "booking",
            "Шинэ болон шилжүүлсэн цаг",
            "Цаг авсан эмчид өдөр, цаг, үйлчилгээний мэдээлэл очно.",
          ],
          [
            "transfer",
            "Өвчтөн шилжүүлэг",
            "Хүлээн авах эмчид шинэ шилжүүлгийн мэдэгдэл очно.",
          ],
          [
            "recovery",
            "Нууц үг сэргээх",
            "Ажилтан болон админаас сэргээх холбоос илгээнэ.",
          ],
        ].map(([key, title, description]) => (
          <label className="telegram-toggle" key={key}>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <input
              type="checkbox"
              aria-label={title}
              checked={flags[key as keyof typeof flags]}
              onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })}
            />
          </label>
        ))}
        <div className="telegram-tip">
          <KeyRound size={20} />
          <p>
            Ажилтны хэсэгт Telegram холбох холбоос үүсгэж болно. Ажилтан
            холбоосоор bot-оо нээгээд Start дарна.
          </p>
        </div>
      </section>
      <section className="settings-section webhook-section">
        <div className="settings-section-heading">
          <span>
            <Link2 size={22} />
          </span>
          <div>
            <h2>Автомат Telegram холболт · Webhook</h2>
            <p>
              Ажилтны Start хүсэлтийг хүлээн авч Chat ID-г автоматаар холбоно.
            </p>
          </div>
        </div>
        <div className="webhook-actions">
          <button
            className="erp-primary"
            disabled={!!busy || !status?.configured}
            onClick={() => action("webhook-install")}
          >
            <Link2 size={16} />
            Webhook холбох
          </button>
          <button
            className="erp-secondary"
            disabled={!!busy || !status?.configured}
            onClick={() => action("webhook-status")}
          >
            <RefreshCw size={16} />
            Төлөв шалгах
          </button>
          <button
            className="erp-secondary"
            disabled={!!busy || !status?.configured}
            onClick={() => action("webhook-remove")}
          >
            <Unplug size={16} />
            Webhook салгах
          </button>
        </div>
        {webhook && (
          <div className="webhook-status">
            <p>
              <strong>Хаяг</strong>
              {webhook.url || "Холбогдоогүй"}
            </p>
            <p>
              <strong>Хүлээгдэж буй хүсэлт</strong>
              {webhook.pending}
            </p>
            {webhook.lastError && (
              <p>
                <strong>Сүүлийн алдаа</strong>
                {webhook.lastError}
              </p>
            )}
          </div>
        )}
        <p className="settings-hint">
          Webhook холбоход APP_URL нийтэд нээлттэй HTTPS хаягтай байна. Салгах
          үед хүлээгдэж буй хүсэлтүүд устахгүй.
        </p>
      </section>
    </div>
  );
}
