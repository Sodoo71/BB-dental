import { NextResponse } from "next/server";
import { getTelegramWebhookSecret } from "@/lib/telegram-webhook";
import { canActOnTelegramAppointment, parseTelegramAction, telegramStatusTransition } from "@/lib/telegram-callback";
import { clinicDateKey } from "@/lib/doctor-workspace";
import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  editMessageText,
  sendTelegramRaw,
} from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    if (!request.headers.get("x-telegram-bot-api-secret-token")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const secret = await getTelegramWebhookSecret();
    if (
      !secret ||
      request.headers.get("x-telegram-bot-api-secret-token") !== secret
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const update = await request.json().catch(() => null);
    if (!update) {
      return NextResponse.json({ ok: true });
    }

    // 1. HANDLE INLINE KEYBOARD CALLBACKS (Баталгаажуулах / Цуцлах)
    if (update.callback_query) {
      const cb = update.callback_query;
      const callbackId = cb.id;
      const data = String(cb.data || "");
      const fromChatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const originalText = cb.message?.text || "";

      const action = parseTelegramAction(data);
      if (!action || typeof callbackId !== "string" || !messageId) {
        if (typeof callbackId === "string") await answerCallbackQuery(callbackId, "Энэ товч хүчингүй байна.");
        return NextResponse.json({ ok: true });
      }
      const outcome = await prisma.$transaction(async (tx) => {
        const appointment = await tx.appointment.findUnique({ where: { id: action.appointmentId }, include: { doctor: { include: { user: true } } } });
        if (!appointment) return { message: "Захиалга олдсонгүй.", status: null };
        const account = appointment.doctor?.user;
        if (!canActOnTelegramAppointment({
          senderId: cb.from?.id, chatId: fromChatId, chatType: cb.message?.chat?.type,
          telegramChatId: appointment.doctor?.telegramChatId,
          doctorActive: appointment.doctor?.isActive === true,
          accountActive: Boolean(account?.isActive && account.status === "ACTIVE" && ["DOCTOR", "ADMIN", "SUPER_ADMIN"].includes(account.role)),
        })) return { message: "Зөвхөн энэ захиалгын эмч өөрийн холбосон Telegram-аас өөрчлөх боломжтой.", status: null };
        if (!telegramStatusTransition(appointment.status, action.status)) {
          return { message: "Захиалга аль хэдийн шинэчлэгдсэн байна.", status: appointment.status };
        }
        const changed = await tx.appointment.updateMany({
          where: { id: appointment.id, doctorId: appointment.doctorId, status: appointment.status },
          data: { status: action.status },
        });
        if (!changed.count) return { message: "Захиалга өөрчлөгдсөн байна. Дахин шалгана уу.", status: null };
        await tx.auditLog.create({ data: { actorId: account!.id, action: "APPOINTMENT_UPDATED", entity: "Appointment", entityId: appointment.id, metadata: { previousStatus: appointment.status, status: action.status, source: "TELEGRAM" } } });
        return { message: action.status === "CONFIRMED" ? "Цаг амжилттай баталгаажлаа!" : "Цаг цуцлагдлаа.", status: action.status };
      });
      await answerCallbackQuery(callbackId, outcome.message);
      if (outcome.status) {
        const labels: Record<string, string> = { CONFIRMED: "✅ БАТАЛГААЖСАН", CANCELLED: "❌ ЦУЦЛАГДСАН", COMPLETED: "✅ ҮЗЛЭГ ДУУССАН", NO_SHOW: "ИРЭЭГҮЙ", PENDING: "ХҮЛЭЭГДЭЖ БУЙ" };
        const baseText = originalText.split("\n\n━━━━━━━━━━━━━━━")[0].slice(0, 3900);
        await editMessageText(fromChatId, messageId, `${baseText}\n\n━━━━━━━━━━━━━━━\n${labels[outcome.status]}`, outcome.status === "CONFIRMED" ? action.appointmentId : undefined);
      }
      return NextResponse.json({ ok: true });
    }

    // 2. HANDLE TELEGRAM MESSAGES (/start, /today, /schedule)
    if (update.message) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const text = String(msg.text || "").trim();
      if (msg.chat.type !== "private" || String(msg.from?.id) !== chatId)
        return NextResponse.json({ ok: true });

      // /start only explains the authenticated profile flow; it never binds an account.
      if (text === "/start" || text.startsWith("/start ")) {
        await sendTelegramRaw("sendMessage", {
          chat_id: chatId,
          text: `🦷 BB Dental Clinic Bot\n\nТаны Telegram Chat ID: ${chatId}\n\nЭнэ тоон ID-г сайтын Миний профайл → Telegram Chat ID талбарт оруулаад хадгалаарай. Дараа нь Туршилтын мэдэгдэл илгээх товчоор шалгана уу.`,
        });
        return NextResponse.json({ ok: true });
      }

      // /today - check today's appointments for this doctor
      if (text === "/today") {
        const doctor = await prisma.doctor.findFirst({
          where: {
            telegramChatId: chatId,
            isActive: true,
            user: {
              is: {
                isActive: true,
                status: "ACTIVE",
                role: { in: ["DOCTOR", "ADMIN", "SUPER_ADMIN"] },
              },
            },
          },
        });

        if (!doctor) {
          await sendTelegramRaw("sendMessage", {
            chat_id: chatId,
            text: "Таны Telegram аккаунт систем дэх эмчийн профайлтай хараахан холбогдоогүй байна.",
          });
          return NextResponse.json({ ok: true });
        }

        const today = clinicDateKey();
        const todayStart = new Date(`${today}T00:00:00.000Z`);
        const todayEnd = new Date(todayStart);
        todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

        const apps = await prisma.appointment.findMany({
          where: {
            doctorId: doctor.id,
            appointmentDate: { gte: todayStart, lt: todayEnd },
          },
          include: { service: true },
          orderBy: { startTime: "asc" },
        });

        if (apps.length === 0) {
          await sendTelegramRaw("sendMessage", {
            chat_id: chatId,
            text: `📅 *Өнөөдөр (${today})*: Танд товлогдсон цагийн захиалга байхгүй байна.`,
            });
          return NextResponse.json({ ok: true });
        }

        const list = apps
          .map(
            (a, i) =>
              `${i + 1}. ⏰ *${a.startTime} - ${a.endTime}*\n   👤 ${a.patientName} (\`${a.patientPhone}\`)\n   🩺 ${a.service.name}\n   Төлөв: ${a.status}`,
          )
          .join("\n\n");

        await sendTelegramRaw("sendMessage", {
          chat_id: chatId,
          text: `📅 *Өнөөдрийн үзлэгийн цагууд (${doctor.name})*:\n\n${list}`,
        });
        return NextResponse.json({ ok: true });
      }

      // /schedule - doctor weekly schedule
      if (text === "/schedule") {
        const doctor = await prisma.doctor.findFirst({
          where: {
            telegramChatId: chatId,
            isActive: true,
            user: {
              is: {
                isActive: true,
                status: "ACTIVE",
                role: { in: ["DOCTOR", "ADMIN", "SUPER_ADMIN"] },
              },
            },
          },
          include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
        });

        if (!doctor) {
          await sendTelegramRaw("sendMessage", {
            chat_id: chatId,
            text: "Таны аккаунт холбогдоогүй байна.",
          });
          return NextResponse.json({ ok: true });
        }

        const dayNames = [
          "Ням",
          "Даваа",
          "Мягмар",
          "Лхагва",
          "Пүрэв",
          "Баасан",
          "Бямба",
        ];
        const lines = doctor.schedules.map((s) => {
          if (s.isDayOff) {
            return `• ${dayNames[s.dayOfWeek]}: 🚫 Амарна`;
          }
          return `• ${dayNames[s.dayOfWeek]}: ⏰ ${s.startTime} - ${s.endTime}`;
        });

        await sendTelegramRaw("sendMessage", {
          chat_id: chatId,
          text: `🗓 *Таны долоо хоногийн цагийн хуваарь*:\n\n${lines.join("\n")}`,
        });
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook handler error:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
