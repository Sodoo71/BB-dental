import { z } from "zod";
import { dateSchema, moneySchema } from "./domain";
export const receptionActionNames: Record<string, string> = {
  CREATE: "Шинэ бүртгэл",
  UPDATE: "Бүртгэл шинэчлэгдсэн",
  CHECK_IN: "Өвчтөн ирсэн",
  PAYMENT_RECEIVED: "Төлбөр бүртгэгдсэн",
  REFUND_REQUESTED: "Буцаалтын хүсэлт",
  QUEUE_CALLED: "Өвчтөн дуудагдсан",
  QUEUE_IN_PROGRESS: "Үзлэг эхэлсэн",
  QUEUE_COMPLETED: "Үзлэг дууссан",
  QUEUE_CANCELLED: "Дараалал цуцлагдсан",
  QUEUE_WAITING: "Хүлээлтэд шилжсэн",
  CASH_OPENED: "Кассын ээлж нээгдсэн",
  CASH_CLOSED: "Кассын ээлж хаагдсан",
  CASH_WITHDRAWAL: "Бэлэн мөнгө гаргасан",
  INVOICE_CREATED: "Нэхэмжлэх үүссэн",
  "INVOICE-FINALIZE": "Нэхэмжлэх баталгаажсан",
  "INVOICE-REMOVE-ITEM": "Нэхэмжлэхийн мөр хассан",
  PATIENT_ARCHIVED: "Өвчтөн архивлагдсан",
  APPOINTMENT_CONFIRMED: "Захиалга баталгаажсан",
  APPOINTMENT_CANCELLED: "Захиалга цуцлагдсан",
  APPOINTMENT_NO_SHOW: "Өвчтөн ирээгүй",
};
export const queueNames: Record<string, string> = {
  WAITING: "Хүлээж байна",
  CALLED: "Дуудагдсан",
  IN_PROGRESS: "Эмчлүүлж байна",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцалсан",
};
export const queueTransitions: Record<string, readonly string[]> = {
  WAITING: ["CALLED", "CANCELLED"],
  CALLED: ["WAITING", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
export const invoiceBalance = (invoice: {
  total: number;
  payments: { amount: number; voidedAt: unknown }[];
}) => {
  const paid = invoice.payments
    .filter((p) => !p.voidedAt)
    .reduce((s, p) => s + p.amount, 0);
  return {
    paid,
    balance: Math.max(0, invoice.total - paid),
    credit: Math.max(0, paid - invoice.total),
    paymentStatus:
      paid === 0 ? "UNPAID" : paid < invoice.total ? "PARTIAL" : "PAID",
  };
};
export const expectedCash = (
  opening: number,
  payments: { amount: number; method: string; voidedAt: unknown }[],
  withdrawals: { amount: number }[],
) =>
  opening +
  payments
    .filter((p) => p.method === "CASH" && !p.voidedAt)
    .reduce((s, p) => s + p.amount, 0) -
  withdrawals.reduce((s, p) => s + p.amount, 0);
export const allocationSchema = z
  .object({
    paymentMethodId: z.string().uuid().optional(),
    method: z.enum(["CASH", "TRANSFER", "CARD", "QPAY"]).optional(),
    amount: moneySchema.refine((n) => n > 0),
    reference: z.string().trim().max(200).default(""),
  })
  .refine(
    (a) => Boolean(a.paymentMethodId || a.method),
    "Төлбөрийн хэлбэр сонгоно уу.",
  );
export const collectionSchema = z
  .object({
    invoiceId: z.string().min(1).max(100),
    idempotencyKey: z.string().uuid(),
    amount: moneySchema.refine((n) => n > 0),
    allocations: z.array(allocationSchema).min(1).max(12),
  })
  .refine(
    (d) => d.allocations.reduce((s, a) => s + a.amount, 0) === d.amount,
    "Төлбөрийн хуваарилалтын нийлбэр төлөх дүнтэй тэнцүү байна.",
  );
export const invoiceSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  dueDate: dateSchema,
  items: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        treatmentId: z.string().uuid().optional(),
        quantity: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(100),
});
