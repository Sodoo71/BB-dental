import { z } from "zod";
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform(value => value || null);
export const doctorProfileSchema = z.object({
  name: z.string().trim().min(2, "Эмчийн бүтэн нэрийг оруулна уу.").max(120),
  specialty: z.string().trim().min(1, "Мэргэшлээ оруулна уу.").max(120).optional(),
  title: optionalText(120),
  phone: optionalText(40),
  email: z.union([z.literal(""), z.string().trim().email("И-мэйл хаягаа шалгана уу.")]).nullable().optional().transform(value => value || null),
  avatarUrl: z.union([z.literal(""), z.string().url().max(2048).refine(value => value.startsWith("https://"), "Зургийн холбоос HTTPS байна.")]).nullable().optional().transform(value => value || null),
  telegramChatId: z.union([z.literal(""), z.string().trim().regex(/^[1-9]\d*$/, "Хувийн Telegram-ийн эерэг тоон Chat ID оруулна уу (группийн ID биш).")]).nullable().optional().transform(value => value || null),
  experience: z.number().int().min(0).max(80).optional(),
  description: optionalText(2000),
  isActive: z.boolean().default(true),
});
