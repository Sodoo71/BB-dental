import { z } from "zod";
import { phoneSchema } from "./phone";
export const patientSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).nullable().optional().transform(value => value || null),
  age: z.number().int().min(0).max(150).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
});
export const patientPageSchema = z.coerce.number().int().min(1).max(100000);
