import { NextResponse } from "next/server";

type BookingNotification = {
  name?: unknown;
  phone?: unknown;
  date?: unknown;
  time?: unknown;
  service?: unknown;
};

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.ADMIN_CHAT_ID) {
    return NextResponse.json(
      { success: false, message: "Telegram тохиргоо хийгдээгүй байна." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as BookingNotification;
    const fields = [body.name, body.phone, body.date, body.time, body.service];
    if (fields.some((field) => typeof field !== "string" || !field.trim())) {
      return NextResponse.json(
        { success: false, message: "Захиалгын мэдээлэл дутуу байна." },
        { status: 400 },
      );
    }
    const [name, phone, date, time, service] = fields as string[];

    const message = [
      "🗓 Шинэ цаг авалт!",
      `👤 Нэр: ${name.trim()}`,
      `📞 Утас: ${phone.trim()}`,
      `📅 Өдөр: ${date.trim()}`,
      `⏰ Цаг: ${time.trim()}`,
      `🛠 Үйлчилгээ: ${service.trim()}`,
    ].join("\n");

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.ADMIN_CHAT_ID,
          text: message,
        }),
      },
    );

    if (!telegramResponse.ok) {
      throw new Error(`Telegram хүсэлт амжилтгүй болсон: ${telegramResponse.status}`);
    }

    return NextResponse.json({ success: true, message: "Захиалга амжилттай илгээгдлээ." });
  } catch (error: unknown) {
    console.error("Telegram API error:", error);
    return NextResponse.json(
      { success: false, message: "Мэдээлэл илгээхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
