import { doctorLock, bookingActionTag } from "@/lib/booking";
import { today, nowTime } from "@/lib/domain";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { telegramCall, validWebhookSecret } from "@/lib/telegram";
import { ApiError, body, json, safe } from "@/lib/http";
export async function POST(req: Request) {
  return safe(async () => {
    if (
      !(await validWebhookSecret(
        req.headers.get("x-telegram-bot-api-secret-token") || "",
      ))
    )
      throw new ApiError(401, "Зөвшөөрөлгүй хүсэлт.");
    const payload = await body(req);
    if (payload.callback_query) {
      const callback = z
        .object({
          id: z.string(),
          from: z.object({ id: z.number().int() }),
          data: z.string(),
          message: z.object({
            message_id: z.number().int(),
            chat: z.object({ id: z.number().int(), type: z.string() }),
          }),
        })
        .parse(payload.callback_query);
      const match = callback.data.match(
        /^appt:(confirm|cancel):([a-f0-9-]{36}):([a-f0-9]{8})$/,
      );
      if (
        !match ||
        callback.message.chat.type !== "private" ||
        callback.from.id !== callback.message.chat.id
      )
        return json({ ok: true });
      const [_, action, id, tag] = match;
      const chatId = String(callback.from.id);
      const changed = await db.$transaction(async (tx) => {
        const a = await tx.appointment.findUnique({
          where: { id },
          include: { doctor: { include: { user: true } } },
        });
        if (
          !a ||
          bookingActionTag(a) !== tag ||
          a.doctor.telegramChatId !== chatId ||
          !a.doctor.active ||
          !a.doctor.user?.active ||
          a.doctor.user.role !== "DOCTOR" ||
          a.doctor.user.approvalStatus !== "APPROVED"
        )
          return false;
        await doctorLock(tx, a.doctorId);
        if (
          a.date < today() ||
          (a.date === today() && a.startTime <= nowTime())
        )
          return false;
        const result = await tx.appointment.updateMany({
          where: {
            id,
            doctorId: a.doctorId,
            date: a.date,
            startTime: a.startTime,
            serviceId: a.serviceId,
            status: {
              in: action === "confirm" ? ["PENDING"] : ["PENDING", "CONFIRMED"],
            },
          },
          data: { status: action === "confirm" ? "CONFIRMED" : "CANCELLED" },
        });
        if (!result.count) return false;
        await tx.auditLog.create({
          data: {
            actorId: a.doctor.user.id,
            action:
              action === "confirm" ? "TELEGRAM_CONFIRM" : "TELEGRAM_CANCEL",
            entity: "appointments",
            entityId: id,
          },
        });
        return true;
      });
      await telegramCall("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: changed
          ? action === "confirm"
            ? "Захиалга баталгаажлаа."
            : "Захиалга цуцлагдлаа."
          : "Өөрчлөх боломжгүй эсвэл төлөв аль хэдийн өөрчлөгдсөн.",
        show_alert: !changed,
      });
      if (changed)
        await telegramCall("editMessageReplyMarkup", {
          chat_id: chatId,
          message_id: callback.message.message_id,
          reply_markup: { inline_keyboard: [] },
        }).catch(() => {});
      return json({ ok: true });
    }
    const update = z.object({ message: z.unknown().optional() }).parse(payload);
    const message = z
      .object({
        chat: z.object({ type: z.string(), id: z.number().int() }),
        text: z.string().optional(),
      })
      .safeParse(update.message);
    if (
      !message.success ||
      message.data.chat.type !== "private" ||
      !Number.isSafeInteger(message.data.chat.id) ||
      message.data.chat.id <= 0
    )
      return json({ ok: true });
    const match = message.data.text?.match(
      /^\/start(?:@[\w_]+)?\s+([a-f0-9]{48})\s*$/,
    );
    if (!match) return json({ ok: true });
    const key = `telegramLink:${createHash("sha256").update(match[1]).digest("hex")}`;
    const linked = await db.$transaction(async (tx) => {
      const item = await tx.setting.findUnique({ where: { key } });
      if (!item) return false;
      const link = z
        .object({ userId: z.string().uuid(), expiresAt: z.number() })
        .parse(JSON.parse(item.value));
      if (link.expiresAt < Date.now()) {
        await tx.setting.deleteMany({ where: { key } });
        return false;
      }
      const user = await tx.user.findFirst({
        where: { id: link.userId, active: true, approvalStatus: "APPROVED" },
      });
      if (!user) return false;
      const claimed = await tx.setting.deleteMany({
        where: { key, value: item.value },
      });
      if (claimed.count !== 1) return false;
      const chatId = String(message.data.chat.id);
      await tx.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId },
      });
      await tx.doctor.updateMany({
        where: { userId: user.id },
        data: { telegramChatId: chatId },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "TELEGRAM_LINKED",
          entity: "users",
          entityId: user.id,
        },
      });
      return true;
    });
    if (linked) {
      try {
        await telegramCall("sendMessage", {
          chat_id: String(message.data.chat.id),
          text: "BB Dental Clinic · Таны Telegram амжилттай холбогдлоо. Захиалга болон сэргээх холбоос энэ хаягт ирнэ.",
        });
      } catch {
        /* A linked account remains linked if the confirmation cannot be delivered. */
      }
    }
    return json({ ok: true });
  });
}
