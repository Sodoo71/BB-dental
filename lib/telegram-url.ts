import { HttpError } from "./security/http";

export function telegramWebhookUrl(requestUrl: string, webhookBaseUrl?: string, appUrl?: string) {
  let origin: URL;
  try {
    origin = new URL(webhookBaseUrl?.trim() || appUrl?.trim() || requestUrl);
  } catch {
    throw new HttpError(400, "Telegram-ийн HTTPS хаяг буруу байна. TELEGRAM_WEBHOOK_BASE_URL тохиргоогоо шалгана уу.");
  }
  if (origin.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || origin.hostname.endsWith(".localhost")) {
    throw new HttpError(400, "Telegram localhost руу холбогдох боломжгүй. Нийтийн HTTPS сайт дээрээс холбоно уу. Local дээр турших бол TELEGRAM_WEBHOOK_BASE_URL-д энэ сервер рүү чиглэсэн HTTPS tunnel хаягаа тохируулаад серверээ дахин асаана уу.");
  }
  if (origin.username || origin.password || (origin.port && !["443", "80", "88", "8443"].includes(origin.port))) {
    throw new HttpError(400, "Webhook нь нэвтрэх мэдээлэлгүй HTTPS хаяг, 443, 80, 88 эсвэл 8443 порт ашиглах ёстой.");
  }
  return new URL("/api/telegram/webhook", origin.origin).href;
}
