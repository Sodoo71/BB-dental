import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const key = "telegram_webhook_secret";
export async function getTelegramWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET || (await prisma.systemSetting.findUnique({ where: { key } }))?.value || null;
}
export async function ensureTelegramWebhookSecret() {
  if (process.env.TELEGRAM_WEBHOOK_SECRET) return process.env.TELEGRAM_WEBHOOK_SECRET;
  // Separate from editable/exported settings; never returned to the browser.
  return (await prisma.systemSetting.upsert({ where: { key }, create: { key, value: randomBytes(32).toString("hex") }, update: {} })).value;
}
