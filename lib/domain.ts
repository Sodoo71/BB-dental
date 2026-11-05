import { z } from "zod";
export const roles = ["ADMIN", "DOCTOR", "RECEPTION"] as const;
export type Role = (typeof roles)[number];
export const roleNames: Record<Role, string> = {
  ADMIN: "Админ",
  DOCTOR: "Эмч",
  RECEPTION: "Ресепшн",
};
export const statusNames: Record<string, string> = {
  PENDING: "Хүлээгдэж буй",
  CONFIRMED: "Баталгаажсан",
  ARRIVED: "Ирсэн",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцалсан",
  NO_SHOW: "Ирээгүй",
};
export const methodNames: Record<string, string> = {
  CASH: "Бэлэн",
  CARD: "Карт",
  TRANSFER: "Шилжүүлэг",
  QPAY: "QPay",
};
export const normalizePhone = (phone: string) =>
  phone.replace(/\D/g, "").replace(/^976(?=\d{8}$)/, "");
export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^[6-9]\d{7}$/, "8 оронтой зөв утас оруулна уу."));
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Огноо буруу байна.",
  );
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Цаг буруу байна.");
export const moneySchema = z.coerce.number().int().min(0).max(1_000_000_000);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const nowTime = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const clock = (value: number) =>
  `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
export const overlaps = (
  start: string,
  end: string,
  otherStart: string,
  otherEnd: string,
) => start < otherEnd && end > otherStart;
export function periodRange(
  period: string | null,
  year: string | null,
  month: string | null,
) {
  const y = Number(year || today().slice(0, 4));
  const m = Number(month || today().slice(5, 7));
  if (
    !Number.isInteger(y) ||
    y < 2000 ||
    y > 2100 ||
    !Number.isInteger(m) ||
    m < 1 ||
    m > 12
  )
    throw new Error("Тайлангийн огноо буруу байна.");
  if (period === "all") return {};
  if (period === "year") return { gte: `${y}-01-01`, lt: `${y + 1}-01-01` };
  if (period === "day") return { gte: today(), lte: today() };
  return {
    gte: `${y}-${String(m).padStart(2, "0")}-01`,
    lt:
      m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`,
  };
}
export const money = (n: number) =>
  new Intl.NumberFormat("mn-MN").format(n) + " ₮";
export const validTeeth = [
  ...Array.from({ length: 4 }, (_, q) =>
    Array.from({ length: 8 }, (_, i) => (q + 1) * 10 + i + 1),
  ).flat(),
  ...Array.from({ length: 4 }, (_, q) =>
    Array.from({ length: 5 }, (_, i) => (q + 5) * 10 + i + 1),
  ).flat(),
];

export function clinicTimestamp(value: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ulaanbaatar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
