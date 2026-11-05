import { telegramConfig } from "./telegram";
import { ApiError } from "./http";
import { notifyDoctor } from "./booking";

export function resetLink(token: string) {
  const base = process.env.APP_URL;
  if (!base && process.env.NODE_ENV === "production")
    throw new ApiError(503, "Сэргээх холбоосын APP_URL тохируулаагүй байна.");
  let url: URL;
  try {
    url = new URL("/reset-password", base || "http://localhost:3000");
  } catch {
    throw new ApiError(503, "APP_URL тохиргоо буруу байна.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new ApiError(503, "APP_URL тохиргоо буруу байна.");
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new ApiError(503, "Нууц үг сэргээх APP_URL нь HTTPS байна.");
  url.searchParams.set("token", token);
  return url.toString();
}
export async function ensureTelegramResetConfigured() {
  const config = await telegramConfig();
  if (!config.token)
    throw new ApiError(
      503,
      "Telegram bot тохируулаагүй байна. Эмнэлгийн админтай холбогдоно уу.",
    );
  if (!config.recovery)
    throw new ApiError(
      503,
      "Telegram-ээр нууц үг сэргээхийг админ түр хаасан байна.",
    );
  resetLink("configuration-check");
  return config;
}
export async function sendTelegramReset(
  chatId: string,
  name: string,
  token: string,
  send?: typeof fetch,
) {
  const config = await ensureTelegramResetConfigured();
  if (!/^[1-9]\d{0,18}$/.test(chatId))
    throw new ApiError(422, "Бүртгэлд хувийн Telegram Chat ID тохируулна уу.");
  const sent = await notifyDoctor(
    chatId,
    `BB Dental Clinic · Нууц үг сэргээх\n\nСайн байна уу, ${name}.\nШинэ нууц үг үүсгэх холбоос:\n${resetLink(token)}\n\nХолбоос 30 минут хүчинтэй, нэг удаа ашиглагдана. Хүсэлт гаргаагүй бол энэ холбоосыг бүү ашиглаарай.`,
    send,
    "recovery",
    config,
  );
  if (!sent.ok)
    throw new ApiError(
      503,
      "Telegram руу сэргээх холбоос хүрсэнгүй. Эмнэлгийн bot дээр /start дарсан эсэхийг шалгаад дахин оролдоно уу.",
    );
}
