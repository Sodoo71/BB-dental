import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { db, databaseConfigured } from "./db";
import { ApiError } from "./http";
export type TelegramConfig = {
  token: string;
  booking: boolean;
  transfer: boolean;
  recovery: boolean;
  source: "database" | "environment" | "none";
};
export function encryptionKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  const bytes = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (bytes.length !== 32)
    throw new ApiError(
      503,
      "SETTINGS_ENCRYPTION_KEY нь 32 байтын base64 эсвэл 64 hex байна.",
    );
  return bytes;
}
export function sealToken(token: string) {
  const key = encryptionKey();
  if (!key)
    throw new ApiError(
      503,
      "Bot token хадгалахад SETTINGS_ENCRYPTION_KEY тохируулна уу.",
    );
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const bytes = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    bytes.toString("base64"),
  ].join(".");
}
function openToken(value: string) {
  try {
    const key = encryptionKey();
    if (!key) throw new Error();
    const [iv, tag, data] = value.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ApiError(
      503,
      "Хадгалсан Telegram token-ийг нээх түлхүүрээ шалгана уу.",
    );
  }
}
export async function telegramConfig(): Promise<TelegramConfig> {
  const values = databaseConfigured()
    ? Object.fromEntries(
        (
          await db.setting.findMany({
            where: {
              key: {
                in: [
                  "telegramBotTokenEncrypted",
                  "telegramBookingEnabled",
                  "telegramTransferEnabled",
                  "telegramRecoveryEnabled",
                ],
              },
            },
          })
        ).map((s) => [s.key, s.value]),
      )
    : {};
  const stored = values.telegramBotTokenEncrypted;
  const token = stored
    ? openToken(stored)
    : process.env.TELEGRAM_BOT_TOKEN || "";
  return {
    token,
    booking: values.telegramBookingEnabled !== "false",
    transfer: values.telegramTransferEnabled !== "false",
    recovery: values.telegramRecoveryEnabled !== "false",
    source: stored ? "database" : token ? "environment" : "none",
  };
}
export async function telegramCall(
  method: string,
  payload: Record<string, unknown> = {},
  config?: TelegramConfig,
  send: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const resolved = config || (await telegramConfig());
  if (!resolved.token)
    throw new ApiError(503, "Telegram bot тохируулаагүй байна.");
  try {
    const response = await send(
      `https://api.telegram.org/bot${resolved.token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      },
    );
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error();
    return data.result as Record<string, unknown>;
  } catch {
    throw new ApiError(
      503,
      "Telegram үйлдэл амжилтгүй. Bot token болон /start холболтоо шалгана уу.",
    );
  }
}
export async function telegramStatus() {
  let config: TelegramConfig;
  let configurationError = "";
  try {
    config = await telegramConfig();
  } catch {
    config = {
      token: "",
      source: "database",
      booking: true,
      transfer: true,
      recovery: true,
    };
    configurationError =
      "Хадгалсан token нээгдэхгүй байна. Шифрлэх түлхүүрээ сэргээх эсвэл шинэ token хадгална уу.";
  }
  const cached = databaseConfigured()
    ? Object.fromEntries(
        (
          await db.setting.findMany({
            where: { key: { in: ["telegramBotName", "telegramBotUsername"] } },
          })
        ).map((s) => [s.key, s.value]),
      )
    : {};
  return {
    configured: Boolean(config.token),
    configurationError,
    source: config.source,
    booking: config.booking,
    transfer: config.transfer,
    recovery: config.recovery,
    canStoreToken: Boolean(encryptionKey()),
    name: cached.telegramBotName || "",
    username: cached.telegramBotUsername || "",
  };
}
export async function telegramIdentity(config?: TelegramConfig) {
  const bot = await telegramCall("getMe", {}, config);
  if (typeof bot.username !== "string")
    throw new ApiError(503, "Bot username олдсонгүй.");
  return {
    username: bot.username,
    name: String(bot.first_name || bot.username),
  };
}
export async function rememberBot(bot: { username: string; name: string }) {
  await db.$transaction([
    db.setting.upsert({
      where: { key: "telegramBotUsername" },
      create: { key: "telegramBotUsername", value: bot.username },
      update: { value: bot.username },
    }),
    db.setting.upsert({
      where: { key: "telegramBotName" },
      create: { key: "telegramBotName", value: bot.name },
      update: { value: bot.name },
    }),
  ]);
}
export function webhookUrl() {
  try {
    const url = new URL("/api/telegram/webhook", process.env.APP_URL);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new ApiError(
      400,
      "Webhook холбоход APP_URL нь нийтэд нээлттэй HTTPS хаяг байна.",
    );
  }
}
export async function webhookSecret() {
  const config = await telegramConfig();
  const key = encryptionKey() || Buffer.from(config.token);
  if (!config.token)
    throw new ApiError(503, "Telegram bot тохируулаагүй байна.");
  return createHmac("sha256", key)
    .update("bb-dental-telegram-webhook-v1")
    .digest("hex");
}
export async function validWebhookSecret(received: string) {
  const expected = await webhookSecret();
  const a = Buffer.from(received),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
