"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  KeyRound,
} from "lucide-react";
import { useUser } from "./shell";
import Employees from "./employees";
import Profile from "./profile";
import BrandLoader from "../components/brand-loader";
import { useClinicBranding } from "../components/clinic-branding";
import RoleHome from "./role-home";
import RosterCalendar from "./roster-calendar";
import SettingsPanel from "./settings-panel";
import { employeeFields } from "./employee-fields";
import ImageUpload from "../components/image-upload";
import {
  api,
  Badge,
  Empty,
  EntityForm,
  Modal,
  Money,
  type Entity,
  type Field,
} from "./ui";
import {
  methodNames,
  money,
  roleNames,
  statusNames,
  today,
  clinicTimestamp,
  validTeeth,
} from "@/lib/domain";

type Options = { services: Entity[]; doctors: Entity[] };
type Dashboard = {
  revenue?: number;
  expense?: number;
  net?: number;
  charges?: number;
  balance?: number;
  appointmentCount: number;
  patientCount: number;
  statuses: Record<string, number>;
  methods?: Record<string, number>;
  byDoctor?: { name: string; count: number }[];
  byService?: {
    id: string;
    name: string;
    count: number;
    completed: number;
    treatments: number;
    charges: number;
    revenue: number;
  }[];
  monthly?: { label: string; income: number; expense: number }[];
};
const titles: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Хяналтын самбар",
    subtitle: "Эмнэлгийн өнөөгийн үзүүлэлт, өдөр тутмын ажлын тойм.",
  },
  appointments: {
    title: "Цаг захиалга",
    subtitle: "Өвчтөний цаг товлол, төлөв болон давтан үзлэг.",
  },
  calendar: {
    title: "Календарь",
    subtitle: "Өдөр, долоо хоног, сараар цаг товлолоо харах.",
  },
  patients: {
    title: "Өвчтөний бүртгэл",
    subtitle: "Мэдээллийн карт, үзлэгийн түүх, давтан захиалга.",
  },
  treatments: {
    title: "Шүдний схем, эмчилгээ",
    subtitle: "Онош, FDI шүдний дугаар, эмчилгээний нэгдсэн бүртгэл.",
  },
  services: {
    title: "Үйлчилгээ",
    subtitle:
      "Ангилал, үнэ, үргэлжлэх хугацаа болон нүүр хуудсанд харагдах үйлчилгээ.",
  },
  doctors: {
    title: "Эмч нар",
    subtitle: "Эмчийн мэргэжил, танилцуулга болон мэдээлэл.",
  },
  schedules: {
    title: "Ажлын хуваарь",
    subtitle: "Эмч бүрийн долоо хоногийн тогтмол ажлын цаг.",
  },
  leaves: {
    title: "Чөлөө, цагийн хаалт",
    subtitle: "Ажиллахгүй өдөр болон цагийн хязгаарыг тохируулах.",
  },
  payments: {
    title: "Касс, төлбөр",
    subtitle: "Дотоод төлбөрийн бүртгэл. Банкны гүйлгээ үүсгэхгүй.",
  },
  expenses: {
    title: "Зардлын бүртгэл",
    subtitle: "Эмнэлгийн үйл ажиллагааны зардлаа ангиллаар хянах.",
  },
  inventory: {
    title: "Бараа материал",
    subtitle: "Үлдэгдэл, доод нөөц, нийлүүлэгч болон барааны хөдөлгөөн.",
  },
  documents: {
    title: "Баримт, зөвшөөрөл",
    subtitle: "Өвчтөний маягт, зөвшөөрлийн текст, хэвлэх баримт.",
  },
  reports: {
    title: "Санхүү, үйл ажиллагааны тайлан",
    subtitle: "Сар, жил, бүх хугацааны дүнг Excel болон PDF-ээр татах.",
  },
  users: {
    title: "Ажилтан, эрх",
    subtitle: "Эмч, ресепшн, админы данс болон идэвхтэй төлөв.",
  },
  settings: {
    title: "Эмнэлгийн тохиргоо",
    subtitle: "Нүүр хуудсанд харагдах холбоо барих мэдээлэл.",
  },
  audit: {
    title: "Үйлдлийн түүх",
    subtitle: "Мэдээлэл үүсгэсэн, өөрчилсөн, устгасан болон экспортолсон түүх.",
  },
};
const weekdayNames = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];
const option = (items: Entity[]) =>
  items.map((i) => ({ value: i.id, label: i.name || i.id }));
const required = (
  key: string,
  label: string,
  type: Field["type"] = "text",
): Field => ({ key, label, type, required: true });
function fieldsFor(
  module: string,
  options: Options,
  doctorId?: string,
  editing = false,
): Field[] {
  const doctor: Field = {
    ...required("doctorId", "Эмч", "select"),
    options: option(options.doctors),
    default: doctorId,
  };
  const service: Field = {
    ...required("serviceId", "Үйлчилгээ", "select"),
    options: option(options.services),
  };
  const patient: Field = required("patientId", "Өвчтөн", "patient");
  const note: Field = { key: "note", label: "Тэмдэглэл", type: "textarea" };
  switch (module) {
    case "services":
      return [
        required("name", "Үйлчилгээний нэр"),
        required("category", "Ангилал"),
        { ...required("price", "Үнэ (₮)", "number"), min: 0, default: 0 },
        {
          ...required("duration", "Хугацаа (минут)", "number"),
          min: 15,
          max: 480,
          default: 30,
        },
        {
          key: "doctorIds",
          label: "Үйлчилгээ авах боломжтой эмч",
          type: "multiselect",
          options: option(options.doctors),
          hint: "Хоосон бол бүх идэвхтэй эмч. Хугацаа нь зөвхөн дотоод цагийн тооцоололд ашиглагдана.",
        },
        { key: "description", label: "Тайлбар", type: "textarea" },
        {
          key: "imageUrl",
          label: "Үйлчилгээний зураг",
          type: "image",
          imagePurpose: "services",
        },
        { key: "active", label: "Идэвхтэй", type: "checkbox" },
      ];
    case "patients":
      return [
        required("name", "Овог нэр"),
        required("phone", "Утас", "tel"),
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
        { key: "address", label: "Хаяг", type: "textarea" },
        { key: "allergies", label: "Харшил", type: "textarea" },
        { key: "medicalHistory", label: "Өвчний түүх", type: "textarea" },
      ];
    case "doctors":
      return [
        required("name", "Эмчийн нэр"),
        required("specialty", "Мэргэжил"),
        {
          key: "imageUrl",
          label: "Эмчийн зураг",
          type: "image",
          imagePurpose: "doctors",
        },
        { key: "telegramChatId", label: "Telegram Chat ID" },
        { key: "bio", label: "Танилцуулга", type: "textarea" },
        { key: "active", label: "Идэвхтэй", type: "checkbox" },
      ];
    case "users":
      return employeeFields(editing);
    case "approval":
      return [
        {
          key: "role",
          label: "Олгох эрх",
          type: "select",
          required: true,
          options: Object.entries(roleNames).map(([value, label]) => ({
            value,
            label,
          })),
        },
        {
          key: "status",
          label: "Хяналтын шийдвэр",
          type: "select",
          required: true,
          default: "APPROVED",
          options: [
            { value: "APPROVED", label: "Зөвшөөрч идэвхжүүлэх" },
            { value: "REJECTED", label: "Татгалзах" },
          ],
        },
      ];
    case "schedules":
      return [
        doctor,
        {
          key: "weekday",
          label: "Гараг",
          type: "select",
          required: true,
          options: weekdayNames.map((label, i) => ({
            value: String(i),
            label,
          })),
        },
        { ...required("startTime", "Эхлэх цаг", "time"), default: "09:00" },
        { ...required("endTime", "Дуусах цаг", "time"), default: "19:00" },
      ];
    case "leaves":
      return [
        doctor,
        { ...required("date", "Өдөр", "date"), default: today() },
        { ...required("startTime", "Эхлэх цаг", "time"), default: "00:00" },
        { ...required("endTime", "Дуусах цаг", "time"), default: "23:59" },
        required("reason", "Шалтгаан"),
      ];
    case "treatments":
      return [
        patient,
        doctor,
        service,
        { ...required("date", "Огноо", "date"), default: today() },
        {
          key: "tooth",
          label: "Шүдний FDI дугаар",
          type: "teeth",
        },
        required("diagnosis", "Онош"),
        {
          key: "procedure",
          label: "Хийсэн эмчилгээ",
          type: "textarea",
          required: true,
        },
        {
          ...required("amount", "Эмчилгээний дүн (₮)", "number"),
          min: 0,
          default: 0,
        },
        note,
      ];
    case "payments":
      return [
        patient,
        { ...required("amount", "Төлбөрийн дүн (₮)", "number"), min: 1 },
        {
          key: "method",
          label: "Төлбөрийн хэлбэр",
          type: "select",
          required: true,
          options: Object.entries(methodNames).map(([value, label]) => ({
            value,
            label,
          })),
        },
        { ...required("date", "Огноо", "date"), default: today() },
        note,
      ];
    case "expenses":
      return [
        required("title", "Зардлын нэр"),
        required("category", "Ангилал"),
        { ...required("amount", "Дүн (₮)", "number"), min: 1 },
        { ...required("date", "Огноо", "date"), default: today() },
        note,
      ];
    case "inventory":
      return [
        required("name", "Барааны нэр"),
        required("sku", "Барааны код"),
        { ...required("unit", "Хэмжих нэгж"), default: "ш" },
        { ...required("minimum", "Доод нөөц", "number"), min: 0, default: 5 },
        { key: "supplier", label: "Нийлүүлэгч" },
      ];
    case "movements":
      return [
        {
          ...required(
            "quantity",
            "Тоо хэмжээ (+ орлого / − зарлага)",
            "number",
          ),
          hint: "Жишээ: 10 бол нэмнэ, -3 бол хасна.",
        },
        required("reason", "Хөдөлгөөний шалтгаан"),
      ];
    case "documents":
      return [
        patient,
        required("title", "Баримтын нэр"),
        {
          key: "type",
          label: "Төрөл",
          type: "select",
          required: true,
          options: [
            { value: "CONSENT", label: "Зөвшөөрлийн маягт" },
            { value: "NOTE", label: "Тэмдэглэл" },
            { value: "REFERRAL", label: "Илгээх бичиг" },
          ],
        },
        { ...required("content", "Баримтын агуулга", "textarea") },
        {
          key: "consentName",
          label: "Зөвшөөрөл өгсөн хүний нэр",
          hint: "Цахим гарын үсэг биш. Хэвлэсний дараа гарын үсэг зурна.",
        },
      ];
    default:
      return [];
  }
}

