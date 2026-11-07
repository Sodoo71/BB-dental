"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Printer,
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
  type Entity,
  type Field,
} from "./ui";
import { AppointmentForm, CalendarView } from "./workspace";
import { useUser } from "./shell";
import {
  clinicTimestamp,
  methodNames,
  money,
  statusNames,
  today,
} from "@/lib/domain";
import { queueNames, queueTransitions } from "@/lib/reception-domain";
import "./reception.css";

type Invoice = {
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
type Session = {
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
  withdrawals: { amount: number; reason: string }[];
};
type Report = {
  statistics: Record<string, number>;
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
  dashboard: "Хяналтын самбар",
  patients: "Өвчтөнүүд",
  appointments: "Цаг захиалга",
  visits: "Өнөөдрийн үзлэг",
  queue: "Дараалал",
  payments: "Касс / POS",
  transactions: "Гүйлгээ",
  receivables: "Авлага",
  notifications: "Мэдэгдэл",
  reports: "Тайлан",
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
function exportRows(name: string, rows: (string | number)[][]) {
  const csv =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(cell)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
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
  const query = new URLSearchParams({
    date: module === "visits" ? today() : date,
    from: date,
    to: ["reports", "transactions"].includes(module) ? to : date,
    q: search,
    page: String(page),
    status,
    method,
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
    module === "queue" ? `/api/reception/queue?${query}` : null,
    version,
  );
  const invoices = useResource<{
    items: Invoice[];
    total: number;
    balance: number;
    patientBalances: Record<string, number>;
  }>(
    ["payments", "receivables"].includes(module)
      ? `/api/reception/${resource}?${query}`
      : null,
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
            { kind: "patient", label: "Өвчтөн бүртгэх", icon: Users },
            { kind: "appointment", label: "Цаг захиалах", icon: CalendarDays },
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
          <Link className="erp-primary" href="/erp/payments">
            <CreditCard size={18} /> Касс нээх
          </Link>
        </div>
      )}
      {module === "dashboard" && data.data && (
        <div className="reception-stats">
          {[
            ["Нийт захиалга", "appointments"],
            ["Баталгаажсан", "confirmed"],
            ["Ирсэн өвчтөн", "checkedIn"],
            ["Хүлээж буй", "waiting"],
            ["Эмчилж буй", "inProgress"],
            ["Дууссан үзлэг", "completed"],
            ["Цуглуулсан төлбөр", "collected"],
            ["Нийт авлага", "outstanding"],
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
      {module !== "notifications" && (
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
                disabled={module === "visits"}
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
                  {Object.entries(methodNames).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
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
                  "Эмч / Цаг",
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
            <CashPanel
              sessions={sessions.data?.items || []}
              onAction={(kind) => setModal({ kind })}
            />
          )}
          {["payments", "receivables"].includes(module) && (
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
                      {methodNames[p.method || ""]}
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
                            onClick={() => setInvoiceId(p.invoiceId!)}
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
  const invoices = useResource<{ items: Invoice[]; balance: number }>(
    `/api/reception/invoices?patientId=${id}`,
    version,
  );
  if (patient.error || invoices.error)
    return <Feedback>{patient.error || invoices.error}</Feedback>;
  if (!patient.data || !invoices.data) return <LoadingSkeleton />;
  const p = patient.data;
  return (
    <div className="reception-profile">
      <h2>{p.name}</h2>
      <p>
        {p.phone} · {p.birthDate || "Төрсөн огноогүй"} ·{" "}
        {p.address || "Хаяггүй"}
      </p>
      <small>ID: {p.id}</small>
      {p.allergies && (
        <p role="note" className="reception-alert">
          Харшил: {p.allergies}
        </p>
      )}
      <h3>Нийт үлдэгдэл: {money(invoices.data.balance)}</h3>
      <Table headers={["Нэхэмжлэх", "Төлсөн", "Үлдэгдэл"]}>
        {invoices.data.items.map((i) => (
          <tr key={i.id}>
            <td>
              <button
                className="reception-link"
                onClick={() => onInvoice(i.id)}
              >
                {i.number.slice(0, 24)}
              </button>
            </td>
            <td>{money(i.paid)}</td>
            <td>{money(i.balance)}</td>
          </tr>
        ))}
      </Table>
      <h3>Цаг захиалгын түүх</h3>
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
      <h3>Төлбөрийн түүх</h3>
      <Table headers={["Огноо", "Хэлбэр", "Дүн", "Төлөв"]}>
        {p.payments?.map((a) => (
          <tr key={a.id}>
            <td>{a.date}</td>
            <td>{methodNames[a.method!]}</td>
            <td>{money(a.amount!)}</td>
            <td>{a.voidedAt ? "Хүчингүй" : "Бүртгэгдсэн"}</td>
          </tr>
        ))}
      </Table>
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
        Үнийн жагсаалт болон эмчийн бүртгэсэн эмчилгээний дүнг сервер шалгана.
        Ресепшн хөнгөлөлт өөрчлөх эрхгүй.
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
  const [collection, setCollection] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (request.error)
    return <Feedback retry={request.retry}>{request.error}</Feedback>;
  if (!request.data) return <LoadingSkeleton />;
  const i = request.data;
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
      <div className="reception-print">
        <h2>
          BB DENTAL ·{" "}
          {i.status === "DRAFT" ? "Ноорог" : "Нэхэмжлэх / Төлбөрийн баримт"}
        </h2>
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
          Нийт: {money(i.total)} · Төлсөн: {money(i.paid)} · Үлдэгдэл:{" "}
          {money(i.balance)}
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
              <td>{methodNames[p.method!]}</td>
              <td>{p.reference}</td>
              <td>{money(p.amount!)}</td>
              <td>{p.voidedAt ? "Хүчингүй" : "Бүртгэгдсэн"}</td>
            </tr>
          ))}
        </Table>
        <p>Энэ баримт нь дотоод төлбөрийн бүртгэл.</p>
      </div>
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
        ) : (
          <>
            <button className="erp-secondary" onClick={() => window.print()}>
              <Printer size={16} /> Баримт хэвлэх
            </button>
            {i.balance > 0 && (
              <button
                className="erp-primary"
                onClick={() => setCollection(!collection)}
              >
                Төлбөр / Хэсэгчилсэн төлөлт
              </button>
            )}
          </>
        )}
      </div>
      {collection && (
        <CollectionForm
          invoice={i}
          onSaved={() => {
            setCollection(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}
function CollectionForm({
  invoice,
  onSaved,
}: {
  invoice: Invoice;
  onSaved: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [allocations, setAllocations] = useState([
    { method: "CASH", amount: String(invoice.balance), reference: "" },
  ]);
  const [total, setTotal] = useState(String(invoice.balance));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useResource<{ items: Session[] }>(
    "/api/reception/cash-sessions",
  );
  const active = session.data?.items.find((s) => !s.closedAt);
  return (
    <form
      className="reception-collection reception-no-print"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (!confirmed)
            throw new Error(
              "Бодитоор хүлээн авсан төлбөрийг баталгаажуулна уу.",
            );
          await api("/api/reception/collect", "POST", {
            invoiceId: invoice.id,
            idempotencyKey: key,
            amount: Number(total),
            allocations: allocations.map((a) => ({
              ...a,
              amount: Number(a.amount),
            })),
          });
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Төлбөр хүлээн авах</h3>
      <p>
        Бэлэн бус төлбөрийг банк / терминалаас шалгаж, бодит гүйлгээний дугаарыг
        оруулна. QPay болон картын төлбөрийг энэ системээр үүсгэхгүй.
      </p>
      {!active && (
        <p className="reception-alert">Кассын ээлж нээх шаардлагатай.</p>
      )}
      {error && <Feedback>{error}</Feedback>}
      <label>
        Энэ удаа төлөх дүн
        <input
          type="number"
          min="1"
          max={invoice.balance}
          required
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
      </label>
      {allocations.map((a, index) => (
        <fieldset key={index} disabled={busy}>
          <legend>Хуваарилалт {index + 1}</legend>
          <label>
            Хэлбэр
            <select
              value={a.method}
              onChange={(e) =>
                setAllocations(
                  allocations.map((v, n) =>
                    n === index ? { ...v, method: e.target.value } : v,
                  ),
                )
              }
            >
              {Object.entries(methodNames).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Дүн
            <input
              type="number"
              min="1"
              required
              value={a.amount}
              onChange={(e) =>
                setAllocations(
                  allocations.map((v, n) =>
                    n === index ? { ...v, amount: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          {a.method !== "CASH" && (
            <label>
              Баталгаажсан гүйлгээний дугаар
              <input
                required
                minLength={3}
                value={a.reference}
                onChange={(e) =>
                  setAllocations(
                    allocations.map((v, n) =>
                      n === index ? { ...v, reference: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
          )}
          {allocations.length > 1 && (
            <button
              type="button"
              className="erp-secondary"
              onClick={() =>
                setAllocations(allocations.filter((_, n) => n !== index))
              }
            >
              Хасах
            </button>
          )}
        </fieldset>
      ))}
      <div className="reception-actions">
        <button
          className="erp-secondary"
          type="button"
          disabled={busy || allocations.length >= 4}
          onClick={() =>
            setAllocations([
              ...allocations,
              { method: "TRANSFER", amount: "", reference: "" },
            ])
          }
        >
          Төлбөр хуваах
        </button>
        <span>
          Нийлбэр:{" "}
          {money(allocations.reduce((s, a) => s + Number(a.amount), 0))}
        </span>
      </div>
      <label className="reception-check">
        <input
          type="checkbox"
          required
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Мөнгө хүлээн авсан, гүйлгээг шалгасан
      </label>
      <button className="erp-primary" disabled={busy || !active}>
        {busy ? "Бүртгэж байна…" : "Төлбөр бүртгэх"}
      </button>
    </form>
  );
}
function CashPanel({
  sessions,
  onAction,
}: {
  sessions: Session[];
  onAction: (kind: string) => void;
}) {
  const current = sessions.find((s) => !s.closedAt);
  return (
    <section className="reception-panel">
      <h2>Кассын ээлж</h2>
      {current ? (
        <>
          <div className="reception-stats">
            <article>
              <span>Эхлэх бэлэн</span>
              <strong>{money(current.openingCash)}</strong>
            </article>
            <article>
              <span>Тооцоолсон бэлэн</span>
              <strong>{money(current.expected)}</strong>
            </article>
            <article>
              <span>Бэлэн бус төлөлт</span>
              <strong>{money(current.nonCash)}</strong>
            </article>
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
                  onClick={() =>
                    exportRows(`cash-${s.id}`, [
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
                          [p.id, methodNames[p.method!], p.amount!] as (
                            string | number
                          )[],
                      ),
                    ])
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
      <div className="reception-actions">
        <button
          className="erp-secondary"
          onClick={() =>
            exportRows(`reception-${from}-${to}`, [
              ["Үзүүлэлт", "Утга"],
              ...metrics.map(([l, k]) => [l, data.statistics[k]]),
              [],
              ["Төлбөрийн хэлбэр", "Цуглуулсан"],
              ...Object.entries(data.methods).map(([k, v]) => [
                methodNames[k],
                v,
              ]),
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
            ])
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
        {Object.entries(data.methods).map(([k, v]) => (
          <tr key={k}>
            <td>{methodNames[k]}</td>
            <td>{money(v)}</td>
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
        onClick={() =>
          exportRows(`receivables-${to}`, [
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
          ])
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
            <td>{a.action}</td>
            <td>{a.entity}</td>
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
    readAt: string | null;
    asOf: string;
  }>("/api/reception/notifications", version);
  const [error, setError] = useState("");
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
      <Table headers={["Огноо", "Үйлдэл", "Хэсэг", "Төлөв"]}>
        {d.events.map((e) => (
          <tr key={e.id}>
            <td>{clinicTimestamp(e.createdAt)}</td>
            <td>{e.action}</td>
            <td>{e.entity}</td>
            <td>{!d.readAt || e.createdAt > d.readAt ? "Шинэ" : "Уншсан"}</td>
          </tr>
        ))}
      </Table>
      {!d.events.length && <Empty />}
    </section>
  );
}

function ReceptionAppointmentForm(
  props: Parameters<typeof AppointmentForm>[0],
) {
  const [search, setSearch] = useState("");
  return (
    <>
      <label className="reception-doctor-search">
        Эмч хайх
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Нэр, мэргэжил…"
        />
      </label>
      <AppointmentForm
        {...props}
        options={{
          ...props.options,
          doctors: props.options.doctors.filter((d) =>
            `${d.name} ${d.specialty}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ),
        }}
      />
    </>
  );
}
