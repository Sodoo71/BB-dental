import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  editMessageText,
  sendTelegramRaw,
} from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
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

      if (data.startsWith("confirm:") || data.startsWith("cancel:")) {
        const isConfirm = data.startsWith("confirm:");
        const appointmentId = data.split(":")[1];

        const appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: {
            doctor: true,
            service: true,
          },
        });

        if (!appointment) {
          await answerCallbackQuery(callbackId, "Захиалга олдсонгүй.");
          return NextResponse.json({ ok: true });
        }

        const linkedUser = await prisma.user.findFirst({
          where: {
            doctorId: appointment.doctorId,
            isActive: true,
            status: "ACTIVE",
            role: { in: ["DOCTOR", "ADMIN", "SUPER_ADMIN"] },
          },
        });
        if (
          !appointment.doctorId ||
          !linkedUser ||
          String(cb.from?.id) !== appointment.doctor?.telegramChatId ||
          String(fromChatId) !== appointment.doctor?.telegramChatId
        ) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const newStatus = isConfirm ? "CONFIRMED" : "CANCELLED";
        const changed = await prisma.appointment.updateMany({
          where: {
            id: appointmentId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          data: { status: newStatus },
        });
        if (!changed.count) return NextResponse.json({ ok: true });

        const statusBadge = isConfirm
          ? "✅ *ЭМЧЭЭС БАТАЛГААЖСАН*"
          : "❌ *ЦУЦЛАГДСАН*";

        await answerCallbackQuery(
          callbackId,
          isConfirm ? "Цаг амжилттай баталгаажлаа!" : "Цаг цуцлагдлаа.",
        );

        if (fromChatId && messageId) {
          const updatedMessage = `${originalText}\n\n━━━━━━━━━━━━━━━\n${statusBadge}\n_Төлөв: ${new Date().toLocaleTimeString("mn-MN")}_`;
          await editMessageText(fromChatId, messageId, updatedMessage);
        }

        return NextResponse.json({ ok: true });
      }
    }

    // 2. HANDLE TELEGRAM MESSAGES (/start, /today, /schedule)
    if (update.message) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const text = String(msg.text || "").trim();
      if (msg.chat.type !== "private" || String(msg.from?.id) !== chatId)
        return NextResponse.json({ ok: true });

      // Account binding must be performed by an authenticated ERP administrator.
      if (text.startsWith("/start doc_")) {
        return NextResponse.json({ ok: true });
      }

      // /start with no arguments
      if (text === "/start") {
        await sendTelegramRaw("sendMessage", {
          chat_id: chatId,
          text: `🦷 *BB Dental Clinic Bot*\n\nТаны Telegram Chat ID: \`${chatId}\`\n\nЭмч та өөрийн эмчийн профайл дахь "Telegram холбох" линкээр орон бүртгэлээ автоматаар баталгаажуулна уу.`,
          parse_mode: "Markdown",
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

        const now = new Date();
        const todayStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
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
            text: `📅 *Өнөөдөр (${now.toISOString().slice(0, 10)})*: Танд товлогдсон цагийн захиалга байхгүй байна.`,
            parse_mode: "Markdown",
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
          parse_mode: "Markdown",
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
          parse_mode: "Markdown",
        });
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook handler error:", error);
    return NextResponse.json({ ok: true });
  }
}
