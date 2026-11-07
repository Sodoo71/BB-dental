"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ButtonHTMLAttributes,
} from "react";
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
  contactName?: string;
  guardianName?: string;
  guardianPhone?: string;
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
  kind?: string;
  reason?: string;
  replacesId?: string | null;
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
  minLength?: number;
  maxLength?: number;
};
export async function api<T>(
  url: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Үйлдэл амжилтгүй.");
  if (
    method !== "GET" &&
    /^\/api\/erp\/(schedules|leaves|schedule-week|leave-review)/.test(url)
  )
    window.dispatchEvent(new Event("bb-roster-update"));
  return json;
}
/** Request identity derives loading; aborted/older responses never replace the current result. */
export function useResource<T>(url: string | null, refresh = 0) {
  const [attempt, setAttempt] = useState(0);
  const key = `${url}|${refresh}|${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    api<T>(url, "GET", undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, error: error.message });
      });
    return () => controller.abort();
  }, [url, key]);
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: !!url && result.key !== key,
    retry: () => setAttempt((v) => v + 1),
  };
}
export function useMessage(duration = 4000) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);
  return [message, setMessage] as const;
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
      <span aria-hidden="true">◇</span>
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
  id,
  required,
  describedBy,
  invalid,
}: {
  value: string;
  id: string;
  required?: boolean;
  describedBy?: string;
  invalid?: boolean;
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
      <select
        id={id}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={value}
        onInput={(e) => onChange(e.currentTarget.value)}
        onChange={(e) => onChange(e.target.value)}
      >
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
type FormGuard = { busy: boolean };
const ModalGuard = createContext<{
  update: (id: string, next: FormGuard | null) => void;
  requestClose: () => void;
} | null>(null);
export function useModalGuard(busy: boolean) {
  const id = useId();
  const context = useContext(ModalGuard);
  const update = context?.update;
  useEffect(() => {
    update?.(id, { busy });
    return () => update?.(id, null);
  }, [update, id, busy]);
  return context?.requestClose;
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
  const [guards, setGuards] = useState<Record<string, FormGuard>>({});
  const guard = {
    busy: Object.values(guards).some((g) => g.busy),
  };
  const update = useCallback(
    (id: string, next: FormGuard | null) =>
      setGuards((current) => {
        const result = { ...current };
        if (next) result[id] = next;
        else delete result[id];
        return result;
      }),
    [],
  );
  const titleId = useId();
  const [dismiss, setDismiss] = useState("");
  const requestClose = () => {
    if (guard.busy) {
      setDismiss("Хадгалж дуустал түр хүлээнэ үү.");
      return;
    }
    onClose();
  };
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="erp-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label="Хаах" onClick={requestClose}>
          <X size={20} />
        </button>
      </div>
      {dismiss && guard.busy && (
        <div className="modal-dismiss" role="alert">
          <p>{dismiss}</p>
        </div>
      )}
      <ModalGuard.Provider value={{ update, requestClose }}>
        <div className="modal-body">{children}</div>
      </ModalGuard.Provider>
    </dialog>
  );
}
export function Button({
  variant = "primary",
  type = "button",
  busy = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`erp-${variant} ${className}`}
    >
      {busy ? "Түр хүлээнэ үү…" : children}
    </button>
  );
}
export function Pagination({
  page,
  count,
  total,
  pageSize = 50,
  onPage,
  busy = false,
}: {
  page: number;
  count: number;
  total?: number;
  pageSize?: number;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  return (
    <nav className="table-pagination" aria-label="Хуудас сонгох">
      <span>
        {page}-р хуудас
        {total !== undefined
          ? ` · Нийт ${total} бүртгэл`
          : ` · ${count} бүртгэл`}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={busy || page === 1}
          onClick={() => onPage(page - 1)}
          aria-label="Өмнөх хуудас"
        >
          ‹
        </Button>
        <Button
          variant="secondary"
          disabled={
            busy ||
            (total !== undefined ? page * pageSize >= total : count < pageSize)
          }
          onClick={() => onPage(page + 1)}
          aria-label="Дараах хуудас"
        >
          ›
        </Button>
      </div>
    </nav>
  );
}
export function Feedback({
  children,
  retry,
  kind = "error",
}: {
  children: React.ReactNode;
  retry?: () => void;
  kind?: "error" | "success";
}) {
  return (
    <div
      className={kind === "error" ? "erp-alert" : "erp-toast"}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Дахин оролдох
        </Button>
      )}
    </div>
  );
}
export function LoadingSkeleton({
  label = "Мэдээлэл ачаалж байна…",
}: {
  label?: string;
}) {
  return (
    <div className="erp-skeleton" role="status" aria-label={label}>
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
export function EntityForm({
  fields,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Хадгалах",
  destructive = false,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  destructive?: boolean;
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
  function setFieldValue(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  const formId = useId();
  const guard = useContext(ModalGuard);
  const errorRef = useRef<HTMLDivElement>(null);
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useModalGuard(busy || uploading);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function cancel() {
    if (busy || uploading) return;
    if (guard) guard.requestClose();
    else onCancel();
  }
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
    <form
      className="entity-form"
      onSubmit={submit}
      aria-busy={busy || uploading}
      onInvalid={(e) => {
        const target = e.target as HTMLInputElement;
        setInvalid((old) => ({
          ...old,
          [target.id]: target.validationMessage,
        }));
      }}
      // Native selects emit input before change. Rerendering during input
      // restores the old controlled value before their change handler reads it.
      onChange={(e) => {
        const target = e.target;
        if (
          (target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement) &&
          target.validity.valid
        ) {
          const id = target.id;
          setInvalid((old) => (old[id] ? { ...old, [id]: "" } : old));
        }
      }}
    >
      <fieldset disabled={busy || uploading} className="form-fields">
        <div className="form-grid">
          {fields.map((f) => {
            const Container = "div";
            const id = `${formId}-${f.key}`;
            const hintId = `${id}-hint`;
            const errorId = `${id}-error`;
            const control = {
              id,
              name: f.key,
              "aria-describedby":
                [f.hint ? hintId : "", invalid[id] ? errorId : ""]
                  .filter(Boolean)
                  .join(" ") || undefined,
              "aria-invalid": invalid[id] ? true : undefined,
            };
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
                <label
                  htmlFor={
                    !["teeth", "multiselect", "image"].includes(f.type || "")
                      ? id
                      : undefined
                  }
                  id={`${id}-label`}
                >
                  {f.label}
                  {f.required && <b aria-hidden="true"> *</b>}
                </label>
                {f.type === "teeth" ? (
                  <ToothPicker
                    value={String(values[f.key] || "")}
                    onChange={(v) => setFieldValue(f.key, v)}
                  />
                ) : f.type === "multiselect" ? (
                  <div
                    className="doctor-checklist"
                    role="group"
                    aria-labelledby={`${id}-label`}
                  >
                    {f.options?.map((o) => (
                      <label key={o.value}>
                        <input
                          type="checkbox"
                          checked={(values[f.key] as string[]).includes(
                            o.value,
                          )}
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
                    onChange={(value) => setFieldValue(f.key, value)}
                  />
                ) : f.type === "patient" ? (
                  <PatientPicker
                    id={id}
                    required={f.required}
                    describedBy={control["aria-describedby"]}
                    invalid={control["aria-invalid"]}
                    value={String(values[f.key] || "")}
                    onChange={(v) => setFieldValue(f.key, v)}
                  />
                ) : f.type === "select" ? (
                  <select
                    {...control}
                    required={f.required}
                    value={String(values[f.key])}
                    onInput={(e) => setFieldValue(f.key, e.currentTarget.value)}
                    onChange={(e) => setFieldValue(f.key, e.target.value)}
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
                    {...control}
                    rows={3}
                    required={f.required}
                    maxLength={f.maxLength ?? 30000}
                    value={String(values[f.key])}
                    onChange={(e) => setFieldValue(f.key, e.target.value)}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    {...control}
                    type="checkbox"
                    checked={Boolean(values[f.key])}
                    onChange={(e) => setFieldValue(f.key, e.target.checked)}
                  />
                ) : f.type === "password" ? (
                  <PasswordInput
                    {...control}
                    required={f.required}
                    minLength={8}
                    maxLength={72}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setFieldValue(f.key, e.target.value)}
                    autoComplete="new-password"
                    visibilityLabel={f.label}
                  />
                ) : (
                  <input
                    {...control}
                    type={f.type || "text"}
                    required={f.required}
                    min={f.min}
                    max={f.max}
                    minLength={f.minLength}
                    maxLength={f.maxLength ?? 1000}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setFieldValue(f.key, e.target.value)}
                    autoComplete="off"
                  />
                )}{" "}
                {f.hint && <small id={hintId}>{f.hint}</small>}
                {invalid[id] && (
                  <small id={errorId} className="field-error">
                    {invalid[id]}
                  </small>
                )}
              </Container>
            );
          })}
        </div>
      </fieldset>
      {error && (
        <div className="erp-alert" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </div>
      )}
      <div className="form-footer">
        <button
          type="button"
          className="erp-secondary"
          disabled={busy || uploading}
          onClick={cancel}
        >
          Болих
        </button>
        <button
          className={destructive ? "erp-destructive" : "erp-primary"}
          disabled={busy || uploading}
        >
          {busy ? "Хадгалж байна…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
