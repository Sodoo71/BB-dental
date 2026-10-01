import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationConfig, sendTelegramRaw } from "@/lib/telegram";
import { apiError, HttpError } from "@/lib/security/http";

export async function POST() {
  try {
    const actor = await requireRole("DOCTOR");
    if (!actor?.doctorId) throw new HttpError(403, "Хандах эрхгүй байна.");
    const doctor = await prisma.doctor.findUnique({ where: { id: actor.doctorId }, select: { telegramChatId: true, isActive: true } });
    const chatId = doctor?.telegramChatId?.trim();
    if (!doctor?.isActive || !chatId || !/^[1-9]\d*$/.test(chatId)) throw new HttpError(400, "Эхлээд хувийн Telegram Chat ID-гаа профайлдаа хадгална уу.");
    if ((await notificationConfig()).enabled === false) throw new HttpError(409, "Telegram мэдэгдлийг админ идэвхгүй болгосон байна.");
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new HttpError(503, "Telegram bot тохируулаагүй байна.");
    const result = await sendTelegramRaw("sendMessage", { chat_id: chatId, text: "✅ BB Dental — Telegram холболт амжилттай. Танд оноосон шинэ цаг захиалгын мэдэгдэл энэ чатаар ирнэ." });
    if (!result?.ok) throw new HttpError(502, "Мэдэгдэл очсонгүй. BB_dental_bot дээр /start дарж, блоклоогүй эсэх болон Chat ID-гаа шалгана уу.");
    await prisma.auditLog.create({ data: { actorId: actor.id, action: "TELEGRAM_TEST_SENT", entity: "Doctor", entityId: actor.doctorId } });
    return NextResponse.json({ success: true, message: "Таны Telegram руу туршилтын мэдэгдэл илгээгдлээ." });
  } catch (error) { return apiError(error); }
}