export function ErpWorkspace() {
  const { section } = useParams<{ section?: string[] }>();
  const module = section?.[0] || "dashboard";
  // All sections share a catch-all route. Follow the current router params,
  // and give each section its own filters, forms and pending data requests.
  return <WorkspaceSection key={module} module={module} />;
}

function WorkspaceSection({ module }: { module: string }) {
  if (module === "profile") return <Profile />;
  if (module === "users") return <Employees />;
  if (module === "settings") return <SettingsPanel />;
  return (
    <>
      {module === "dashboard" && <RoleHome />}
      {(module === "schedules" || module === "calendar") && <RosterCalendar />}
      <Suspense fallback={<BrandLoader />}>
        <StandardWorkspace module={module} />
      </Suspense>
    </>
  );
}
function StandardWorkspace({ module }: { module: string }) {
  const { setLogoUrl } = useClinicBranding();
  const user = useUser();
  const urlParams = useSearchParams();
  const [search, setSearch] = useState(urlParams.get("q") || "");
  const [period, setPeriod] = useState(
    module === "dashboard" ? "month" : "all",
  );
  const [year, setYear] = useState(today().slice(0, 4));
  const [month, setMonth] = useState(today().slice(5, 7));
  const [page, setPage] = useState(1);
  const [calendarDate, setCalendarDate] = useState(today());
  const [calendarMode, setCalendarMode] = useState("day");
  const [status, setStatus] = useState("");
  const [reportService, setReportService] = useState("");
  const [items, setItems] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState<Dashboard | null>(null);
  const [options, setOptions] = useState<Options>({
    services: [],
    doctors: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState("");
  const [resetSendingId, setResetSendingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    resource: string;
    item?: Entity;
    initial?: Record<string, unknown>;
  } | null>(null);
  const [patient, setPatient] = useState<Entity | null>(null);
  const [document, setDocument] = useState<Entity | null>(null);
  useEffect(() => {
    setSearch(urlParams.get("q") || "");
    setPage(1);
    setPatient(null);
    setForm(null);
    setStatus("");
  }, [module, urlParams]);
  useEffect(() => {
    api<Options>("/api/erp/options")
      .then(setOptions)
      .catch(() => {});
  }, [version]);
  const params = useMemo(() => {
    const q = new URLSearchParams({
      q: search,
      page: String(page),
      period,
      year,
      month,
    });
    if (status) q.set("status", status);
    if (module === "reports" && reportService)
      q.set("serviceId", reportService);
    if (module === "calendar") {
      q.set("view", "calendar");
      q.set("period", "all");
      const selected = new Date(`${calendarDate}T12:00:00Z`);
      let from = calendarDate,
        to = calendarDate;
      if (calendarMode === "week") {
        selected.setUTCDate(
          selected.getUTCDate() - ((selected.getUTCDay() + 6) % 7),
        );
        from = selected.toISOString().slice(0, 10);
        selected.setUTCDate(selected.getUTCDate() + 6);
        to = selected.toISOString().slice(0, 10);
      } else if (calendarMode === "month") {
        from = `${calendarDate.slice(0, 7)}-01`;
        to = `${calendarDate.slice(0, 7)}-${new Date(Number(calendarDate.slice(0, 4)), Number(calendarDate.slice(5, 7)), 0).getDate()}`;
      }
      q.set("from", from);
      q.set("to", to);
    }
    return q;
  }, [
    search,
    page,
    period,
    year,
    month,
    module,
    calendarDate,
    calendarMode,
    status,
    reportService,
  ]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api<
        { items?: Entity[]; total?: number } & Dashboard
      >(
        `/api/erp/${module === "calendar" ? "appointments" : module}?${params}`,
      );
      if (module === "dashboard" || module === "reports") setData(response);
      else {
        setItems(response.items || []);
        setTotal(response.total || response.items?.length || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [module, params]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(timer);
  }, [load, version]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  const canCreate =
    user.role === "ADMIN"
      ? !["dashboard", "reports", "settings", "audit"].includes(module)
      : user.role === "RECEPTION"
        ? [
            "appointments",
            "calendar",
            "patients",
            "payments",
            "documents",
          ].includes(module)
        : ["schedules", "leaves", "treatments", "documents"].includes(module);
  const canEdit =
    user.role === "ADMIN"
      ? [
          "patients",
          "services",
          "doctors",
          "users",
          "inventory",
          "expenses",
          "treatments",
          "schedules",
          "leaves",
        ].includes(module)
      : user.role === "RECEPTION"
        ? module === "patients"
        : ["schedules", "leaves"].includes(module);
  const canDelete =
    user.role === "ADMIN"
      ? [
          "patients",
          "services",
          "doctors",
          "inventory",
          "expenses",
          "treatments",
          "documents",
          "schedules",
          "leaves",
        ].includes(module)
      : user.role === "DOCTOR" && ["schedules", "leaves"].includes(module);
  const saved = () => {
    setForm(null);
    setVersion((v) => v + 1);
    setToast("Амжилттай хадгаллаа.");
  };
  async function remove(item: Entity) {
    if (
      !window.confirm(
        `${item.name || item.title || "Бүртгэл"}-ийг ${["services", "doctors", "patients", "inventory"].includes(module) ? "идэвхгүй болгох" : "устгах"} уу?`,
      )
    )
      return;
    try {
      await api(`/api/erp/${module}/${item.id}`, "DELETE");
      setVersion((v) => v + 1);
      setToast("Шинэчлэгдлээ.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function changeStatus(item: Entity, value: string) {
    try {
      await api(`/api/erp/appointments/${item.id}`, "PATCH", { status: value });
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function showPatient(id: string) {
    try {
      setPatient(await api<Entity>(`/api/erp/patients/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const create = () =>
    setForm({
      resource: module === "calendar" ? "appointments" : module,
      initial:
        module === "payments"
          ? { idempotencyKey: crypto.randomUUID() }
          : undefined,
    });
  const exports = (
    <>
      <a className="erp-secondary" href={`/api/export/excel?${params}`}>
        <ArrowDownToLine size={16} />
        Excel
      </a>
      <a className="erp-primary" href={`/api/export/pdf?${params}`}>
        <FileText size={16} />
        PDF татах
      </a>
    </>
  );
  const title = titles[module];
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="erp-kicker">
            BB DENTAL ·{" "}
            {module === "dashboard" ? "ЕРӨНХИЙ ТОЙМ" : "АЖЛЫН ОРЧИН"}
          </p>
          <h1>{title.title}</h1>
          <p>{title.subtitle}</p>
        </div>
        <div className="workspace-heading-actions">
          <button
            className="erp-icon-button"
            aria-label="Шинэчлэх"
            onClick={() => setVersion((v) => v + 1)}
          >
            <RefreshCw size={18} />
          </button>
          {module === "reports"
            ? exports
            : canCreate && (
                <button className="erp-primary" onClick={create}>
                  <Plus size={18} />
                  {["appointments", "calendar"].includes(module)
                    ? "Цаг товлох"
                    : "Шинээр нэмэх"}
                </button>
              )}
        </div>
      </div>
      {module === "dashboard" && (
        <div className="greeting-strip">
          <span>
            Сайн байна уу, <strong>{user.name}</strong>{" "}
            <span className="greeting-dot">✦</span>
            <small>
              {`${today().slice(0, 4)} оны ${Number(today().slice(5, 7))}-р сарын ${Number(today().slice(8))} · ${weekdayNames[new Date(`${today()}T12:00Z`).getUTCDay()]}`}
            </small>
          </span>
          <Link href="/erp/calendar">
            Өнөөдрийн хуваарь <ArrowUpRight size={17} />
          </Link>
        </div>
      )}
      <div className="workspace-toolbar">
        {[
          "appointments",
          "calendar",
          "patients",
          "services",
          "treatments",
          "payments",
          "inventory",
        ].includes(module) && (
          <div className="workspace-search">
            <Search size={17} />
            <input
              aria-label="Бүртгэл хайх"
              placeholder="Нэр, утас, үйлчилгээ хайх…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
        {module === "reports" && (
          <label className="report-service-filter">
            Үйлчилгээ
            <select
              aria-label="Тайлангийн үйлчилгээ"
              value={reportService}
              onChange={(e) => setReportService(e.target.value)}
            >
              <option value="">Бүх үйлчилгээ</option>
              {options.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {module === "calendar" ? (
          <div className="period-filters">
            <input
              type="date"
              aria-label="Календарын өдөр"
              value={calendarDate}
              onChange={(e) => {
                setCalendarDate(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Календарын харагдац"
              value={calendarMode}
              onChange={(e) => {
                setCalendarMode(e.target.value);
                setPage(1);
              }}
            >
              <option value="day">Өдрөөр</option>
              <option value="week">Долоо хоногоор</option>
              <option value="month">Сараар</option>
            </select>
          </div>
        ) : (
          ![
            "services",
            "doctors",
            "patients",
            "schedules",
            "leaves",
            "users",
            "inventory",
            "settings",
            "audit",
            "documents",
          ].includes(module) && (
            <div className="period-filters">
              <select
                aria-label="Хугацаа"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Бүх хугацаа</option>
                <option value="month">Сараар</option>
                <option value="year">Жилээр</option>
                <option value="day">Өнөөдөр</option>
              </select>
              {["month", "year"].includes(period) && (
                <input
                  type="number"
                  aria-label="Жил"
                  value={year}
                  min={2000}
                  max={2100}
                  onChange={(e) => setYear(e.target.value)}
                />
              )}{" "}
              {period === "month" && (
                <select
                  aria-label="Сар"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option value={String(i + 1).padStart(2, "0")} key={i}>
                      {i + 1}-р сар
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        )}
        {["appointments", "calendar"].includes(module) && (
          <select
            className="status-filter"
            aria-label="Захиалгын төлөв"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Бүх төлөв</option>
            {Object.entries(statusNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      {toast && (
        <div className="erp-toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {error && (
        <div className="erp-alert" role="alert">
          {error}
          <button onClick={() => setVersion((v) => v + 1)}>
            Дахин оролдох
          </button>
        </div>
      )}
      {loading ? (
        <BrandLoader />
      ) : !error && (module === "dashboard" || module === "reports") && data ? (
        <DashboardView
          data={data}
          admin={user.role === "ADMIN"}
          reports={module === "reports"}
        />
      ) : !error && module === "settings" ? (
        <div className="settings-grid">
          <div className="erp-panel setting-card">
            <h3>Эмнэлгийн лого · Веб ба PDF</h3>
            <ImageUpload
              value={items.find((i) => i.key === "logoUrl")?.value || ""}
              purpose="logo"
              onChange={async (value) => {
                try {
                  await api("/api/erp/settings/logoUrl", "PATCH", { value });
                  setLogoUrl(value);
                  setItems((current) => [
                    ...current.filter((i) => i.key !== "logoUrl"),
                    { id: "logoUrl", key: "logoUrl", value },
                  ]);
                  setToast("Лого хадгалагдлаа.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </div>
          {["clinicName", "phone", "address", "hours", "reportTitle"].map(
            (key) => (
              <div className="erp-panel setting-card" key={key}>
                <h3>
                  {
                    {
                      clinicName: "Эмнэлгийн нэр",
                      phone: "Утас",
                      address: "Хаяг",
                      hours: "Ажиллах цаг",
                      reportTitle: "Тайлангийн гарчиг",
                    }[key]
                  }
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const value = String(
                      new FormData(e.currentTarget).get("value"),
                    );
                    try {
                      await api(`/api/erp/settings/${key}`, "PATCH", { value });
                      setToast("Тохиргоо хадгалагдлаа.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <input
                    name="value"
                    aria-label={key}
                    defaultValue={items.find((i) => i.key === key)?.value || ""}
                    required
                  />
                  <button className="erp-secondary">Хадгалах</button>
                </form>
              </div>
            ),
          )}
        </div>
      ) : !error && module === "calendar" ? (
        <CalendarView
          items={items}
          date={calendarDate}
          mode={calendarMode}
          onPatient={showPatient}
        />
      ) : (
        !error && (
          <div className="erp-panel data-panel">
            <div className="data-panel-header">
              <h2>{title.title}</h2>
              <span>{total} бүртгэл</span>
            </div>
            {items.length === 0 ? (
              <Empty />
            ) : (
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead>
                    <tr>
                      {columns(module).map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      <th className="actions-heading">Үйлдэл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id || item.key}>
                        {cells(module, item, showPatient).map((cell, i) => (
                          <td key={i}>{cell}</td>
                        ))}
                        <td>
                          <div className="row-actions">
                            {["appointments"].includes(module) && (
                              <>
                                <select
                                  aria-label="Төлөв өөрчлөх"
                                  value={item.status}
                                  onChange={(e) =>
                                    changeStatus(item, e.target.value)
                                  }
                                >
                                  {Object.entries(statusNames).map(
                                    ([value, label]) => (
                                      <option value={value} key={value}>
                                        {label}
                                      </option>
                                    ),
                                  )}
                                </select>
                                {user.role !== "DOCTOR" && (
                                  <button
                                    title="Давтан цаг"
                                    aria-label="Давтан цаг"
                                    onClick={() =>
                                      setForm({
                                        resource: "appointments",
                                        initial: {
                                          patientId: item.patientId,
                                          name: item.patient?.name,
                                          phone: item.patient?.phone,
                                          doctorId: item.doctorId,
                                          serviceId: item.serviceId,
                                          repeatOfId: item.id,
                                        },
                                      })
                                    }
                                  >
                                    <CalendarDays size={17} />
                                  </button>
                                )}
                              </>
                            )}
                            {module === "appointments" &&
                              user.role !== "DOCTOR" && (
                                <>
                                  <button
                                    title="Цаг шилжүүлэх"
                                    aria-label="Цаг шилжүүлэх"
                                    onClick={() =>
                                      setForm({
                                        resource: "reschedule",
                                        initial: {
                                          id: item.id,
                                          patientId: item.patientId,
                                          name: item.patient?.name,
                                          phone: item.patient?.phone,
                                          doctorId: item.doctorId,
                                          serviceId: item.serviceId,
                                          date: item.date,
                                        },
                                      })
                                    }
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    title="Төлбөр бүртгэх"
                                    aria-label="Төлбөр бүртгэх"
                                    onClick={() =>
                                      setForm({
                                        resource: "payments",
                                        initial: {
                                          patientId: item.patientId,
                                          appointmentId: item.id,
                                          amount: item.service?.price,
                                          idempotencyKey: crypto.randomUUID(),
                                        },
                                      })
                                    }
                                  >
                                    <CreditCard size={17} />
                                  </button>
                                </>
                              )}
                            {module === "appointments" &&
                              user.role !== "RECEPTION" && (
                                <button
                                  title="Эмчилгээ бүртгэх"
                                  aria-label="Эмчилгээ бүртгэх"
                                  onClick={() =>
                                    setForm({
                                      resource: "treatments",
                                      initial: {
                                        patientId: item.patientId,
                                        doctorId: item.doctorId,
                                        serviceId: item.serviceId,
                                        appointmentId: item.id,
                                        amount: item.service?.price,
                                      },
                                    })
                                  }
                                >
                                  <Stethoscope size={17} />
                                </button>
                              )}
                            {module === "patients" && (
                              <>
                                <button
                                  title="Карт харах"
                                  onClick={() => showPatient(item.id)}
                                >
                                  <FileText size={17} />
                                </button>
                                {user.role !== "DOCTOR" && (
                                  <button
                                    title="Цаг товлох"
                                    onClick={() =>
                                      setForm({
                                        resource: "appointments",
                                        initial: {
                                          patientId: item.id,
                                          name: item.name,
                                          phone: item.phone,
                                        },
                                      })
                                    }
                                  >
                                    <CalendarDays size={17} />
                                  </button>
                                )}
                              </>
                            )}
                            {module === "documents" && (
                              <>
                                <button
                                  title="Баримт харах"
                                  onClick={() => setDocument(item)}
                                >
                                  <FileText size={17} />
                                </button>
                                <a
                                  title="PDF татах"
                                  href={`/api/export/document?id=${item.id}`}
                                >
                                  <Download size={17} />
                                </a>
                              </>
                            )}
                            {module === "inventory" &&
                              user.role === "ADMIN" && (
                                <button
                                  title="Барааны хөдөлгөөн"
                                  onClick={() =>
                                    setForm({
                                      resource: "movements",
                                      initial: { itemId: item.id },
                                    })
                                  }
                                >
                                  <Plus size={17} />
                                </button>
                              )}
                            {module === "payments" &&
                              user.role === "ADMIN" &&
                              !item.voidedAt && (
                                <button
                                  title="Төлбөр хүчингүй болгох"
                                  onClick={async () => {
                                    const reason = window.prompt(
                                      "Хүчингүй болгох шалтгаан (3+ тэмдэгт):",
                                    );
                                    if (reason) {
                                      try {
                                        await api(
                                          `/api/erp/payments/${item.id}`,
                                          "PATCH",
                                          { reason },
                                        );
                                        setVersion((v) => v + 1);
                                      } catch (e) {
                                        setError((e as Error).message);
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 size={17} />
                                </button>
                              )}
                            {module === "users" && (
                              <button
                                title="Нууц үг сэргээх холбоосыг Telegram руу илгээх"
                                aria-label="Telegram руу сэргээх холбоос илгээх"
                                disabled={
                                  resetSendingId !== null ||
                                  !item.active ||
                                  item.approvalStatus !== "APPROVED" ||
                                  !item.telegramChatId ||
                                  !/^[1-9]\d{0,18}$/.test(item.telegramChatId)
                                }
                                onClick={async () => {
                                  setResetSendingId(item.id);
                                  setError("");
                                  try {
                                    const result = await api<{
                                      message: string;
                                    }>(
                                      `/api/erp/user-password-reset/${item.id}`,
                                      "POST",
                                      {},
                                    );
                                    setToast(result.message);
                                  } catch (e) {
                                    setError((e as Error).message);
                                  } finally {
                                    setResetSendingId(null);
                                  }
                                }}
                              >
                                <KeyRound size={17} />
                                {resetSendingId === item.id && "Илгээж байна…"}
                              </button>
                            )}
                            {module === "users" &&
                              item.approvalStatus === "PENDING" && (
                                <button
                                  title="Бүртгэл хянах"
                                  className="review-registration"
                                  onClick={() =>
                                    setForm({
                                      resource: "approval",
                                      initial: { id: item.id, role: item.role },
                                    })
                                  }
                                >
                                  <Check size={17} />
                                  Хянах
                                </button>
                              )}
                            {module === "doctors" &&
                              user.role !== "RECEPTION" && (
                                <button
                                  title="Telegram турших"
                                  aria-label="Telegram турших"
                                  onClick={async () => {
                                    try {
                                      await api(
                                        `/api/erp/telegram-test/${item.id}`,
                                        "POST",
                                        {},
                                      );
                                      setToast("Telegram мэдэгдэл илгээгдлээ.");
                                    } catch (e) {
                                      setError((e as Error).message);
                                    }
                                  }}
                                >
                                  <ArrowUpRight size={17} />
                                </button>
                              )}
                            {canEdit && (
                              <button
                                title="Засах"
                                aria-label="Засах"
                                onClick={() =>
                                  setForm({ resource: module, item })
                                }
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                className="danger-action"
                                title="Устгах / идэвхгүй болгох"
                                aria-label="Устгах / идэвхгүй болгох"
                                onClick={() => remove(item)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-pagination">
              <span>{page}-р хуудас · Нэг хуудсанд 50</span>
              <div>
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Өмнөх хуудас"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  disabled={items.length < 50}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Дараах хуудас"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>
        )
      )}
      {form && (
        <Modal
          title={
            form.item
              ? "Мэдээлэл засах"
              : form.resource === "appointments"
                ? "Үзлэгийн цаг товлох"
                : form.resource === "movements"
                  ? "Барааны хөдөлгөөн"
                  : "Шинэ бүртгэл"
          }
          onClose={() => setForm(null)}
        >
          {["appointments", "reschedule"].includes(form.resource) ? (
            <AppointmentForm
              options={options}
              rescheduleId={
                form.resource === "reschedule"
                  ? String(form.initial?.id)
                  : undefined
              }
              initial={form.initial}
              onCancel={() => setForm(null)}
              onSaved={saved}
            />
          ) : (
            <EntityForm
              fields={fieldsFor(
                form.resource,
                options,
                user.doctorId,
                Boolean(form.item),
              )}
              initial={
                (form.item || form.initial) as
                  Record<string, unknown> | undefined
              }
              onCancel={() => setForm(null)}
              onSubmit={async (values) => {
                const payload = { ...form.initial, ...values };
                if (
                  form.resource === "users" &&
                  payload.password &&
                  payload.password !== payload.passwordConfirmation
                )
                  throw new Error("Давтан нууц үг таарахгүй байна.");
                if (form.resource === "approval") {
                  await api(
                    `/api/erp/user-approval/${form.initial?.id}`,
                    "POST",
                    payload,
                  );
                  saved();
                  return;
                }
                if (form.resource === "payments")
                  payload.idempotencyKey ||= crypto.randomUUID();
                if (form.resource === "movements")
                  payload.itemId = form.initial?.itemId;
                if (form.resource === "treatments" && payload.tooth === "")
                  payload.tooth = null;
                await api(
                  `/api/erp/${form.resource}${form.item ? `/${form.item.id}` : ""}`,
                  form.item ? "PATCH" : "POST",
                  payload,
                );
                saved();
              }}
            />
          )}
        </Modal>
      )}
      {patient && (
        <Modal
          title="Өвчтөний мэдээллийн карт"
          onClose={() => setPatient(null)}
        >
          <PatientCard
            patient={patient}
            onRepeat={(a) => {
              setPatient(null);
              setForm({
                resource: "appointments",
                initial: {
                  patientId: patient.id,
                  name: patient.name,
                  phone: patient.phone,
                  doctorId: a.doctorId,
                  serviceId: a.serviceId,
                  repeatOfId: a.id,
                },
              });
            }}
            onTreatment={(tooth) => {
              setPatient(null);
              setForm({
                resource: "treatments",
                initial: {
                  patientId: patient.id,
                  tooth,
                  doctorId: user.doctorId,
                },
              });
            }}
          />
        </Modal>
      )}
      {document && (
        <Modal
          title={document.title || "Баримт"}
          onClose={() => setDocument(null)}
        >
          <div className="document-preview">
            <span>{document.patient?.name}</span>
            <p>{document.content}</p>
            <small>Зөвшөөрөл өгсөн нэр: {document.consentName || "—"}</small>
            <a
              className="erp-primary"
              href={`/api/export/document?id=${document.id}`}
            >
              <Download size={17} />
              PDF хэвлэх
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}

function columns(module: string): string[] {
  switch (module) {
    case "appointments":
      return ["Өвчтөн", "Өдөр, цаг", "Үйлчилгээ", "Эмч", "Төлөв"];
    case "patients":
      return ["Өвчтөн", "Утас", "Төрсөн огноо", "Харшил"];
    case "services":
      return ["Үйлчилгээ", "Ангилал", "Үнэ", "Хугацаа", "Төлөв"];
    case "doctors":
      return ["Эмч", "Мэргэжил", "Данс", "Төлөв"];
    case "users":
      return ["Ажилтан", "Холбоо барих", "Эрх", "Бүртгэлийн хяналт", "Төлөв"];
    case "schedules":
      return ["Эмч", "Гараг", "Эхлэх", "Дуусах"];
    case "leaves":
      return ["Эмч", "Огноо", "Цаг", "Шалтгаан"];
    case "treatments":
      return ["Өвчтөн", "Огноо", "Эмч / Үйлчилгээ", "Шүд / Онош", "Дүн"];
    case "payments":
      return ["Өвчтөн", "Огноо", "Хэлбэр", "Дүн", "Төлөв"];
    case "expenses":
      return ["Зардал", "Ангилал", "Огноо", "Дүн"];
    case "inventory":
      return ["Бараа / Код", "Үлдэгдэл", "Доод нөөц", "Нийлүүлэгч"];
    case "documents":
      return ["Баримт", "Өвчтөн", "Төрөл", "Огноо"];
    case "audit":
      return ["Огноо", "Үйлдэл", "Модуль", "Бүртгэл", "Ажилтны ID"];
    default:
      return ["Нэр"];
  }
}
function cells(
  module: string,
  i: Entity,
  onPatient: (id: string) => void,
): React.ReactNode[] {
  const person = i.patient ? (
    <button
      className="patient-cell"
      onClick={() => onPatient(i.patientId || i.patient!.id)}
    >
      <span className="patient-avatar">{i.patient.name?.slice(0, 1)}</span>
      <span>
        <strong>{i.patient.name}</strong>
        <small>{i.patient.phone}</small>
      </span>
    </button>
  ) : null;
  const active = (
    <span
      className={`erp-badge ${i.active ? "badge-completed" : "badge-cancelled"}`}
    >
      {i.active ? "Идэвхтэй" : "Идэвхгүй"}
    </span>
  );
  switch (module) {
    case "appointments":
      return [
        person,
        <span key="date">
          <strong>{i.date}</strong>
          <small>
            {i.startTime}–{i.endTime}
          </small>
        </span>,
        i.service?.name,
        i.doctor?.name,
        <Badge key="status" value={i.status || ""} />,
      ];
    case "patients":
      return [
        <button
          key="name"
          className="patient-cell"
          onClick={() => onPatient(i.id)}
        >
          <span className="patient-avatar">{i.name?.slice(0, 1)}</span>
          <strong>{i.name}</strong>
        </button>,
        i.phone,
        i.birthDate || "—",
        i.allergies || "—",
      ];
    case "services":
      return [
        <strong key="name">{i.name}</strong>,
        <span className="category-tag" key="cat">
          {i.category}
        </span>,
        <Money key="price" value={i.price || 0} />,
        `${i.duration} мин`,
        active,
      ];
    case "doctors":
      return [
        <strong key="name">{i.name}</strong>,
        i.specialty,
        i.user?.phone || "Данс холбоогүй",
        active,
      ];
    case "users":
      return [
        <strong key="name">{i.name}</strong>,
        <span key="contact">
          {i.phone}
          <small>{i.email || "Имэйл бүртгэлгүй"}</small>
        </span>,
        <Badge key="role" value={i.role || ""} />,
        <span
          key="approval"
          className={`erp-badge badge-${i.approvalStatus === "PENDING" ? "pending" : i.approvalStatus === "REJECTED" ? "cancelled" : "completed"}`}
        >
          {i.approvalStatus === "PENDING"
            ? "Зөвшөөрөл хүлээж байна"
            : i.approvalStatus === "REJECTED"
              ? "Татгалзсан"
              : "Зөвшөөрсөн"}
        </span>,
        active,
      ];
    case "schedules":
      return [
        i.doctor?.name,
        weekdayNames[i.weekday || 0],
        i.startTime,
        i.endTime,
      ];
    case "leaves":
      return [i.doctor?.name, i.date, `${i.startTime}–${i.endTime}`, i.reason];
    case "treatments":
      return [
        person,
        i.date,
        <span key="doctor">
          <strong>{i.doctor?.name}</strong>
          <small>{i.service?.name}</small>
        </span>,
        <span key="tooth">
          <strong>{i.tooth ? `Шүд ${i.tooth}` : "—"}</strong>
          <small>{i.diagnosis}</small>
        </span>,
        <Money key="amount" value={i.amount || 0} />,
      ];
    case "payments":
      return [
        person,
        i.date,
        <Badge key="method" value={i.method || ""} />,
        <Money key="amount" value={i.amount || 0} />,
        <span
          key="status"
          className={`erp-badge ${i.voidedAt ? "badge-cancelled" : "badge-completed"}`}
        >
          {i.voidedAt ? "Хүчингүй" : "Хадгалсан"}
        </span>,
      ];
    case "expenses":
      return [
        i.title,
        i.category,
        i.date,
        <Money key="amount" value={i.amount || 0} />,
      ];
    case "inventory":
      return [
        <span key="name">
          <strong>{i.name}</strong>
          <small>{i.sku}</small>
        </span>,
        <span
          key="stock"
          className={
            (i.quantity || 0) <= (i.minimum || 0) ? "stock-low" : "stock-ok"
          }
        >
          {i.quantity} {i.unit}
        </span>,
        i.minimum,
        i.supplier || "—",
      ];
    case "documents":
      return [
        i.title,
        i.patient?.name,
        (
          {
            CONSENT: "Зөвшөөрөл",
            NOTE: "Тэмдэглэл",
            REFERRAL: "Илгээх бичиг",
          } as Record<string, string>
        )[i.type || ""] || i.type,
        i.createdAt?.slice(0, 10),
      ];
    case "audit":
      return [
        i.createdAt?.replace("T", " ").slice(0, 19),
        i.action,
        i.entity,
        i.entityId,
        i.actorId,
      ];
    default:
      return [i.name];
  }
}

function AppointmentForm({
  options,
  rescheduleId,
  initial,
  onCancel,
  onSaved,
}: {
  options: Options;
  rescheduleId?: string;
  initial?: Record<string, unknown>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [slotError, setSlotError] = useState("");
  const [doctorId, setDoctorId] = useState(
    String(initial?.doctorId || options.doctors[0]?.id || ""),
  );
  const [serviceId, setServiceId] = useState(
    String(initial?.serviceId || options.services[0]?.id || ""),
  );
  const [date, setDate] = useState(String(initial?.date || today()));
  const selectedService = options.services.find((s) => s.id === serviceId);
  const eligibleDoctors = options.doctors.filter(
    (d) =>
      !selectedService?.doctorIds?.length ||
      selectedService.doctorIds.includes(d.id),
  );
  useEffect(() => {
    if (!eligibleDoctors.some((d) => d.id === doctorId))
      setDoctorId(eligibleDoctors[0]?.id || "");
  }, [serviceId, doctorId, options.doctors, options.services]);
  useEffect(() => {
    setSlots([]);
    if (!doctorId || !serviceId || !date) return;
    let alive = true;
    api<{ slots: string[] }>(
      `/api/erp/availability?${new URLSearchParams({ doctorId, serviceId, date, ...(rescheduleId ? { excludeId: rescheduleId } : {}) })}`,
    )
      .then((r) => {
        if (alive) {
          setSlots(r.slots);
          setSlotError("");
        }
      })
      .catch((e) => {
        if (alive) setSlotError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [doctorId, serviceId, date, rescheduleId]);
  return (
    <>
      <div className="appointment-availability">
        <h3>Боломжит цаг шалгах</h3>
        <div>
          <select
            aria-label="Боломжит цагийн эмч"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            {eligibleDoctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Боломжит цагийн үйлчилгээ"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            {options.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Боломжит цагийн өдөр"
            type="date"
            value={date}
            min={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <p>
          {slotError ||
            (slots.length
              ? slots.join(" · ")
              : "Энэ өдөр боломжит цаг байхгүй байна.")}
        </p>
      </div>
      <EntityForm
        key={`${doctorId}-${serviceId}-${date}`}
        fields={[
          ...(initial?.patientId
            ? []
            : [
                {
                  key: "patientId",
                  label: "Бүртгэлтэй өвчтөн сонгох (эсвэл доор шинээр бүртгэх)",
                  type: "patient" as const,
                },
                { key: "name", label: "Шинэ өвчтөний нэр" },
                {
                  key: "phone",
                  label: "Шинэ өвчтөний утас",
                  type: "tel" as const,
                },
              ]),
          {
            key: "startTime",
            label: "Эхлэх цаг",
            type: "select",
            required: true,
            options: slots.map((s) => ({ value: s, label: s })),
          },
          { key: "note", label: "Тэмдэглэл", type: "textarea" },
        ]}
        initial={initial}
        onCancel={onCancel}
        submitLabel="Цаг баталгаажуулах"
        onSubmit={async (values) => {
          let payload: Record<string, unknown> = {
            ...initial,
            ...values,
            doctorId,
            serviceId,
            date,
          };
          if (payload.patientId) {
            const patient = await api<Entity>(
              `/api/erp/patients/${payload.patientId}`,
            );
            payload = { ...payload, name: patient.name, phone: patient.phone };
          } else if (!payload.name || !payload.phone)
            throw new Error("Өвчтөн сонгох эсвэл нэр, утсыг оруулна уу.");
          await api(
            rescheduleId
              ? `/api/erp/reschedule/${rescheduleId}`
              : "/api/erp/appointments",
            "POST",
            payload,
          );
          onSaved();
        }}
      />
    </>
  );
}

function PatientCard({
  patient,
  onRepeat,
  onTreatment,
}: {
  patient: Entity;
  onRepeat: (a: Entity) => void;
  onTreatment: (tooth: number) => void;
}) {
  const user = useUser();
  const [notes, setNotes] = useState(patient.notes || []);
  const [transfers, setTransfers] = useState(patient.transfers || []);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [cardError, setCardError] = useState("");
  const [cardMessage, setCardMessage] = useState("");
  const [transferDoctors, setTransferDoctors] = useState<Entity[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const adultRows = [
    [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  ];
  const babyRows = [
    [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
    [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
  ];
  const [dentition, setDentition] = useState("adult");
  const rows = dentition === "adult" ? adultRows : babyRows;
  return (
    <div className="patient-card">
      <div className="patient-card-top">
        <span className="patient-avatar large">
          {patient.name?.slice(0, 1)}
        </span>
        <div>
          <h3>{patient.name}</h3>
          <p>
            {patient.phone} · {patient.birthDate || "Төрсөн огноо бүртгэлгүй"}
          </p>
        </div>
        <a
          href={`/api/export/patient?id=${patient.id}`}
          className="erp-secondary"
        >
          <Download size={16} />
          PDF карт
        </a>
      </div>
      <div className="patient-info">
        <p>
          <small>Хаяг</small>
          {patient.address || "Бүртгэлгүй"}
        </p>
        <p>
          <small>Харшил</small>
          {patient.allergies || "Бүртгэлгүй"}
        </p>
        <p>
          <small>Өвчний түүх</small>
          {patient.medicalHistory || "Бүртгэлгүй"}
        </p>
      </div>
      <section
        className="patient-internal-notes"
        aria-labelledby="internal-notes-title"
      >
        <div className="panel-title">
          <h3 id="internal-notes-title">Эмнэлгийн дотоод тэмдэглэл</h3>
          {user.role !== "RECEPTION" && (
            <button
              className="erp-secondary"
              onClick={async () => {
                try {
                  const response = await api<{ items: Entity[] }>(
                    "/api/erp/transfer-options",
                  );
                  setTransferDoctors(response.items);
                  setTransferOpen(true);
                  setCardError("");
                } catch (e) {
                  setCardError((e as Error).message);
                }
              }}
            >
              <ArrowUpRight size={15} />
              Эмчид шилжүүлэх
            </button>
          )}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setNoteBusy(true);
            setCardError("");
            try {
              await api("/api/erp/patient-notes", "POST", {
                patientId: patient.id,
                content: noteText,
              });
              const updated = await api<Entity>(
                `/api/erp/patients/${patient.id}`,
              );
              setNotes(updated.notes || []);
              setNoteText("");
              setCardMessage("Тэмдэглэл карт дээр хадгалагдлаа.");
            } catch (e) {
              setCardError((e as Error).message);
            } finally {
              setNoteBusy(false);
            }
          }}
        >
          <label htmlFor="patient-note">Дотоод тэмдэглэл бичих</label>
          <textarea
            id="patient-note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={10000}
            required
            rows={3}
            placeholder="Өвчтөний тухай эмнэлгийн дотоод тэмдэглэл…"
          />
          <button
            className="erp-primary"
            disabled={noteBusy || !noteText.trim()}
          >
            {noteBusy ? "Хадгалж байна…" : "Тэмдэглэл хадгалах"}
          </button>
        </form>
        {notes.length ? (
          <div className="internal-note-list">
            {notes.map((note) => (
              <article key={note.id}>
                <p>{note.content}</p>
                <small>
                  {note.author?.name} ·{" "}
                  {roleNames[note.author?.role || "DOCTOR"]} ·{" "}
                  {note.createdAt ? clinicTimestamp(note.createdAt) : ""}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Дотоод тэмдэглэл бүртгэлгүй.</p>
        )}
      </section>
      {transferOpen && (
        <section className="patient-transfer-form">
          <h3>Өвчтөнийг эмчид шилжүүлэх</h3>
          <p>Карт, эмчилгээний түүхийг хүлээн авах эмчид нээнэ.</p>
          <EntityForm
            fields={[
              ...(user.role === "ADMIN"
                ? [
                    {
                      key: "sourceDoctorId",
                      label: "Шилжүүлж буй эмч",
                      type: "select" as const,
                      required: true,
                      options: option(transferDoctors),
                    },
                  ]
                : []),
              {
                key: "targetDoctorId",
                label: "Хүлээн авах эмч",
                type: "select",
                required: true,
                options: option(
                  transferDoctors.filter((d) => d.id !== user.doctorId),
                ),
              },
              {
                key: "reason",
                label: "Шилжүүлэх шалтгаан",
                type: "textarea",
                required: true,
              },
            ]}
            initial={{
              sourceDoctorId:
                user.doctorId || patient.appointments?.[0]?.doctorId,
            }}
            onCancel={() => setTransferOpen(false)}
            submitLabel="Шилжүүлэх"
            onSubmit={async (data) => {
              await api("/api/erp/transfers", "POST", {
                ...data,
                sourceDoctorId: user.doctorId || data.sourceDoctorId,
                patientId: patient.id,
              });
              const updated = await api<Entity>(
                `/api/erp/patients/${patient.id}`,
              );
              setTransfers(updated.transfers || []);
              setTransferOpen(false);
              setCardMessage("Өвчтөний карт хүлээн авах эмчид нээгдлээ.");
            }}
          />
        </section>
      )}
      {transfers.length > 0 && (
        <section className="patient-transfer-history">
          <h3>Эмч хоорондын шилжүүлэг</h3>
          {transfers.map((t) => (
            <article key={t.id}>
              <strong>
                {t.sourceDoctor?.name} → {t.targetDoctor?.name}
              </strong>
              <p>{t.reason}</p>
              <small>{t.createdAt ? clinicTimestamp(t.createdAt) : ""}</small>
            </article>
          ))}
        </section>
      )}
      {cardError && (
        <div className="erp-alert" role="alert">
          {cardError}
        </div>
      )}
      {cardMessage && (
        <p className="card-success" role="status">
          {cardMessage}
        </p>
      )}
      <div className="tooth-chart">
        <div className="panel-title">
          <h3>Шүдний схем · FDI</h3>
          <select
            aria-label="Шүдний төрөл"
            value={dentition}
            onChange={(e) => setDentition(e.target.value)}
          >
            <option value="adult">Байнгын шүд</option>
            <option value="baby">Сүүн шүд</option>
          </select>
        </div>
        <p>
          Тэмдэглэсэн шүд нь эмчилгээний бүртгэлтэй. Шүд сонгон шинэ эмчилгээ
          бүртгэнэ.
        </p>
        {rows.map((row, index) => (
          <div className="tooth-row" key={index}>
            {row.map((tooth) => (
              <button
                key={tooth}
                className={
                  patient.treatments?.some((t) => t.tooth === tooth)
                    ? "treated"
                    : ""
                }
                title={`Шүд ${tooth}`}
                disabled={user.role === "RECEPTION"}
                onClick={() => onTreatment(tooth)}
              >
                <svg
                  width="24"
                  height="30"
                  viewBox="0 0 24 30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M12 5C5-1 1 6 5 13c2 4 1 12 4 12 2 0 0-10 3-10s1 10 3 10c3 0 2-8 4-12 4-7 0-14-7-8Z" />
                </svg>
                <span>{tooth}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <h3>Үзлэгийн түүх</h3>
      {!patient.appointments?.length ? (
        <Empty text="Үзлэгийн түүх бүртгэлгүй." />
      ) : (
        patient.appointments.map((a) => (
          <div className="history-row" key={a.id}>
            <div>
              <strong>{a.service?.name}</strong>
              <small>
                {a.date} · {a.startTime} · {a.doctor?.name}
              </small>
            </div>
            <Badge value={a.status || ""} />
            {user.role !== "DOCTOR" && (
              <button className="erp-secondary" onClick={() => onRepeat(a)}>
                <CalendarDays size={15} />
                Давтан цаг
              </button>
            )}
          </div>
        ))
      )}
      <h3>Эмчилгээний түүх</h3>
      {!patient.treatments?.length ? (
        <p className="muted">Эмчилгээний тэмдэглэл бүртгэлгүй.</p>
      ) : (
        patient.treatments.map((t) => (
          <div className="treatment-history" key={t.id}>
            <strong>
              {t.date} · {t.service?.name} · Шүд {t.tooth || "—"}
            </strong>
            <small>{t.doctor?.name}</small>
            <p>Онош: {t.diagnosis}</p>
            <p>{t.procedure}</p>
            <p>{t.note}</p>
            <Money value={t.amount || 0} />
          </div>
        ))
      )}
      {user.role !== "DOCTOR" && (
        <>
          <h3>Төлбөрийн түүх</h3>
          {patient.payments
            ?.filter((p) => !p.voidedAt)
            .map((p) => (
              <div className="history-row" key={p.id}>
                <span>{p.date}</span>
                <Badge value={p.method || ""} />
                <Money value={p.amount || 0} />
              </div>
            ))}
          <div className="patient-balance">
            Эмчилгээ − төлбөрийн зөрүү{" "}
            <Money
              value={
                (patient.treatments || []).reduce(
                  (s, t) => s + (t.amount || 0),
                  0,
                ) -
                (patient.payments || [])
                  .filter((p) => !p.voidedAt)
                  .reduce((s, p) => s + (p.amount || 0), 0)
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function CalendarView({
  items,
  date,
  mode,
  onPatient,
}: {
  items: Entity[];
  date: string;
  mode: string;
  onPatient: (id: string) => void;
}) {
  const start = new Date(`${date}T12:00:00Z`);
  if (mode === "week")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const dates =
    mode === "month"
      ? Array.from(
          {
            length: new Date(
              Number(date.slice(0, 4)),
              Number(date.slice(5, 7)),
              0,
            ).getDate(),
          },
          (_, i) => `${date.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`,
        )
      : Array.from({ length: mode === "week" ? 7 : 1 }, (_, i) => {
          const d = new Date(start);
          d.setUTCDate(d.getUTCDate() + i);
          return d.toISOString().slice(0, 10);
        });
  return (
    <div className={`calendar-grid calendar-${mode}`}>
      {dates.map((day) => {
        const appts = items
          .filter((a) => a.date === day)
          .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
        return (
          <div
            className={`calendar-day ${day === today() ? "is-today" : ""}`}
            key={day}
          >
            <div className="calendar-day-title">
              <strong>
                {day.slice(8)}{" "}
                <small>
                  {weekdayNames[new Date(`${day}T12:00Z`).getUTCDay()]}
                </small>
              </strong>
              <span>{appts.length}</span>
            </div>
            {appts.length ? (
              appts.map((a) => (
                <button
                  className={`calendar-event event-${a.status?.toLowerCase()}`}
                  key={a.id}
                  onClick={() => onPatient(a.patientId!)}
                >
                  <strong>
                    {a.startTime} · {a.patient?.name}
                  </strong>
                  <span>{a.service?.name}</span>
                  <small>{a.doctor?.name}</small>
                  <Badge value={a.status || ""} />
                </button>
              ))
            ) : (
              <p className="calendar-free">Цаг товлоогүй</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DashboardView({
  data,
  admin,
  reports,
}: {
  data: Dashboard;
  admin: boolean;
  reports: boolean;
}) {
  const metrics = admin
    ? [
        {
          label: "Нийт орлого",
          value: money(data.revenue || 0),
          icon: Wallet,
          color: "teal",
          hint: "Хадгалсан төлбөрийн нийлбэр",
        },
        {
          label: "Нийт зардал",
          value: money(data.expense || 0),
          icon: CreditCard,
          color: "amber",
          hint: "Бүртгэсэн зардлын нийлбэр",
        },
        {
          label: "Нийт захиалга",
          value: String(data.appointmentCount),
          icon: CalendarDays,
          color: "violet",
          hint: `${data.statuses.COMPLETED || 0} үзлэг дууссан`,
        },
        {
          label: "Үйлчлүүлэгч",
          value: String(data.patientCount),
          icon: Users,
          color: "blue",
          hint: "Давхардалгүй өвчтөний тоо",
        },
      ]
    : [
        {
          label: "Захиалга",
          value: String(data.appointmentCount),
          icon: CalendarDays,
          color: "teal",
          hint: "Сонгосон хугацаанд",
        },
        {
          label: "Өвчтөн",
          value: String(data.patientCount),
          icon: Users,
          color: "blue",
          hint: "Холбоотой өвчтөний тоо",
        },
        {
          label: "Хүлээгдэж буй",
          value: String(data.statuses.PENDING || 0),
          icon: Stethoscope,
          color: "amber",
          hint: "Баталгаажуулах захиалга",
        },
        {
          label: "Дууссан үзлэг",
          value: String(data.statuses.COMPLETED || 0),
          icon: Check,
          color: "violet",
          hint: "Эмчилгээ дууссан",
        },
      ];
  const monthly = data.monthly || [];
  const max = Math.max(1, ...monthly.flatMap((m) => [m.income, m.expense]));
  const chart =
    monthly.length === 1
      ? [{ label: "", income: 0, expense: 0 }, ...monthly]
      : monthly;
  const points = chart
    .map(
      (m, i) =>
        `${40 + i * (660 / Math.max(1, chart.length - 1))},${225 - (m.income / max) * 180}`,
    )
    .join(" ");
  const colors = [
    "#008a8c",
    "#8d83e8",
    "#5da6e7",
    "#eeae4c",
    "#ed8f9c",
    "#9bacc4",
  ];
  return (
    <>
      {admin && reports && (
        <section className="erp-panel service-report">
          <div className="panel-title">
            <div>
              <h2>Үйлчилгээ тус бүрийн тайлан</h2>
              <p>Эмчилгээний дүн болон тухайн захиалгад холбогдсон төлбөр</p>
            </div>
          </div>
          <div className="erp-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Үйлчилгээ</th>
                  <th>Захиалга</th>
                  <th>Дууссан</th>
                  <th>Эмчилгээ</th>
                  <th>Эмчилгээний дүн</th>
                  <th>Хүлээн авсан төлбөр</th>
                </tr>
              </thead>
              <tbody>
                {data.byService?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.count}</td>
                    <td>{s.completed}</td>
                    <td>{s.treatments}</td>
                    <td>{money(s.charges)}</td>
                    <td>{money(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>
            Захиалгад холбоогүй шууд төлбөрийг үйлчилгээнд хуваарилахгүй.
            Үйлчилгээгээр шүүхэд нийтлэг зардлыг оруулахгүй.
          </small>
        </section>
      )}

      <div className="metric-grid">
        {metrics.map((m) => (
          <div className="metric-card" key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <i className={`metric-icon ${m.color}`}>
                <m.icon size={20} />
              </i>
            </div>
            <strong>{m.value}</strong>
            <small>{m.hint}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        {admin && (
          <section className="erp-panel cashflow-panel">
            <div className="panel-title">
              <div>
                <h2>Мөнгөн урсгал</h2>
                <p>Бодитоор бүртгэсэн орлого, зардал</p>
              </div>
              <span className="subtle-icon">
                <TrendingUp size={19} />
              </span>
            </div>
            <div className="cashflow-total">
              <span>
                <small>ЦЭВЭР ДҮН</small>
                <strong>{money(data.net || 0)}</strong>
              </span>
              <span className="chart-legend">
                <i />
                Орлого
              </span>
            </div>
            {monthly.length ? (
              <div className="line-chart">
                <svg
                  viewBox="0 0 740 260"
                  role="img"
                  aria-label="Сараар харуулсан орлогын график"
                >
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00858a" stopOpacity=".17" />
                      <stop offset="100%" stopColor="#00858a" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0, 1, 2, 3].map((v) => (
                    <g key={v}>
                      <line
                        x1="40"
                        y1={45 + v * 60}
                        x2="700"
                        y2={45 + v * 60}
                        stroke="#e5eaf0"
                        strokeDasharray="3 6"
                      />
                      <text x="0" y={49 + v * 60} fontSize="10" fill="#94a0b0">
                        {Math.round((max * (1 - v / 3)) / 1000)}k
                      </text>
                    </g>
                  ))}
                  <polygon
                    points={`40,225 ${points} 700,225`}
                    fill="url(#chartFill)"
                  />
                  <polyline
                    points={points}
                    stroke="#00858a"
                    strokeWidth="3"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  {chart.map((m, i) => (
                    <g key={i}>
                      <circle
                        cx={40 + i * (660 / Math.max(1, chart.length - 1))}
                        cy={225 - (m.income / max) * 180}
                        r="4"
                        fill="white"
                        stroke="#00858a"
                        strokeWidth="2"
                      >
                        <title>
                          {m.label}: {money(m.income)}
                        </title>
                      </circle>
                      <text
                        x={40 + i * (660 / Math.max(1, chart.length - 1))}
                        y="252"
                        fontSize="10"
                        fill="#94a0b0"
                        textAnchor="middle"
                      >
                        {m.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <Empty text="Орлого бүртгэгдэхэд график харагдана." />
            )}
          </section>
        )}
        <section className="erp-panel status-panel">
          <div className="panel-title">
            <div>
              <h2>Захиалгын төлөв</h2>
              <p>Үзлэгийн явцын тойм</p>
            </div>
            <MoreHorizontal size={20} />
          </div>
          <div
            className="status-donut"
            style={{
              background: data.appointmentCount
                ? `conic-gradient(${Object.entries(data.statuses)
                    .map(([, count], i, all) => {
                      const before =
                        (all.slice(0, i).reduce((s, [, n]) => s + n, 0) /
                          data.appointmentCount) *
                        100;
                      return `${colors[i]} ${before}% ${before + (count / data.appointmentCount) * 100}%`;
                    })
                    .join(",")})`
                : "#edf1f6",
            }}
          >
            <div>
              <small>НИЙТ ЗАХИАЛГА</small>
              <strong>{data.appointmentCount}</strong>
            </div>
          </div>
          <div className="status-list">
            {Object.entries(data.statuses).map(([status, count], i) => (
              <div key={status}>
                <span>
                  <i style={{ background: colors[i] }} />
                  {statusNames[status]}
                </span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>
        {admin && (
          <section className="erp-panel income-panel">
            <div className="panel-title">
              <div>
                <h2>Орлого ба зардал</h2>
                <p>Сар бүрийн харьцуулалт</p>
              </div>
              <span className="category-tag">MNT</span>
            </div>
            <div className="income-totals">
              <span>
                <i />
                НИЙТ ОРЛОГО<strong>{money(data.revenue || 0)}</strong>
              </span>
              <span>
                <i />
                НИЙТ ЗАРДАЛ<strong>{money(data.expense || 0)}</strong>
              </span>
            </div>
            {monthly.length ? (
              <div className="bar-chart">
                {monthly.map((m) => (
                  <div className="bar-group" key={m.label}>
                    <div>
                      <i
                        style={{
                          height: `${Math.max(2, (m.income / max) * 130)}px`,
                        }}
                        title={money(m.income)}
                      />
                      <i
                        style={{
                          height: `${Math.max(2, (m.expense / max) * 130)}px`,
                        }}
                        title={money(m.expense)}
                      />
                    </div>
                    <small>{m.label.slice(5)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Гүйлгээний мэдээлэл байхгүй." />
            )}
          </section>
        )}
        <section className="erp-panel doctor-workload">
          <div className="panel-title">
            <div>
              <h2>{admin ? "Эмчийн ачаалал" : "Шуурхай үйлдэл"}</h2>
              <p>
                {admin
                  ? "Сонгосон хугацааны захиалгаар"
                  : "Өдөр тутмын ажлын холбоосууд"}
              </p>
            </div>
            <Stethoscope size={20} />
          </div>
          {admin ? (
            data.byDoctor?.length ? (
              data.byDoctor.map((d) => (
                <div className="workload-row" key={d.name}>
                  <span className="patient-avatar">{d.name.slice(0, 1)}</span>
                  <span>
                    <strong>{d.name}</strong>
                    <div className="workload-bar">
                      <i
                        style={{
                          width: `${(d.count / Math.max(1, data.appointmentCount)) * 100}%`,
                        }}
                      />
                    </div>
                  </span>
                  <b>{d.count}</b>
                </div>
              ))
            ) : (
              <Empty text="Эмчийн захиалга бүртгэлгүй." />
            )
          ) : (
            <div className="quick-links">
              <Link href="/erp/calendar">
                <CalendarDays />
                Өнөөдрийн хуваарь
                <ArrowUpRight />
              </Link>
              <Link href="/erp/patients">
                <Users />
                Өвчтөний карт
                <ArrowUpRight />
              </Link>
              <Link href="/erp/services">
                <Stethoscope />
                Үйлчилгээ хайх
                <ArrowUpRight />
              </Link>
            </div>
          )}
        </section>
        {admin && (
          <section className="erp-panel payment-summary">
            <div className="panel-title">
              <div>
                <h2>Төлбөрийн хэлбэр</h2>
                <p>Дотоод кассын бүртгэл</p>
              </div>
              <CreditCard size={20} />
            </div>
            {Object.entries(data.methods || {}).map(([method, amount]) => (
              <div className="method-summary" key={method}>
                <span>{methodNames[method]}</span>
                <Money value={amount} />
              </div>
            ))}
            {reports && (
              <div className="report-note">
                Энэ нь стандарт тайлан. Тусгай загварыг дараа тохируулна. Банкны
                төлбөр баталгаажуулсан баримт биш.
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
