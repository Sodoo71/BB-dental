"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Search } from "lucide-react";
import PasswordInput from "../components/password-input";
import ToothPicker from "../components/tooth-picker";
import ImageUpload from "../components/image-upload";
import { money, methodNames, roleNames, statusNames } from "@/lib/domain";
export type Entity = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  author?: Entity;
  sourceDoctor?: Entity;
  targetDoctor?: Entity;
  notes?: Entity[];
  transfers?: Entity[];
  category?: string;
  description?: string;
  price?: number;
  duration?: number;
  doctorIds?: string[];
  active?: boolean;
  specialty?: string;
  bio?: string;
  imageUrl?: string;
  telegramChatId?: string;
  userId?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  allergies?: string;
  medicalHistory?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  note?: string;
  patientId?: string;
  doctorId?: string;
  serviceId?: string;
  appointmentId?: string;
  repeatOfId?: string;
  weekday?: number;
  reason?: string;
  diagnosis?: string;
  procedure?: string;
  tooth?: number;
  amount?: number;
  method?: string;
  title?: string;
  type?: string;
  content?: string;
  consentName?: string;
  sku?: string;
  unit?: string;
  quantity?: number;
  minimum?: number;
  supplier?: string;
  role?: keyof typeof roleNames;
  createdAt?: string;
  voidedAt?: string;
  key?: string;
  value?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  actorId?: string;
  patient?: Entity;
  doctor?: Entity;
  service?: Entity;
  user?: Entity;
  appointment?: Entity;
  appointments?: Entity[];
  treatments?: Entity[];
  payments?: Entity[];
  movements?: Entity[];
};
export type Option = { value: string; label: string };
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "tel"
    | "email"
    | "number"
    | "date"
    | "time"
    | "password"
    | "textarea"
    | "select"
    | "patient"
    | "checkbox"
    | "image"
    | "teeth"
    | "multiselect";
  imagePurpose?: "doctors" | "services" | "logo";
  required?: boolean;
  options?: Option[];
  default?: string | number | boolean;
  min?: number;
  max?: number;
  hint?: string;
};
export async function api<T>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Үйлдэл амжилтгүй.");
  if (method !== "GET" && /^\/api\/erp\/(schedules|leaves)/.test(url))
    window.dispatchEvent(new Event("bb-roster-update"));
  return json;
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={`erp-badge badge-${value.toLowerCase()}`}>
      {statusNames[value] ||
        methodNames[value] ||
        roleNames[value as keyof typeof roleNames] ||
        value}
    </span>
  );
}
export function Empty({
  text = "Бүртгэл одоогоор байхгүй байна.",
}: {
  text?: string;
}) {
  return (
    <div className="erp-empty">
      <span>◇</span>
      <strong>{text}</strong>
      <p>Шинэ мэдээлэл бүртгэхэд энд харагдана.</p>
    </div>
  );
}
export function Money({ value }: { value: number }) {
  return <span className="money-value">{money(value)}</span>;
}
function PatientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Entity[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      api<{ items: Entity[] }>(
        `/api/erp/patients?q=${encodeURIComponent(search)}`,
      )
        .then((r) => {
          if (alive) {
            setItems(r.items);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search]);
  return (
    <div className="patient-picker">
      <div>
        <Search size={16} />
        <input
          placeholder="Нэр, утсаар өвчтөн хайх"
          aria-label="Өвчтөн хайх"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Өвчтөн сонгох</option>
        {items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.phone}
          </option>
        ))}
        {value && !items.some((p) => p.id === value) && (
          <option value={value}>Сонгосон өвчтөн</option>
        )}
      </select>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => {
      element?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="erp-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button aria-label="Хаах" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EntityForm({
  fields,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Хадгалах",
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        initial?.[f.key] ??
          f.default ??
          (f.type === "checkbox" ? true : f.type === "multiselect" ? [] : ""),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = { ...values };
      fields.forEach((f) => {
        if (f.type === "number")
          data[f.key] = values[f.key] === "" ? null : Number(values[f.key]);
        if (
          !f.required &&
          values[f.key] === "" &&
          ["password"].includes(f.type || "")
        )
          delete data[f.key];
      });
      await onSubmit(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="entity-form" onSubmit={submit}>
      <div className="form-grid">
        {fields.map((f) => {
          const Container =
            f.type === "teeth" || f.type === "multiselect" ? "div" : "label";
          return (
            <Container
              key={f.key}
              className={
                f.type === "textarea" ||
                f.type === "patient" ||
                f.type === "image" ||
                f.type === "teeth" ||
                f.type === "multiselect"
                  ? "field-wide"
                  : ""
              }
            >
              <span>
                {f.label}
                {f.required && <b> *</b>}
              </span>
              {f.type === "teeth" ? (
                <ToothPicker
                  value={String(values[f.key] || "")}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                />
              ) : f.type === "multiselect" ? (
                <div className="doctor-checklist">
                  {f.options?.map((o) => (
                    <label key={o.value}>
                      <input
                        type="checkbox"
                        checked={(values[f.key] as string[]).includes(o.value)}
                        onChange={(e) => {
                          const old = values[f.key] as string[];
                          setValues({
                            ...values,
                            [f.key]: e.target.checked
                              ? [...old, o.value]
                              : old.filter((v) => v !== o.value),
                          });
                        }}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              ) : f.type === "image" ? (
                <ImageUpload
                  value={String(values[f.key] || "")}
                  purpose={f.imagePurpose}
                  onBusyChange={setUploading}
                  onChange={(value) => setValues({ ...values, [f.key]: value })}
                />
              ) : f.type === "patient" ? (
                <PatientPicker
                  value={String(values[f.key] || "")}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                />
              ) : f.type === "select" ? (
                <select
                  required={f.required}
                  value={String(values[f.key])}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                >
                  <option value="">Сонгох</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  rows={3}
                  required={f.required}
                  maxLength={30000}
                  value={String(values[f.key])}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.checked })
                  }
                />
              ) : f.type === "password" ? (
                <PasswordInput
                  required={f.required}
                  minLength={8}
                  maxLength={72}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                  autoComplete="new-password"
                  visibilityLabel={f.label}
                />
              ) : (
                <input
                  type={f.type || "text"}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  maxLength={1000}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                  autoComplete="off"
                />
              )}{" "}
              {f.hint && <small>{f.hint}</small>}
            </Container>
          );
        })}
      </div>
      {error && (
        <div className="erp-alert" role="alert">
          {error}
        </div>
      )}
      <div className="form-footer">
        <button type="button" className="erp-secondary" onClick={onCancel}>
          Болих
        </button>
        <button className="erp-primary" disabled={busy || uploading}>
          {busy ? "Хадгалж байна…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
