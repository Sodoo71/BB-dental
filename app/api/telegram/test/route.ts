import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegramRaw } from "@/lib/telegram";
import { apiError, HttpError } from "@/lib/security/http";
export async function POST(request: Request) {
  try {
    const actor = await requireRole("SUPER_ADMIN", "ADMIN");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    const { chatId, text } = z
      .object({
        chatId: z
          .string()
          .trim()
          .regex(/^(?:-?\d+|@[a-zA-Z0-9_]{5,32})$/),
        text: z.string().trim().min(1).max(4096),
      })
      .parse(await request.json());
    if (!process.env.TELEGRAM_BOT_TOKEN)
      throw new HttpError(503, "Telegram bot тохируулаагүй байна.");
    const result = await sendTelegramRaw("sendMessage", {
      chat_id: chatId,
      text,
    });
    if (!result?.ok)
      throw new HttpError(
        502,
        result?.description ||
          "Мессеж илгээж чадсангүй. Хүлээн авагч bot дээр /start дарсан эсэхийг шалгана уу.",
      );
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "TELEGRAM_MESSAGE_SENT",
        entity: "Telegram",
        entityId: chatId,
      },
    });
    return NextResponse.json({
      success: true,
      message: "Мессеж амжилттай илгээгдлээ.",
    });
  } catch (error) {
    return apiError(error);
  }
}
