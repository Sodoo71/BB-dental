import { z } from "zod";
import { dateSchema, phoneSchema, today } from "./domain";

export function patientAge(birthDate: string, onDate = today()) {
  if (!dateSchema.safeParse(birthDate).success || birthDate > onDate)
    return null;
  return (
    Number(onDate.slice(0, 4)) -
    Number(birthDate.slice(0, 4)) -
    (onDate.slice(5) < birthDate.slice(5) ? 1 : 0)
  );
}
export const bookingContactFields = {
  name: z.string().trim().min(2, "Овог, нэрээ оруулна уу.").max(100),
  phone: phoneSchema,
  birthDate: z
    .union([
      dateSchema.refine(
        (date) => date >= "1900-01-01" && date <= today(),
        "Төрсөн огноо буруу байна.",
      ),
      z.literal(""),
    ])
    .default(""),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER"]).default(""),
  guardianName: z.string().trim().max(100).default(""),
  guardianPhone: z.union([phoneSchema, z.literal("")]).default(""),
};
export function validateGuardian(
  contact: {
    birthDate?: string;
    guardianName?: string;
    guardianPhone?: string;
  },
  ctx: z.RefinementCtx,
) {
  const age = contact.birthDate ? patientAge(contact.birthDate) : null;
  if (age !== null && age < 18) {
    if (!contact.guardianName || contact.guardianName.trim().length < 2)
      ctx.addIssue({
        code: "custom",
        path: ["guardianName"],
        message: "18-аас доош насанд асран хамгаалагчийн нэр шаардлагатай.",
      });
    if (!contact.guardianPhone)
      ctx.addIssue({
        code: "custom",
        path: ["guardianPhone"],
        message: "Асран хамгаалагчийн утсыг оруулна уу.",
      });
  }
}
export const bookingContactSchema = z
  .object(bookingContactFields)
  .superRefine(validateGuardian);
export type BookingContact = z.infer<typeof bookingContactSchema>;
