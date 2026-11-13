"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Download,
  RefreshCw,
  CalendarDays,
  Users,
  CreditCard,
  CheckCircle,
} from "lucide-react";
import {
  api,
  Badge,
  Empty,
  EntityForm,
  Feedback,
  LoadingSkeleton,
  Modal,
  Pagination,
  useResource,
  useModalGuard,
  PatientPicker,
  type Entity,
  type Field,
} from "./ui";
import { AppointmentForm, CalendarView } from "./workspace";
import ReceptionPOS, { CheckoutForm, Receipt } from "./reception-pos";
import type { PaymentOption } from "./payment-method-settings";
import { ExportDocument, useClinicCsv } from "./export-document";
import { useUser } from "./shell";
import {
  clinicTimestamp,
  methodNames,
  money,
  statusNames,
  today,
} from "@/lib/domain";
import {
  queueNames,
  queueTransitions,
  receptionActionNames,
} from "@/lib/reception-domain";
import "./reception.css";

export type Invoice = {
  id: string;
  number: string;
  patientId: string;
  patient: Entity;
  appointment?: Entity;
  status: string;
  total: number;
  paid: number;
  balance: number;
  credit: number;
  dueDate: string;
  createdAt: string;
  lastPaymentDate?: string;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  payments: Transaction[];
};
type Transaction = Entity & {
  invoiceId?: string;
  invoice?: { number: string };
  reference: string;
  methodName?: string;
  createdById: string;
  receptionist: string;
  refundRequests: {
    id: string;
    amount: number;
    status: string;
    reason: string;
  }[];
};
type Queue = Entity & { number: number; arrivedAt: string; status: string };
export type Session = {
  id: string;
  openingCash: number;
  expected: number;
  nonCash: number;
  openedAt: string;
  closedAt?: string;
  actualCash?: number;
  discrepancy?: number;
  explanation: string;
  payments: Transaction[];
  withdrawals: { id: string; amount: number; reason: string }[];
};
type Report = {
  statistics: Record<string, number>;
  methodBreakdown: { name: string; amount: number }[];
  doctorStatus: {
    id: string;
    name: string;
    status: string;
    hours: string;
    nextTime: string | null;
  }[];
  appointments: (Entity & { paymentStatus: string; queueEntry?: Queue })[];
  methods: Record<string, number>;
  receivables: {
    id: string;
    number: string;
    patient: Entity;
    total: number;
    paid: number;
    balance: number;
    dueDate: string;
  }[];
  refunds: { id: string; amount: number; status: string; reason: string }[];
  sessions: Session[];
  activity: { id: string; action: string; entity: string; createdAt: string }[];
};
type Options = { doctors: Entity[]; services: Entity[] };
const labels: Record<string, string> = {
  dashboard: "Нүүр хуудас",
  patients: "Өвчтөн бүртгэл",
  appointments: "Цаг авах",
  visits: "Өнөөдрийн өвчтөнүүд",
  queue: "Хүлээж буй өвчтөн",
  payments: "Төлбөр авах",
  transactions: "Төлбөрийн түүх",
  receivables: "Төлөгдөөгүй төлбөр",
  notifications: "Мэдэгдлүүд",
  reports: "Миний тайлан",
};
const patientFields: Field[] = [
  { key: "name", label: "Овог нэр", required: true },
  { key: "phone", label: "Утас", type: "tel", required: true },
  { key: "birthDate", label: "Төрсөн огноо", type: "date" },
  {
    key: "gender",
    label: "Хүйс",
    type: "select",
    options: [
      { value: "MALE", label: "Эрэгтэй" },
      { value: "FEMALE", label: "Эмэгтэй" },
      { value: "OTHER", label: "Бусад" },
    ],
  },
  { key: "guardianName", label: "Асран хамгаалагчийн нэр" },
  { key: "guardianPhone", label: "Асран хамгаалагчийн утас", type: "tel" },
  { key: "address", label: "Хаяг", type: "textarea" },
];
const amountField = (key: string, label: string): Field => ({
  key,
  label,
  type: "number",
  required: true,
  min: 0,
});
const reasonField: Field = {
  key: "reason",
  label: "Шалтгаан",
  required: true,
  type: "textarea",
  minLength: 3,
};
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="reception-table"
      tabIndex={0}
      role="region"
      aria-label="Мэдээллийн хүснэгт"
    >
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function shiftDay(date: string, delta: number) {
  const d = new Date(`${date}T12:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function shiftCalendar(date: string, mode: string, direction: number) {
  if (mode !== "month")
    return shiftDay(date, direction * (mode === "week" ? 7 : 1));
  const month = new Date(`${date.slice(0, 7)}-01T12:00Z`);
  month.setUTCMonth(month.getUTCMonth() + direction);
  return month.toISOString().slice(0, 10);
}
function WaitingTime({ arrivedAt }: { arrivedAt: string }) {
  // The parent refreshes operational data every 30 seconds.
  return (
    <>
      {Math.max(
        0,
        Math.floor(
          (new Date().getTime() - new Date(arrivedAt).getTime()) / 60000,
        ),
      )}{" "}
      мин
    </>
  );
}
export default function ReceptionWorkspace({ module }: { module: string }) {
  const user = useUser();
  const params = useSearchParams();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState(params.get("q") || "");
  const [date, setDate] = useState(today());
  const [to, setTo] = useState(today());
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [mode, setMode] = useState("day");
  const [sort, setSort] = useState("time");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{
    kind: string;
    item?: Entity;
    initial?: Record<string, unknown>;
  } | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!["dashboard", "visits", "queue", "notifications"].includes(module))
      return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setVersion((v) => v + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [module]);
  const refresh = () => setVersion((v) => v + 1);
  const saved = () => {
    setModal(null);
    setSuccess("Амжилттай хадгаллаа.");
    refresh();
  };
  const options = useResource<Options>("/api/erp/options");
  const paymentOptions = useResource<{ items: PaymentOption[] }>(
    module === "transactions" ? "/api/reception/transaction-methods" : null,
  );
  const query = new URLSearchParams({
    date: module === "visits" ? today() : date,
    from: date,
    to: ["reports", "transactions"].includes(module) ? to : date,
    q: search,
    page: String(page),
    status,
    ...(method ? { paymentMethodId: method } : {}),
    ...(overdue ? { overdue: "true" } : {}),
  });
  const resource =
    module === "payments"
      ? "invoices"
      : module === "visits" || module === "appointments"
        ? "dashboard"
        : module;
  if (module === "visits") {
    query.set("from", today());
    query.set("to", today());
  }
  if (module === "appointments") {
    let from = date,
      end = date;
    if (mode === "week") {
      const weekday = new Date(`${date}T12:00Z`).getUTCDay();
      from = shiftDay(date, -((weekday + 6) % 7));
      end = shiftDay(from, 6);
    }
    if (mode === "month") {
      from = date.slice(0, 7) + "-01";
      end =
        date.slice(0, 7) +
        "-" +
        new Date(
          Number(date.slice(0, 4)),
          Number(date.slice(5, 7)),
          0,
        ).getDate();
    }
    query.set("from", from);
    query.set("to", end);
  }
  const data = useResource<Report>(
    ["dashboard", "visits", "appointments", "reports"].includes(module)
      ? `/api/reception/${resource}?${query}`
      : null,
    version,
  );
  const patients = useResource<{ items: Entity[]; total: number }>(
    module === "patients" ? `/api/erp/patients?${query}` : null,
    version,
  );
  const queue = useResource<{ items: Queue[] }>(
    ["queue", "dashboard"].includes(module)
      ? `/api/reception/queue?${query}`
      : null,
    version,
  );
  const invoices = useResource<{
    items: Invoice[];
    total: number;
    balance: number;
    patientBalances: Record<string, number>;
  }>(
    module === "receivables" ? `/api/reception/${resource}?${query}` : null,
    version,
  );
  const transactions = useResource<{ items: Transaction[]; total: number }>(
    module === "transactions" ? `/api/reception/transactions?${query}` : null,
    version,
  );
  const sessions = useResource<{ items: Session[] }>(
    module === "payments" ? "/api/reception/cash-sessions" : null,
    version,
  );
  const requestError =
    data.error ||
    patients.error ||
    queue.error ||
    invoices.error ||
    transactions.error ||
    sessions.error;
  const loading =
    data.loading ||
    patients.loading ||
    queue.loading ||
    invoices.loading ||
    transactions.loading;
  const activeSession = sessions.data?.items.find((s) => !s.closedAt);
  async function act(action: string, payload: unknown) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/reception/${action}`, "POST", payload);
      refresh();
      setSuccess("Амжилттай хадгаллаа.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const appointments = (data.data?.appointments || [])
    .filter(
      (a) =>
        (!doctorId || a.doctorId === doctorId) &&
        (!status || a.status === status) &&
        (!search ||
          `${a.patient?.name} ${a.patient?.phone} ${a.patientId} ${a.service?.name}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "name"
        ? (a.patient?.name || "").localeCompare(b.patient?.name || "")
        : `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
    );
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const appointmentTable = (
    <>
      <Table
        headers={[
          "Өвчтөн / Утас",
          "Огноо / Цаг",
          "Эмч / Үйлчилгээ",
          "Захиалга",
          "Төлбөр",
          "Үйлдэл",
        ]}
      >
        {appointments.slice((page - 1) * 50, page * 50).map((a) => (
          <tr key={a.id}>
            <td>
              <button
                className="reception-link"
                onClick={() => setPatientId(a.patientId!)}
              >
                {a.patient?.name}
              </button>
              <small>{a.patient?.phone}</small>
            </td>
            <td>
              {a.date}
              <small>
                {a.startTime}–{a.endTime}
              </small>
            </td>
            <td>
              {a.doctor?.name}
              <small>{a.service?.name}</small>
            </td>
            <td>
              <Badge value={a.status || ""} />
            </td>
            <td>
              {a.paymentStatus === "PAID"
                ? "Төлсөн"
                : a.paymentStatus === "DUE"
                  ? "Үлдэгдэлтэй"
                  : "Нэхэмжлээгүй"}
            </td>
            <td>
              <details className="reception-menu">
                <summary>Үйлдэл</summary>
                <div>
                  {a.date === today() &&
                    ["PENDING", "CONFIRMED", "ARRIVED"].includes(
                      a.status || "",
                    ) &&
                    !a.queueEntry && (
                      <button
                        disabled={busy}
                        onClick={() => setModal({ kind: "check-in", item: a })}
                      >
                        Мэдээлэл шалгах / Ирсэн
                      </button>
                    )}
                  {a.status === "PENDING" && (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        try {
                          await api(`/api/erp/appointments/${a.id}`, "PATCH", {
                            status: "CONFIRMED",
                          });
                          refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Баталгаажуулах
                    </button>
                  )}
                  {["PENDING", "CONFIRMED"].includes(a.status || "") && (
                    <>
                      <button
                        onClick={() =>
                          setModal({ kind: "reschedule", item: a, initial: a })
                        }
                      >
                        Цаг шилжүүлэх
                      </button>
                      <button
                        onClick={() => setModal({ kind: "cancel", item: a })}
                      >
                        Цуцлах
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      setModal({
                        kind: "appointment",
                        initial: {
                          patientId: a.patientId,
                          doctorId: a.doctorId,
                          serviceId: a.serviceId,
                          repeatOfId: a.id,
                        },
                      })
                    }
                  >
                    Давтан цаг
                  </button>
                  <button
                    onClick={() =>
                      setModal({
                        kind: "invoice",
                        initial: {
                          patientId: a.patientId,
                          appointmentId: a.id,
                        },
                      })
                    }
                  >
                    Нэхэмжлэх үүсгэх
                  </button>
                </div>
              </details>
            </td>
          </tr>
        ))}
      </Table>
      {!appointments.length && <Empty />}
      <Pagination
        page={page}
        count={appointments.slice((page - 1) * 50, page * 50).length}
        total={appointments.length}
        onPage={setPage}
      />
    </>
  );
  return (
    <div className="reception-workspace">
      <header className="reception-heading">
        <div>
          <span className="reception-eyebrow">BB DENTAL · {user.name}</span>
          <h1>{labels[module]}</h1>
          <p>Өвчтөний бүртгэл, цаг товлол, төлбөрийн нэгдсэн ажлын орчин.</p>
        </div>
        <button
          className="erp-secondary"
          aria-label="Мэдээлэл шинэчлэх"
          disabled={busy}
          onClick={refresh}
        >
          <RefreshCw size={17} /> Шинэчлэх
        </button>
      </header>
      {(error || requestError) && (
        <Feedback retry={refresh}>{error || requestError}</Feedback>
      )}
      {success && (
        <p className="reception-success" role="status">
          {success}
        </p>
      )}
      {["dashboard", "visits"].includes(module) && (
        <div className="reception-quick-actions">
          {[
            { kind: "patient", label: "+ Шинэ өвчтөн бүртгэх", icon: Users },
            {
              kind: "appointment",
              label: "+ Цаг захиалах",
              icon: CalendarDays,
            },
            {
              kind: "walk-in",
              label: "Цаггүй өвчтөн / Ирсэн",
              icon: CheckCircle,
            },
          ].map((a) => (
            <button
              key={a.kind}
              className="erp-secondary"
              onClick={() => setModal({ kind: a.kind })}
            >
              <a.icon size={18} />
              {a.label}
            </button>
          ))}
          <Link className="erp-secondary" href="/erp/patients">
            Өвчтөн хайх
          </Link>
          <Link className="erp-primary" href="/erp/payments">
            <CreditCard size={18} /> Төлбөр авах
          </Link>
        </div>
      )}
      {module === "dashboard" && data.data && (
        <div className="reception-stats">
          {[
            ["Өнөөдрийн захиалга", "appointments"],
            ["Ирсэн өвчтөн", "checkedIn"],
            ["Хүлээж буй өвчтөн", "waiting"],
            ["Эмчлүүлж буй өвчтөн", "inProgress"],
            ["Дууссан үзлэг", "completed"],
            ["Өнөөдрийн цуглуулсан төлбөр", "collected"],
            ["Төлөгдөөгүй төлбөр", "outstanding"],
          ].map(([label, key]) => (
            <article key={key}>
              <span>{label}</span>
              <strong>
                {["collected", "outstanding"].includes(key)
                  ? money(data.data!.statistics[key])
                  : data.data!.statistics[key]}
              </strong>
            </article>
          ))}
        </div>
      )}
      {module === "dashboard" && data.data && (
        <DashboardOperations
          report={data.data}
          queue={queue.data?.items || []}
          version={version}
          onPatient={setPatientId}
        />
      )}
      {!["notifications", "payments"].includes(module) && (
        <div className="reception-filters">
          {!["queue", "reports"].includes(module) && (
            <label>
              Хайх
              <input
                type="search"
                placeholder="Нэр, утас, ID…"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
              />
            </label>
          )}
          {!["patients", "payments", "receivables"].includes(module) && (
            <label>
              {["reports", "transactions"].includes(module)
                ? "Эхлэх огноо"
                : "Огноо"}
              <input
                type="date"
                value={module === "visits" ? today() : date}
                disabled={["visits", "dashboard"].includes(module)}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          )}
          {["reports", "transactions"].includes(module) && (
            <label>
              Дуусах огноо
              <input
                type="date"
                value={to}
                min={date}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          )}
          {["dashboard", "visits", "appointments", "queue"].includes(
            module,
          ) && (
            <label>
              Эмч
              <select
                value={doctorId}
                onChange={(e) => {
                  setDoctorId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Бүх эмч</option>
                {options.data?.doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["dashboard", "visits", "appointments"].includes(module) && (
            <>
              <label>
                Захиалгын төлөв
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Бүгд</option>
                  {Object.entries(statusNames).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Эрэмбэ
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="time">Цагаар</option>
                  <option value="name">Нэрээр</option>
                </select>
              </label>
            </>
          )}
          {module === "appointments" && (
            <label>
              Харагдац
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setPage(1);
                }}
              >
                <option value="day">Өдөр</option>
                <option value="week">Долоо хоног</option>
                <option value="month">Сар</option>
              </select>
            </label>
          )}
          {module === "transactions" && (
            <>
              <label>
                Төлбөрийн хэлбэр
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Бүгд</option>
                  {paymentOptions.data?.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Төлөв
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Бүгд</option>
                  <option value="RECORDED">Бүртгэгдсэн</option>
                  <option value="VOIDED">Хүчингүй</option>
                </select>
              </label>
            </>
          )}
          {module === "receivables" && (
            <label className="reception-check">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => {
                  setOverdue(e.target.checked);
                  setPage(1);
                }}
              />
              Хугацаа хэтэрсэн
            </label>
          )}
          {["patients", "appointments", "payments"].includes(module) && (
            <button
              className="erp-primary"
              disabled={!options.data}
              onClick={() =>
                setModal({
                  kind:
                    module === "patients"
                      ? "patient"
                      : module === "payments"
                        ? "invoice"
                        : "appointment",
                })
              }
            >
              <Plus size={17} />
              {module === "patients"
                ? "Өвчтөн бүртгэх"
                : module === "payments"
                  ? "Нэхэмжлэх"
                  : "Цаг захиалах"}
            </button>
          )}
        </div>
      )}
      {options.error && (
        <Feedback retry={options.retry}>{options.error}</Feedback>
      )}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {["dashboard", "visits", "appointments"].includes(module) && (
            <section className="reception-panel">
              {module === "appointments" && (
                <>
                  <div className="reception-actions">
                    <button
                      className="erp-secondary"
                      onClick={() => setDate(shiftCalendar(date, mode, -1))}
                    >
                      Өмнөх
                    </button>
                    <button
                      className="erp-secondary"
                      onClick={() => setDate(today())}
                    >
                      Өнөөдөр
                    </button>
                    <button
                      className="erp-secondary"
                      onClick={() => setDate(shiftCalendar(date, mode, 1))}
                    >
                      Дараах
                    </button>
                  </div>
                  <CalendarView
                    reception
                    items={appointments}
                    date={date}
                    mode={mode}
                    onPatient={setPatientId}
                  />
                </>
              )}
              {appointmentTable}
            </section>
          )}
          {module === "patients" && (
            <section className="reception-panel">
              <Table
                headers={[
                  "Өвчтөний ID",
                  "Нэр / Утас",
                  "Төрсөн огноо",
                  "Харшлын анхааруулга",
                  "Үйлдэл",
                ]}
              >
                {patients.data?.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <small title={p.id}>{p.id.slice(0, 8)}</small>
                    </td>
                    <td>
                      <button
                        className="reception-link"
                        onClick={() => setPatientId(p.id)}
                      >
                        {p.name}
                      </button>
                      <small>{p.phone}</small>
                    </td>
                    <td>{p.birthDate || "—"}</td>
                    <td>{p.allergies || "—"}</td>
                    <td>
                      <div className="reception-actions">
                        <button
                          className="erp-secondary"
                          onClick={() => setModal({ kind: "patient", item: p })}
                        >
                          Засах
                        </button>
                        <button
                          className="erp-secondary"
                          onClick={() => setModal({ kind: "archive", item: p })}
                        >
                          Архивлах
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
              {!patients.data?.items.length && <Empty />}
              <Pagination
                page={page}
                count={patients.data?.items.length || 0}
                total={patients.data?.total}
                onPage={setPage}
              />
            </section>
          )}
          {module === "queue" && (
            <section className="reception-panel">
              <div className="reception-actions">
                <button
                  className="erp-primary"
                  onClick={() => setModal({ kind: "walk-in" })}
                >
                  <Plus size={16} /> Цаггүй өвчтөн
                </button>
              </div>
              <Table
                headers={[
                  "№",
                  "Өвчтөн",
                  "Эмч / Үйлчилгээ / Цаг",
                  "Ирсэн цаг",
                  "Хүлээлт",
                  "Дарааллын төлөв",
                  "Үйлдэл",
                ]}
              >
                {queue.data?.items
                  .filter((e) => !doctorId || e.doctorId === doctorId)
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>#{e.number}</strong>
                      </td>
                      <td>
                        <button
                          className="reception-link"
                          onClick={() => setPatientId(e.patientId!)}
                        >
                          {e.patient?.name}
                        </button>
                      </td>
                      <td>
                        {e.doctor?.name}
                        <small>
                          {e.appointment?.service?.name || "Цаггүй үзлэг"}
                        </small>
                        <small>{e.appointment?.startTime || "Цаггүй"}</small>
                      </td>
                      <td>{clinicTimestamp(e.arrivedAt)}</td>
                      <td>
                        {["WAITING", "CALLED"].includes(e.status) ? (
                          <WaitingTime arrivedAt={e.arrivedAt} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span
                          className={`reception-status status-${e.status.toLowerCase()}`}
                        >
                          {queueNames[e.status]}
                        </span>
                      </td>
                      <td>
                        <div className="reception-actions">
                          {queueTransitions[e.status]?.map((s) => (
                            <button
                              className="erp-secondary"
                              key={s}
                              disabled={busy || date !== today()}
                              onClick={() =>
                                s === "CANCELLED"
                                  ? setModal({ kind: "queue-cancel", item: e })
                                  : act("queue-status", { id: e.id, status: s })
                              }
                            >
                              {queueNames[s]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
              </Table>
              {!queue.data?.items.length && <Empty />}
            </section>
          )}
          {module === "payments" && (
            <div inert={busy}>
              {sessions.loading ? (
                <LoadingSkeleton />
              ) : activeSession ? (
                <details className="reception-cash-shell">
                  <summary>
                    <span className="reception-status">Касс нээлттэй</span>
                    <span>
                      Бэлэн: <strong>{money(activeSession.expected)}</strong>
                    </span>
                    <span>Кассын мэдээлэл / Ээлж хаах</span>
                  </summary>
                  <CashPanel
                    sessions={sessions.data?.items || []}
                    onAction={(kind) => setModal({ kind })}
                  />
                </details>
              ) : (
                <CashPanel
                  sessions={sessions.data?.items || []}
                  onAction={(kind) => setModal({ kind })}
                />
              )}
            </div>
          )}
          {module === "payments" && (
            <ReceptionPOS
              version={version}
              onSaved={refresh}
              onBusyChange={setBusy}
              onInvoice={setInvoiceId}
              onNewInvoice={(id) =>
                setModal({
                  kind: "invoice",
                  initial: id ? { patientId: id } : undefined,
                })
              }
            />
          )}
          {module === "receivables" && (
            <section className="reception-panel">
              {module === "receivables" && (
                <p>
                  Нийт авлага:{" "}
                  <strong>{money(invoices.data?.balance || 0)}</strong>
                </p>
              )}
              <Table
                headers={[
                  "Нэхэмжлэх / Өвчтөн",
                  "Нийт",
                  "Төлсөн",
                  "Үлдэгдэл",
                  "Хугацаа / Сүүлийн төлөлт",
                  "Үйлдэл",
                ]}
              >
                {invoices.data?.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <span title={i.number}>{i.number.slice(0, 24)}…</span>
                      <small>
                        <button
                          className="reception-link"
                          onClick={() => setPatientId(i.patientId)}
                        >
                          {i.patient.name}
                        </button>{" "}
                        · {i.patient.phone}
                      </small>
                      {module === "receivables" && (
                        <small>
                          Өвчтөний нийт:{" "}
                          {money(invoices.data!.patientBalances[i.patientId])}
                        </small>
                      )}
                    </td>
                    <td>{i.status === "DRAFT" ? "Ноорог" : money(i.total)}</td>
                    <td>{money(i.paid)}</td>
                    <td>
                      {money(i.balance)}
                      {i.credit > 0 && (
                        <small>Өмнөх илүү төлөлт: {money(i.credit)}</small>
                      )}
                    </td>
                    <td>
                      {i.dueDate}
                      <small>{i.lastPaymentDate || "—"}</small>
                    </td>
                    <td>
                      <button
                        className="erp-secondary"
                        onClick={() => setInvoiceId(i.id)}
                      >
                        Нээх / Төлөх
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
              {!invoices.data?.items.length && <Empty />}
              <Pagination
                page={page}
                count={invoices.data?.items.length || 0}
                total={invoices.data?.total}
                onPage={setPage}
              />
            </section>
          )}
          {module === "transactions" && (
            <section className="reception-panel">
              <Table
                headers={[
                  "Гүйлгээ / Нэхэмжлэх",
                  "Өвчтөн",
                  "Хэлбэр",
                  "Дүн",
                  "Огноо / Ресепшн",
                  "Төлөв",
                  "Үйлдэл",
                ]}
              >
                {transactions.data?.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <small title={p.id}>{p.id.slice(0, 8)}</small>
                      <small>
                        {p.invoice?.number.slice(0, 24) || "Өмнөх бүртгэл"}
                      </small>
                    </td>
                    <td>{p.patient?.name}</td>
                    <td>
                      {p.methodName || methodNames[p.method || ""]}
                      <small>{p.reference}</small>
                    </td>
                    <td>{money(p.amount || 0)}</td>
                    <td>
                      {clinicTimestamp(p.createdAt!)}
                      <small>{p.receptionist}</small>
                    </td>
                    <td>
                      {p.voidedAt ? "Хүчингүй" : "Бүртгэгдсэн"}
                      {p.refundRequests?.map((r) => (
                        <small key={r.id}>
                          Буцаалтын хүсэлт: {money(r.amount)} · {r.status}
                        </small>
                      ))}
                    </td>
                    <td>
                      <div className="reception-actions">
                        {p.invoiceId && (
                          <button
                            className="erp-secondary"
                            onClick={() => setReceiptId(p.id)}
                          >
                            Баримт
                          </button>
                        )}
                        {!p.voidedAt && (
                          <button
                            className="erp-secondary"
                            onClick={() =>
                              setModal({ kind: "refund", item: p })
                            }
                          >
                            Буцаалт хүсэх
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
              {!transactions.data?.items.length && <Empty />}
              <Pagination
                page={page}
                count={transactions.data?.items.length || 0}
                total={transactions.data?.total}
                onPage={setPage}
              />
            </section>
          )}
          {module === "reports" && data.data && (
            <ReceptionReport data={data.data} from={date} to={to} />
          )}
          {module === "notifications" && (
            <Notifications version={version} onRead={refresh} />
          )}
        </>
      )}
      {patientId && (
        <Modal title="Өвчтөний карт" onClose={() => setPatientId(null)}>
          <PatientProfile
            id={patientId}
            version={version}
            onInvoice={(id) => {
              setPatientId(null);
              setInvoiceId(id);
            }}
          />
        </Modal>
      )}
      {receiptId && (
        <Modal title="Төлбөрийн баримт" onClose={() => setReceiptId(null)}>
          <Receipt id={receiptId} />
        </Modal>
      )}
      {invoiceId && (
        <Modal title="Нэхэмжлэх / Төлбөр" onClose={() => setInvoiceId(null)}>
          <InvoiceDetail id={invoiceId} version={version} onSaved={refresh} />
        </Modal>
      )}
      {modal && (
        <Modal
          title={
            {
              patient: modal.item ? "Өвчтөн засах" : "Өвчтөн бүртгэх",
              appointment: "Цаг захиалах",
              reschedule: "Цаг шилжүүлэх",
              cancel: "Захиалга цуцлах",
              "check-in": "Өвчтөний мэдээлэл шалгах",
              "walk-in": "Цаггүй өвчтөн бүртгэх",
              archive: "Өвчтөн архивлах",
              invoice: "Нэхэмжлэх үүсгэх",
              refund: "Буцаалтын хүсэлт",
              "cash-open": "Кассын ээлж нээх",
              "cash-close": "Кассын ээлж хаах",
              "cash-withdraw": "Бэлэн мөнгө гаргах",
              "queue-cancel": "Дараалал цуцлах",
            }[modal.kind] || "Бүртгэл"
          }
          onClose={() => setModal(null)}
        >
          {modal.kind === "patient" && (
            <EntityForm
              fields={patientFields}
              initial={modal.item}
              onCancel={() => setModal(null)}
              onSubmit={async (values) => {
                await api(
                  `/api/erp/patients${modal.item ? "/" + modal.item.id : ""}`,
                  modal.item ? "PATCH" : "POST",
                  values,
                );
                saved();
              }}
            />
          )}
          {["appointment", "reschedule"].includes(modal.kind) &&
            options.data && (
              <ReceptionAppointmentForm
                options={options.data}
                rescheduleId={
                  modal.kind === "reschedule" ? modal.item?.id : undefined
                }
                initial={modal.initial}
                onCancel={() => setModal(null)}
                onSaved={saved}
              />
            )}
          {modal.kind === "invoice" && options.data && (
            <InvoiceForm
              options={options.data}
              initial={modal.initial}
              onCancel={() => setModal(null)}
              onSaved={(i) => {
                saved();
                setInvoiceId(i.id);
              }}
            />
          )}
          {modal.kind === "check-in" && (
            <>
              <p>
                <strong>{modal.item?.patient?.name}</strong> ·{" "}
                {modal.item?.patient?.phone}
              </p>
              <p>
                {modal.item?.doctor?.name} · {modal.item?.startTime} ·{" "}
                {modal.item?.service?.name}
              </p>
              <EntityForm
                fields={[
                  {
                    key: "verified",
                    label: "Нэр, утас, эмч болон цагийг шалгасан",
                    type: "select",
                    required: true,
                    options: [{ value: "YES", label: "Шалгасан" }],
                  },
                ]}
                submitLabel="Ирсэн / Дараалалд нэмэх"
                onCancel={() => setModal(null)}
                onSubmit={async () => {
                  await api("/api/reception/check-in", "POST", {
                    appointmentId: modal.item!.id,
                    patientId: modal.item!.patientId,
                    doctorId: modal.item!.doctorId,
                  });
                  saved();
                }}
              />
            </>
          )}
          {modal.kind === "walk-in" && (
            <EntityForm
              fields={[
                {
                  key: "patientId",
                  label: "Өвчтөн",
                  type: "patient",
                  required: true,
                },
                {
                  key: "doctorId",
                  label: "Эмч",
                  type: "select",
                  required: true,
                  options: options.data?.doctors.map((d) => ({
                    value: d.id,
                    label: d.name!,
                  })),
                },
              ]}
              onCancel={() => setModal(null)}
              onSubmit={async (v) => {
                await api("/api/reception/check-in", "POST", v);
                saved();
              }}
            />
          )}
          {["cancel", "archive", "queue-cancel"].includes(modal.kind) && (
            <>
              <p>
                {modal.item?.name || modal.item?.patient?.name} · Энэ үйлдлийг
                баталгаажуулна уу.
              </p>
              <EntityForm
                fields={modal.kind === "cancel" ? [reasonField] : []}
                destructive
                onCancel={() => setModal(null)}
                submitLabel="Баталгаажуулах"
                onSubmit={async (v) => {
                  if (modal.kind === "cancel")
                    await api(
                      `/api/erp/appointments/${modal.item!.id}`,
                      "PATCH",
                      { status: "CANCELLED", note: v.reason },
                    );
                  else
                    await api(
                      `/api/reception/${modal.kind === "archive" ? "patient-archive" : "queue-status"}`,
                      "POST",
                      { id: modal.item!.id, status: "CANCELLED" },
                    );
                  saved();
                }}
              />
            </>
          )}
          {modal.kind === "refund" && (
            <>
              <p>
                Энэ нь зөвхөн буцаалтын хүсэлт. Мөнгө буцаах, гүйлгээг хүчингүй
                болгох эрх ресепшнд байхгүй.
              </p>
              <EntityForm
                fields={[
                  {
                    ...amountField("amount", "Буцаах хүсэлтийн дүн"),
                    max: modal.item?.amount,
                  },
                  reasonField,
                ]}
                onCancel={() => setModal(null)}
                onSubmit={async (v) => {
                  await api("/api/reception/refund-request", "POST", {
                    ...v,
                    paymentId: modal.item!.id,
                  });
                  saved();
                }}
              />
            </>
          )}
          {modal.kind === "cash-open" && (
            <EntityForm
              fields={[amountField("openingCash", "Эхлэх бэлэн үлдэгдэл")]}
              onCancel={() => setModal(null)}
              onSubmit={async (v) => {
                await api("/api/reception/cash-open", "POST", v);
                saved();
              }}
            />
          )}
          {modal.kind === "cash-withdraw" && (
            <EntityForm
              fields={[amountField("amount", "Гаргах дүн"), reasonField]}
              onCancel={() => setModal(null)}
              onSubmit={async (v) => {
                await api("/api/reception/cash-withdraw", "POST", v);
                saved();
              }}
            />
          )}
          {modal.kind === "cash-close" && (
            <>
              <p>
                Тооцоолсон бэлэн үлдэгдэл:{" "}
                <strong>{money(activeSession?.expected || 0)}</strong>
              </p>
              <EntityForm
                fields={[
                  amountField("actualCash", "Тоолсон бэлэн мөнгө"),
                  {
                    key: "explanation",
                    label: "Зөрүүний тайлбар",
                    type: "textarea",
                    hint: "Зөрүү гарвал тайлбар заавал оруулна.",
                  },
                ]}
                onCancel={() => setModal(null)}
                onSubmit={async (v) => {
                  await api("/api/reception/cash-close", "POST", v);
                  saved();
                }}
              />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function DashboardOperations({
  report,
  queue,
  version,
  onPatient,
}: {
  report: Report;
  queue: Queue[];
  version: number;
  onPatient: (id: string) => void;
}) {
  const notifications = useResource<{
    events: { id: string; action: string; createdAt: string }[];
    readAt: string | null;
  }>("/api/reception/notifications", version);
  const waiting = queue.filter((q) => ["WAITING", "CALLED"].includes(q.status));
  const pending = report.appointments.filter((a) => a.status === "PENDING");
  return (
    <div className="dashboard-operations">
      <section className="reception-panel">
        <div className="reception-section-title">
          <h2>Хүлээж буй өвчтөнүүд</h2>
          <Link href="/erp/queue">Дараалал нээх</Link>
        </div>
        {waiting.length ? (
          waiting.slice(0, 6).map((q) => (
            <div className="operational-row" key={q.id}>
              <div>
                <button
                  className="reception-link"
                  onClick={() => onPatient(q.patientId!)}
                >
                  #{q.number} · {q.patient?.name}
                </button>
                <small>
                  {q.doctor?.name} ·{" "}
                  {q.appointment?.service?.name || "Цаггүй үзлэг"}
                </small>
              </div>
              <WaitingTime arrivedAt={q.arrivedAt} />
            </div>
          ))
        ) : (
          <p>Одоогоор хүлээж буй өвчтөн алга.</p>
        )}
      </section>
      <section className="reception-panel">
        <h2>Эмч нарын өнөөдрийн хуваарь</h2>
        {report.doctorStatus.map((d) => (
          <div className="operational-row" key={d.id}>
            <div>
              <strong>{d.name}</strong>
              <small>
                {d.hours}
                {d.nextTime ? ` · Дараагийн захиалга ${d.nextTime}` : ""}
              </small>
            </div>
            <span className="reception-status">{d.status}</span>
          </div>
        ))}
        {!report.doctorStatus.length && <p>Идэвхтэй эмч бүртгээгүй.</p>}
      </section>
      <section className="reception-panel">
        <div className="reception-section-title">
          <h2>Баталгаажуулах захиалга · {pending.length}</h2>
          <Link href="/erp/appointments">Захиалга нээх</Link>
        </div>
        {pending.slice(0, 5).map((a) => (
          <p key={a.id}>
            {a.startTime} · {a.patient?.name} · {a.doctor?.name}
          </p>
        ))}
        {!pending.length && <p>Өнөөдрийн захиалгууд баталгаажсан.</p>}
        {report.statistics.outstanding > 0 && (
          <p className="reception-alert">
            <Link href="/erp/receivables">
              Төлөгдөөгүй төлбөр: {money(report.statistics.outstanding)}
            </Link>
          </p>
        )}
      </section>
      <section className="reception-panel">
        <div className="reception-section-title">
          <h2>Анхаарах мэдээлэл</h2>
          <Link href="/erp/notifications">Бүгдийг харах</Link>
        </div>
        {notifications.error ? (
          <Feedback retry={notifications.retry}>{notifications.error}</Feedback>
        ) : notifications.loading ? (
          <LoadingSkeleton />
        ) : (
          notifications.data?.events
            .filter(
              (e) =>
                !notifications.data?.readAt ||
                e.createdAt > notifications.data.readAt,
            )
            .slice(0, 4)
            .map((e) => (
              <div className="operational-row" key={e.id}>
                <strong>
                  {receptionActionNames[e.action] || "Мэдээлэл шинэчлэгдсэн"}
                </strong>
                <small>{clinicTimestamp(e.createdAt)}</small>
              </div>
            ))
        )}
        {notifications.data &&
          !notifications.data.events.some(
            (e) =>
              !notifications.data?.readAt ||
              e.createdAt > notifications.data.readAt,
          ) && <p>Шинэ мэдэгдэл алга.</p>}
      </section>
    </div>
  );
}

function PatientProfile({
  id,
  version,
  onInvoice,
}: {
  id: string;
  version: number;
  onInvoice: (id: string) => void;
}) {
  const patient = useResource<Entity>(`/api/erp/patients/${id}`, version);
  const invoices = useResource<{
    items: Invoice[];
    balance: number;
    total: number;
  }>(`/api/reception/invoices?patientId=${id}`, version);
  const [tab, setTab] = useState("basic");
  if (patient.error || invoices.error)
    return <Feedback>{patient.error || invoices.error}</Feedback>;
  if (!patient.data || !invoices.data) return <LoadingSkeleton />;
  const p = patient.data;
  const tabs = [
    ["basic", "Үндсэн мэдээлэл"],
    ["appointments", "Цаг захиалгын түүх"],
    ["payments", "Төлбөрийн түүх"],
    ["invoices", "Нэхэмжлэх"],
    ["outstanding", "Төлөгдөөгүй төлбөр"],
  ];
  return (
    <div className="reception-profile">
      <h2>{p.name}</h2>
      <p>
        {p.phone} · ID: <span className="reception-id">{p.id}</span>
      </p>
      {p.allergies && (
        <p role="note" className="reception-alert">
          Харшил: {p.allergies}
        </p>
      )}
      <nav
        className="profile-sections"
        aria-label="Өвчтөний мэдээллийн хэсгүүд"
      >
        {tabs.map(([key, label]) => (
          <button
            className="erp-secondary"
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section aria-label={tabs.find((t) => t[0] === tab)?.[1]}>
        {tab === "basic" && (
          <dl className="checkout-summary">
            {[
              ["Нэр", p.name],
              ["Утас", p.phone],
              ["Төрсөн огноо", p.birthDate],
              [
                "Хүйс",
                (
                  {
                    MALE: "Эрэгтэй",
                    FEMALE: "Эмэгтэй",
                    OTHER: "Бусад",
                  } as Record<string, string>
                )[p.gender || ""],
              ],
              ["Хаяг", p.address],
              ["Асран хамгаалагч", p.guardianName],
              ["Асран хамгаалагчийн утас", p.guardianPhone],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "Бүртгэлгүй"}</dd>
              </div>
            ))}
          </dl>
        )}
        {tab === "appointments" && (
          <>
            <Table headers={["Огноо / Цаг", "Эмч / Үйлчилгээ", "Төлөв"]}>
              {p.appointments?.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.date} · {a.startTime}
                  </td>
                  <td>
                    {a.doctor?.name}
                    <small>{a.service?.name}</small>
                  </td>
                  <td>
                    <Badge value={a.status!} />
                  </td>
                </tr>
              ))}
            </Table>
            {!p.appointments?.length && <Empty />}
          </>
        )}
        {tab === "payments" && (
          <>
            <Table headers={["Огноо", "Хэлбэр", "Дүн", "Төлөв"]}>
              {p.payments?.map((a) => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td>{a.methodName || methodNames[a.method!]}</td>
                  <td>{money(a.amount!)}</td>
                  <td>{a.voidedAt ? "Хүчингүй" : "Бүртгэгдсэн"}</td>
                </tr>
              ))}
            </Table>
            {!p.payments?.length && <Empty />}
          </>
        )}
        {["invoices", "outstanding"].includes(tab) && (
          <>
            <h3>Төлөгдөөгүй төлбөр: {money(invoices.data.balance)}</h3>
            <Table
              headers={["Нэхэмжлэх", "Нийт", "Төлсөн", "Үлдэгдэл", "Төлөв"]}
            >
              {invoices.data.items
                .filter(
                  (i) =>
                    tab === "invoices" ||
                    (i.status === "FINALIZED" && i.balance > 0),
                )
                .map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button
                        className="reception-link"
                        onClick={() => onInvoice(i.id)}
                      >
                        {i.number}
                      </button>
                    </td>
                    <td>{money(i.total)}</td>
                    <td>{money(i.paid)}</td>
                    <td>{money(i.balance)}</td>
                    <td>
                      {i.status === "DRAFT"
                        ? "Ноорог"
                        : i.balance === 0
                          ? "Төлсөн"
                          : i.paid > 0
                            ? "Хэсэгчлэн төлсөн"
                            : "Төлөгдөөгүй"}
                    </td>
                  </tr>
                ))}
            </Table>
            {invoices.data.total > invoices.data.items.length && (
              <Link href={`/erp/receivables?q=${p.phone}`}>
                Бүх төлөгдөөгүй төлбөрийг харах
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
function InvoiceForm({
  options,
  initial,
  onCancel,
  onSaved,
}: {
  options: Options;
  initial?: Record<string, unknown>;
  onCancel: () => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const [patientId, setPatientId] = useState(String(initial?.patientId || ""));
  const [items, setItems] = useState<
    {
      serviceId: string;
      treatmentId?: string;
      quantity: number;
      description: string;
      price: number;
    }[]
  >([]);
  const [serviceId, setServiceId] = useState(options.services[0]?.id || "");
  const unbilled = useResource<{ items: (Entity & { amount: number })[] }>(
    patientId ? `/api/reception/unbilled?patientId=${patientId}` : null,
  );
  return (
    <>
      <p>
        Үйлчилгээний батлагдсан үнэ эсвэл эмчийн бүртгэсэн эмчилгээний дүнгээр
        нэхэмжилнэ.
      </p>
      {!patientId && (
        <EntityForm
          fields={[
            {
              key: "patientId",
              label: "Өвчтөн",
              type: "patient",
              required: true,
            },
          ]}
          onCancel={onCancel}
          submitLabel="Сонгох"
          onSubmit={async (v) => setPatientId(String(v.patientId))}
        />
      )}
      {patientId && (
        <>
          {unbilled.error && (
            <Feedback retry={unbilled.retry}>{unbilled.error}</Feedback>
          )}
          <h3>Нэхэмжлээгүй эмчилгээ</h3>
          {unbilled.loading ? (
            <LoadingSkeleton />
          ) : unbilled.data?.items.length ? (
            unbilled.data.items.map((t) => (
              <p key={t.id}>
                {t.date} · {t.service?.name} · {t.doctor?.name} ·{" "}
                {money(t.amount)}{" "}
                <button
                  className="erp-secondary"
                  disabled={items.some((i) => i.treatmentId === t.id)}
                  onClick={() =>
                    setItems([
                      ...items,
                      {
                        serviceId: t.serviceId!,
                        treatmentId: t.id,
                        quantity: 1,
                        description: t.service!.name!,
                        price: t.amount,
                      },
                    ])
                  }
                >
                  Нэмэх
                </button>
              </p>
            ))
          ) : (
            <p>Нэхэмжлээгүй эмчилгээ байхгүй.</p>
          )}
          <div className="reception-filters">
            <label>
              Зөвшөөрөгдсөн үйлчилгээ
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                {options.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {money(s.price!)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="erp-secondary"
              onClick={() => {
                const s = options.services.find((s) => s.id === serviceId);
                if (s)
                  setItems([
                    ...items,
                    {
                      serviceId,
                      quantity: 1,
                      description: s.name!,
                      price: s.price!,
                    },
                  ]);
              }}
            >
              Нэмэх
            </button>
          </div>
          <Table headers={["Үйлчилгээ", "Дүн", ""]}>
            {items.map((i, index) => (
              <tr key={index}>
                <td>{i.description}</td>
                <td>{money(i.price)}</td>
                <td>
                  <button
                    className="erp-secondary"
                    onClick={() =>
                      setItems(items.filter((_, n) => n !== index))
                    }
                  >
                    Хасах
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          <p>
            Нийлбэр:{" "}
            <strong>{money(items.reduce((s, i) => s + i.price, 0))}</strong>
          </p>
          <EntityForm
            fields={[
              {
                key: "dueDate",
                label: "Төлөх хугацаа",
                type: "date",
                required: true,
                default: today(),
              },
            ]}
            onCancel={onCancel}
            submitLabel="Ноорог үүсгэх"
            onSubmit={async (v) => {
              if (!items.length) throw new Error("Үйлчилгээ нэмнэ үү.");
              const i = await api<Invoice>(
                "/api/reception/invoice-create",
                "POST",
                {
                  ...v,
                  patientId,
                  appointmentId: initial?.appointmentId,
                  items: items.map(({ serviceId, treatmentId, quantity }) => ({
                    serviceId,
                    treatmentId,
                    quantity,
                  })),
                },
              );
              onSaved(i);
            }}
          />
        </>
      )}
    </>
  );
}
function InvoiceDetail({
  id,
  version,
  onSaved,
}: {
  id: string;
  version: number;
  onSaved: () => void;
}) {
  const request = useResource<Invoice>(
    `/api/reception/invoice?id=${encodeURIComponent(id)}`,
    version,
  );
  const [receiptId, setReceiptId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useModalGuard(busy);
  if (request.error)
    return <Feedback retry={request.retry}>{request.error}</Feedback>;
  if (!request.data) return <LoadingSkeleton />;
  const i = request.data;
  const total =
    i.status === "DRAFT"
      ? i.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
      : i.total;
  if (receiptId)
    return (
      <>
        <p className="reception-success" role="status">
          Төлбөр амжилттай бүртгэгдлээ.
        </p>
        <Receipt id={receiptId} />
      </>
    );
  async function action(name: string, itemId?: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/reception/${name}`, "POST", { id, itemId });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ExportDocument
        title={i.status === "DRAFT" ? "Нэхэмжлэхийн ноорог" : "Нэхэмжлэх"}
        period={`Үүсгэсэн: ${clinicTimestamp(i.createdAt)} · Төлөх хугацаа: ${i.dueDate}`}
        reference={i.number}
        printable={i.status !== "DRAFT"}
        printLabel="Нэхэмжлэх хэвлэх / PDF хадгалах"
      >
        <p className="reception-id">{i.number}</p>
        <p>
          {i.patient.name} · {i.patient.phone}
        </p>
        <p>
          {i.appointment?.doctor?.name} · {i.appointment?.date}
        </p>
        <Table headers={["Үйлчилгээ", "Тоо", "Нэгж үнэ", "Дүн", ""]}>
          {i.items.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td>{line.quantity}</td>
              <td>{money(line.unitPrice)}</td>
              <td>{money(line.quantity * line.unitPrice)}</td>
              <td>
                {i.status === "DRAFT" && (
                  <button
                    className="erp-secondary reception-no-print"
                    disabled={busy}
                    onClick={() => action("invoice-remove-item", line.id)}
                  >
                    Хасах
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <p>
          Үйлчилгээний нийлбэр:{" "}
          {money(i.items.reduce((s, l) => s + l.quantity * l.unitPrice, 0))} ·
          Хөнгөлөлт: {money(0)}
        </p>
        <h3>
          Нийт: {money(total)} · Төлсөн: {money(i.paid)} · Үлдэгдэл:{" "}
          {money(i.status === "DRAFT" ? total : i.balance)}
        </h3>
        {i.credit > 0 && <p>Өмнөх илүү төлөлт: {money(i.credit)}</p>}
        <p>Төлөх хугацаа: {i.dueDate}</p>
        <h3>Бүртгэгдсэн гүйлгээнүүд</h3>
        <Table headers={["ID / Огноо", "Хэлбэр", "Лавлагаа", "Дүн", "Төлөв"]}>
          {i.payments.map((p) => (
            <tr key={p.id}>
              <td>
                {p.id}
                <small>{p.date}</small>
              </td>
              <td>{p.methodName || methodNames[p.method!]}</td>
              <td>{p.reference}</td>
              <td>{money(p.amount!)}</td>
              <td>{p.voidedAt ? "Хүчингүй" : "Бүртгэгдсэн"}</td>
            </tr>
          ))}
        </Table>
        <p>Энэ баримт нь дотоод төлбөрийн бүртгэл.</p>
      </ExportDocument>
      {error && <Feedback>{error}</Feedback>}
      <div className="reception-actions reception-no-print">
        {i.status === "DRAFT" ? (
          <button
            className="erp-primary"
            disabled={busy || !i.items.length}
            onClick={() => action("invoice-finalize")}
          >
            Нэхэмжлэх баталгаажуулах
          </button>
        ) : null}
      </div>
      {i.status === "FINALIZED" && i.balance > 0 && (
        <CheckoutForm
          key={`${i.id}:${i.paid}`}
          invoice={i}
          onSaved={(payments) => {
            setReceiptId(payments[0].id);
            onSaved();
          }}
        />
      )}
    </>
  );
}
function CashPanel({
  sessions,
  onAction,
}: {
  sessions: Session[];
  onAction: (kind: string) => void;
}) {
  const csv = useClinicCsv();
  const current = sessions.find((s) => !s.closedAt);
  return (
    <section className="reception-panel">
      <h2>Кассын ээлж</h2>
      {csv.error && <Feedback>{csv.error}</Feedback>}
      {current ? (
        <>
          <div className="cash-summary-bar">
            <span className="reception-status">Миний ээлж нээлттэй</span>
            <span>
              Эхлэх бэлэн <strong>{money(current.openingCash)}</strong>
            </span>
            <span>
              Кассанд байх бэлэн <strong>{money(current.expected)}</strong>
            </span>
            <span>
              Бэлэн бус <strong>{money(current.nonCash)}</strong>
            </span>
          </div>
          <div className="reception-actions">
            <button
              className="erp-secondary"
              onClick={() => onAction("cash-withdraw")}
            >
              Бэлэн мөнгө гаргах
            </button>
            <button
              className="erp-secondary"
              onClick={() => onAction("cash-close")}
            >
              Ээлж хаах
            </button>
          </div>
        </>
      ) : (
        <button className="erp-primary" onClick={() => onAction("cash-open")}>
          Кассын ээлж нээх
        </button>
      )}
      {current && (
        <details>
          <summary>Энэ ээлжийн төлбөр ба мөнгөний хөдөлгөөн</summary>
          <p>Нээсэн: {clinicTimestamp(current.openedAt)}</p>
          <Table headers={["Төлбөрийн огноо", "Хэлбэр", "Дүн"]}>
            {current.payments.map((p) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{p.methodName || methodNames[p.method!]}</td>
                <td>
                  {money(p.amount!)}
                  {p.voidedAt ? " · Хүчингүй" : ""}
                </td>
              </tr>
            ))}
          </Table>
          <h3>Бэлэн мөнгө гаргасан</h3>
          {current.withdrawals.map((w) => (
            <p key={w.id}>
              {money(w.amount)} · {w.reason}
            </p>
          ))}
          {!current.withdrawals.length && <p>Мөнгөн зарлага бүртгээгүй.</p>}
        </details>
      )}
      <details>
        <summary>Ээлжийн түүх / Хаалтын тайлан</summary>
        <Table
          headers={[
            "Нээсэн / Хаасан",
            "Эхлэх",
            "Тооцоолсон",
            "Тоолсон",
            "Зөрүү / Тайлбар",
            "",
          ]}
        >
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                {clinicTimestamp(s.openedAt)}
                <small>
                  {s.closedAt ? clinicTimestamp(s.closedAt) : "Нээлттэй"}
                </small>
              </td>
              <td>{money(s.openingCash)}</td>
              <td>{money(s.expected)}</td>
              <td>
                {s.actualCash === undefined || s.actualCash === null
                  ? "—"
                  : money(s.actualCash)}
              </td>
              <td>
                {money(s.discrepancy || 0)}
                <small>{s.explanation}</small>
              </td>
              <td>
                <button
                  className="erp-secondary"
                  disabled={csv.busy}
                  onClick={() =>
                    csv.download({
                      name: `cash-${s.id}`,
                      title: "Кассын ээлжийн тайлан",
                      period: `${clinicTimestamp(s.openedAt)} — ${s.closedAt ? clinicTimestamp(s.closedAt) : "Нээлттэй ээлж"}`,
                      reference: s.id,
                      rows: [
                        [
                          "Ээлж",
                          "Эхлэх",
                          "Тооцоолсон",
                          "Тоолсон",
                          "Зөрүү",
                          "Тайлбар",
                        ],
                        [
                          s.id,
                          s.openingCash,
                          s.expected,
                          s.actualCash ?? "",
                          s.discrepancy ?? "",
                          s.explanation,
                        ],
                        [],
                        ["Гүйлгээ", "Хэлбэр", "Дүн"],
                        ...s.payments.map(
                          (p) =>
                            [
                              p.id,
                              p.methodName || methodNames[p.method!],
                              p.amount!,
                            ] as (string | number)[],
                        ),
                      ],
                    })
                  }
                >
                  CSV
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </details>
    </section>
  );
}
function ReceptionReport({
  data,
  from,
  to,
}: {
  data: Report;
  from: string;
  to: string;
}) {
  const csv = useClinicCsv();
  const metrics = [
    ["Нэхэмжилсэн дүн", "billed"],
    ["Бодитоор цуглуулсан", "collected"],
    ["Нийт авлага (одоогийн)", "outstanding"],
    ["Хүчингүй гүйлгээ", "voided"],
    ["Буцаалтын хүсэлт (гүйцэтгээгүй)", "refundRequested"],
    ["Цаг захиалга", "appointments"],
    ["Өвчтөний тоо", "patients"],
  ];
  return (
    <section className="reception-panel">
      {csv.error && <Feedback>{csv.error}</Feedback>}
      <div className="reception-actions">
        <button
          className="erp-secondary"
          disabled={csv.busy}
          onClick={() =>
            csv.download({
              name: `reception-${from}-${to}`,
              title: "Ресепшний нэгдсэн тайлан",
              period: `${from} — ${to}`,
              rows: [
                ["Үзүүлэлт", "Утга"],
                ...metrics.map(([l, k]) => [l, data.statistics[k]]),
                [],
                ["Төлбөрийн хэлбэр", "Цуглуулсан"],
                ...data.methodBreakdown.map((m) => [m.name, m.amount]),
                [],
                ["Өдөр", "Цаг", "Өвчтөн", "Эмч", "Үйлчилгээ", "Төлөв"],
                ...data.appointments.map((a) => [
                  a.date!,
                  a.startTime!,
                  a.patient!.name!,
                  a.doctor!.name!,
                  a.service!.name!,
                  statusNames[a.status!],
                ]),
              ],
            })
          }
        >
          <Download size={16} /> Нэгдсэн CSV
        </button>
      </div>
      <div className="reception-stats">
        {metrics.map(([label, key]) => (
          <article key={key}>
            <span>{label}</span>
            <strong>
              {["appointments", "patients"].includes(key)
                ? data.statistics[key]
                : money(data.statistics[key])}
            </strong>
          </article>
        ))}
      </div>
      <h3>Төлбөрийн хэлбэрээр</h3>
      <Table headers={["Хэлбэр", "Цуглуулсан"]}>
        {data.methodBreakdown.map((m) => (
          <tr key={m.name}>
            <td>{m.name}</td>
            <td>{money(m.amount)}</td>
          </tr>
        ))}
      </Table>
      <h3>Өдөр тутмын үзлэг</h3>
      <Table headers={["Огноо", "Өвчтөн", "Эмч", "Төлөв"]}>
        {data.appointments.map((a) => (
          <tr key={a.id}>
            <td>
              {a.date} · {a.startTime}
            </td>
            <td>{a.patient?.name}</td>
            <td>{a.doctor?.name}</td>
            <td>
              <Badge value={a.status!} />
            </td>
          </tr>
        ))}
      </Table>
      <h3>Буцаалтын хүсэлт</h3>
      <Table headers={["ID", "Дүн", "Шалтгаан", "Төлөв"]}>
        {data.refunds.map((r) => (
          <tr key={r.id}>
            <td>{r.id.slice(0, 8)}</td>
            <td>{money(r.amount)}</td>
            <td>{r.reason}</td>
            <td>{r.status}</td>
          </tr>
        ))}
      </Table>
      <h3>Авлагын тайлан (одоогийн)</h3>
      <button
        className="erp-secondary"
        disabled={csv.busy}
        onClick={() =>
          csv.download({
            name: `receivables-${today()}`,
            title: "Төлөгдөөгүй төлбөрийн тайлан",
            period: "Татсан үеийн нийт үлдэгдэл",
            rows: [
              [
                "Нэхэмжлэх",
                "Өвчтөн",
                "Утас",
                "Нийт",
                "Төлсөн",
                "Авлага",
                "Хугацаа",
              ],
              ...data.receivables.map((i) => [
                i.number,
                i.patient.name!,
                i.patient.phone!,
                i.total,
                i.paid,
                i.balance,
                i.dueDate,
              ]),
            ],
          })
        }
      >
        Авлага CSV
      </button>
      <Table
        headers={["Өвчтөн", "Нэхэмжлэх", "Нийт", "Төлсөн", "Авлага", "Хугацаа"]}
      >
        {data.receivables.map((i) => (
          <tr key={i.id}>
            <td>
              {i.patient.name}
              <small>{i.patient.phone}</small>
            </td>
            <td>{i.number.slice(0, 24)}</td>
            <td>{money(i.total)}</td>
            <td>{money(i.paid)}</td>
            <td>{money(i.balance)}</td>
            <td>{i.dueDate}</td>
          </tr>
        ))}
      </Table>
      <h3>Миний кассын ээлж</h3>
      <Table headers={["Нээсэн", "Хаасан", "Зөрүү"]}>
        {data.sessions.map((s) => (
          <tr key={s.id}>
            <td>{clinicTimestamp(s.openedAt)}</td>
            <td>{s.closedAt ? clinicTimestamp(s.closedAt) : "Нээлттэй"}</td>
            <td>{money(s.discrepancy || 0)}</td>
          </tr>
        ))}
      </Table>
      <h3>Миний үйлдлийн түүх (сүүлийн 200)</h3>
      <Table headers={["Огноо", "Үйлдэл", "Бүртгэл"]}>
        {data.activity.map((a) => (
          <tr key={a.id}>
            <td>{clinicTimestamp(a.createdAt)}</td>
            <td>{receptionActionNames[a.action] || "Бүртгэл шинэчилсэн"}</td>
            <td>
              {(
                {
                  invoice: "Нэхэмжлэх",
                  payment: "Төлбөр",
                  queue: "Дараалал",
                  "cash-session": "Кассын ээлж",
                  patients: "Өвчтөн",
                  appointments: "Захиалга",
                  reschedule: "Цаг шилжүүлэх",
                  patient: "Өвчтөн",
                } as Record<string, string>
              )[a.entity] || "Бүртгэл"}
            </td>
          </tr>
        ))}
      </Table>
    </section>
  );
}
function Notifications({
  version,
  onRead,
}: {
  version: number;
  onRead: () => void;
}) {
  const request = useResource<{
    events: { id: string; action: string; entity: string; createdAt: string }[];
    pending: Entity[];
    followUps: Entity[];
    outstanding: { id: string; number: string; balance: number }[];
    upcoming: Entity[];
    readAt: string | null;
    asOf: string;
  }>("/api/reception/notifications", version);
  const [error, setError] = useState("");
  const [showRead, setShowRead] = useState(false);
  if (request.error)
    return <Feedback retry={request.retry}>{request.error}</Feedback>;
  if (!request.data) return <LoadingSkeleton />;
  const d = request.data;
  return (
    <section className="reception-panel">
      {error && <Feedback>{error}</Feedback>}
      <div className="reception-actions">
        <button
          className="erp-secondary"
          onClick={async () => {
            try {
              await api("/api/reception/notifications-read", "POST", {
                through: d.asOf,
              });
              onRead();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Уншсан гэж тэмдэглэх
        </button>
        <span>
          {d.events.filter((e) => !d.readAt || e.createdAt > d.readAt).length}{" "}
          шинэ үйл явдал
        </span>
      </div>
      <h3>Баталгаажуулах захиалга</h3>
      {d.pending.length ? (
        d.pending.map((a) => (
          <p key={a.id}>
            <Link href="/erp/appointments">
              Шинэ захиалга · {a.date} · {a.startTime}
            </Link>
          </p>
        ))
      ) : (
        <p>Хүлээгдэж буй захиалга байхгүй.</p>
      )}
      <h3>Өнөөдрийн удахгүй эхлэх үзлэг</h3>
      {d.upcoming.map((a) => (
        <p key={a.id}>
          <Link href="/erp/visits">
            {a.startTime} · {a.patient?.name}
          </Link>
        </p>
      ))}
      {!d.upcoming.length && <p>Удахгүй эхлэх захиалга байхгүй.</p>}
      <h3>Өнөөдрийн давтан үзлэг</h3>
      {d.followUps.map((a) => (
        <p key={a.id}>
          <Link href="/erp/visits">Давтан үзлэг · {a.startTime}</Link>
        </p>
      ))}
      <h3>Төлөх хугацаа болсон авлага</h3>
      {d.outstanding.map((i) => (
        <p key={i.id}>
          <Link href="/erp/receivables">
            {i.number.slice(0, 24)} · {money(i.balance)}
          </Link>
        </p>
      ))}
      <h3>Үйл явдал</h3>
      <label className="reception-check">
        <input
          type="checkbox"
          checked={showRead}
          onChange={(e) => setShowRead(e.target.checked)}
        />
        Уншсан мэдэгдлийг хамт харах
      </label>
      <Table headers={["Огноо", "Үйлдэл", "Хэсэг", "Төлөв"]}>
        {d.events
          .filter((e) => showRead || !d.readAt || e.createdAt > d.readAt)
          .map((e) => (
            <tr key={e.id}>
              <td>{clinicTimestamp(e.createdAt)}</td>
              <td>
                {receptionActionNames[e.action] || "Мэдээлэл шинэчлэгдсэн"}
              </td>
              <td>
                {(
                  {
                    appointments: "Цаг захиалга",
                    reschedule: "Цаг шилжүүлэх",
                    payments: "Төлбөр",
                    payment: "Төлбөр",
                    queue: "Дараалал",
                    leaves: "Хуваарь",
                  } as Record<string, string>
                )[e.entity] || "Үйл ажиллагаа"}
              </td>
              <td>{!d.readAt || e.createdAt > d.readAt ? "Шинэ" : "Уншсан"}</td>
            </tr>
          ))}
      </Table>
      {!d.events.some(
        (e) => showRead || !d.readAt || e.createdAt > d.readAt,
      ) && <p>Шинэ үйл явдал алга.</p>}
    </section>
  );
}

function ReceptionAppointmentForm(
  props: Parameters<typeof AppointmentForm>[0],
) {
  const [selectedPatient, setSelectedPatient] = useState(
    String(props.initial?.patientId || ""),
  );
  const [register, setRegister] = useState(false);
  const patient = useResource<Entity>(
    selectedPatient ? `/api/erp/patients/${selectedPatient}` : null,
  );
  return (
    <div className="reception-booking">
      <h3>1. Өвчтөн сонгох</h3>
      {!props.rescheduleId && (
        <>
          <label htmlFor="booking-patient">Өвчтөн</label>
          <PatientPicker
            id="booking-patient"
            value={selectedPatient}
            onChange={(id) => {
              setSelectedPatient(id);
              setRegister(false);
            }}
          />
          {!selectedPatient && (
            <button
              className="erp-secondary"
              onClick={() => setRegister(!register)}
            >
              + Шинэ өвчтөн бүртгэх
            </button>
          )}
        </>
      )}
      {register && (
        <EntityForm
          fields={patientFields}
          onCancel={() => setRegister(false)}
          onSubmit={async (values) => {
            const p = await api<Entity>("/api/erp/patients", "POST", values);
            setSelectedPatient(p.id);
            setRegister(false);
          }}
        />
      )}
      {patient.error && (
        <Feedback retry={patient.retry}>{patient.error}</Feedback>
      )}
      {patient.data && (
        <p>
          <strong>{patient.data.name}</strong> · {patient.data.phone}
        </p>
      )}
      {selectedPatient && patient.data && (
        <AppointmentForm
          {...props}
          key={selectedPatient}
          initial={{ ...props.initial, patientId: selectedPatient }}
        />
      )}
    </div>
  );
}
