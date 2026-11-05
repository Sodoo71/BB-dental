import { z } from "zod";
import {
  dateSchema,
  timeSchema,
  moneySchema,
  phoneSchema,
  validTeeth,
  roles,
} from "./domain";
const text = z.string().trim().min(1).max(200);
const note = z.string().max(10000).default("");
export const serviceSchema = z.object({
  doctorIds: z.array(z.string().uuid()).max(200).default([]),
  name: text,
  category: text,
  description: note,
  imageUrl: z
    .union([
      z.url().refine((value) => value.startsWith("https://")),
      z.literal(""),
    ])
    .default(""),
  price: moneySchema,
  duration: z.coerce.number().int().min(15).max(480),
  active: z.boolean().default(true),
});
export const patientSchema = z.object({
  name: text,
  phone: phoneSchema,
  birthDate: z.union([dateSchema, z.literal("")]).default(""),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER"]).default(""),
  address: note,
  allergies: note,
  medicalHistory: note,
});
export const doctorSchema = z.object({
  name: text,
  specialty: text,
  bio: note,
  imageUrl: z
    .union([z.url().refine((v) => v.startsWith("https://")), z.literal("")])
    .default(""),
  telegramChatId: z
    .string()
    .regex(/^-?\d*$/)
    .default(""),
  active: z.boolean().default(true),
  userId: z.string().uuid().nullable().optional(),
});
export const passwordSchema = z
  .string()
  .min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байна.")
  .max(72)
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Нууц үг 72 байтаас хэтрэхгүй байна.",
  );
export const emailSchema = z
  .email("Имэйл хаяг буруу байна.")
  .max(254)
  .transform((value) => value.trim().toLowerCase());
export const telegramSchema = z
  .string()
  .trim()
  .regex(/^-?[1-9]\d{0,18}$/, "Telegram ID нь тоон Chat ID байна.")
  .or(z.literal(""))
  .default("");
export const userSchema = z.object({
  name: text,
  phone: phoneSchema,
  email: emailSchema
    .or(z.literal(""))
    .transform((v) => v || null)
    .optional(),
  telegramChatId: telegramSchema,
  role: z.enum(roles),
  password: passwordSchema,
  active: z.boolean().default(true),
});
export const registrationSchema = z
  .object({
    name: text,
    email: emailSchema,
    phone: phoneSchema,
    telegramChatId: telegramSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    requestedRole: z.enum(["DOCTOR", "RECEPTION"]).default("DOCTOR"),
  })
  .refine(
    (data) => data.password === data.passwordConfirmation,
    "Давтан нууц үг таарахгүй байна.",
  );
export const resetPasswordSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine(
    (data) => data.password === data.passwordConfirmation,
    "Давтан нууц үг таарахгүй байна.",
  );
export const patientNoteSchema = z.object({
  patientId: z.string().uuid(),
  content: z.string().trim().min(1).max(10000),
});
export const transferSchema = z
  .object({
    patientId: z.string().uuid(),
    sourceDoctorId: z.string().uuid(),
    targetDoctorId: z.string().uuid(),
    reason: z.string().trim().min(2).max(2000),
  })
  .refine(
    (data) => data.sourceDoctorId !== data.targetDoctorId,
    "Өөр эмч сонгоно уу.",
  );
export const scheduleSchema = z
  .object({
    doctorId: z.string().uuid(),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine(
    (v) => v.startTime < v.endTime,
    "Эхлэх цаг дуусах цагаас өмнө байна.",
  );
export const leaveSchema = z
  .object({
    doctorId: z.string().uuid(),
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    reason: text,
  })
  .refine((v) => v.startTime < v.endTime, "Цагийн хязгаар буруу байна.");
export const treatmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  serviceId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  date: dateSchema,
  tooth: z.coerce
    .number()
    .int()
    .refine((v) => validTeeth.includes(v), "FDI шүдний дугаар буруу.")
    .nullable()
    .optional(),
  diagnosis: text,
  procedure: note,
  note,
  amount: moneySchema,
});
export const paymentSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  amount: moneySchema.refine((v) => v > 0, "Төлбөрийн дүн 0-ээс их байна."),
  method: z.enum(["CASH", "CARD", "TRANSFER", "QPAY"]),
  note,
  date: dateSchema,
  idempotencyKey: z.string().uuid(),
});
export const expenseSchema = z.object({
  title: text,
  category: text,
  amount: moneySchema.refine((v) => v > 0),
  date: dateSchema,
  note,
});
export const inventorySchema = z.object({
  name: text,
  sku: text,
  unit: text,
  minimum: z.coerce.number().int().min(0).max(1000000),
  supplier: z.string().max(200).default(""),
});
export const movementSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce
    .number()
    .int()
    .min(-1000000)
    .max(1000000)
    .refine((v) => v !== 0),
  reason: text,
});
export const documentSchema = z.object({
  patientId: z.string().uuid(),
  title: text,
  type: z.enum(["CONSENT", "NOTE", "REFERRAL"]),
  content: z.string().min(1).max(30000),
  consentName: z.string().max(200).default(""),
});
