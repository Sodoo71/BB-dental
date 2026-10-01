import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/security/http";
import { sendTelegramRaw } from "@/lib/telegram";
import { telegramWebhookUrl } from "@/lib/telegram-url";
import { ensureTelegramWebhookSecret } from "@/lib/telegram-webhook";

export async function GET() {
  try {
    if (!(await requirePermission("settings:manage")))
      throw new HttpError(403, "Хандах эрхгүй байна.");
    const response = await sendTelegramRaw("getWebhookInfo", {});
    if (!response?.ok)
      throw new HttpError(
        503,
        "Telegram bot-той холбогдож чадсангүй. Bot token-оо шалгана уу.",
      );
    return NextResponse.json({
      data: {
        url: response.result.url,
        pending: response.result.pending_update_count,
        lastError: response.result.last_error_message || null,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("settings:manage");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    if (!process.env.TELEGRAM_BOT_TOKEN)
      throw new HttpError(503, "TELEGRAM_BOT_TOKEN тохируулаагүй байна.");
    const url = telegramWebhookUrl(request.url, process.env.TELEGRAM_WEBHOOK_BASE_URL, process.env.APP_URL);
    const secret = await ensureTelegramWebhookSecret();
    const result = await sendTelegramRaw("setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    if (!result?.ok)
      throw new HttpError(
        502,
        "Telegram webhook бүртгэж чадсангүй. HTTPS хаяг болон bot token-оо шалгана уу.",
      );
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "TELEGRAM_WEBHOOK_CONFIGURED",
        entity: "Telegram",
        entityId: "webhook",
        metadata: { url },
      },
    });
    return NextResponse.json({
      success: true,
      message: "Telegram товчнуудыг энэ сайттай холболоо.",
      url,
    });
  } catch (error) {
    return apiError(error);
  }
}
