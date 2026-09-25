import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(12, "Нууц үг хамгийн багадаа 12 тэмдэгт байна.").max(256);
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(256) });
export const registerSchema = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema, role: z.enum(["DOCTOR", "RECEPTION"]).default("DOCTOR") });
export const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "RECEPTION", "DOCTOR", "PATIENT"]);
export const accountStatusSchema = z.enum(["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"]);
