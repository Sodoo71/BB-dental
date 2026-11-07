import { z } from "zod";
import { dateSchema, moneySchema } from "./domain";
export const queueNames: Record<string, string> = {
  WAITING: "Хүлээж буй",
  CALLED: "Дуудсан",
  IN_PROGRESS: "Эмчилж буй",
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
    method: z.enum(["CASH", "TRANSFER", "CARD", "QPAY"]),
    amount: moneySchema.refine((n) => n > 0),
    reference: z.string().trim().max(200).default(""),
  })
  .refine(
    (a) => a.method === "CASH" || a.reference.length >= 3,
    "Банк / терминалын баталгаажсан гүйлгээний дугаар шаардлагатай.",
  );
export const collectionSchema = z
  .object({
    invoiceId: z.string().min(1).max(100),
    idempotencyKey: z.string().uuid(),
    amount: moneySchema.refine((n) => n > 0),
    allocations: z.array(allocationSchema).min(1).max(4),
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
