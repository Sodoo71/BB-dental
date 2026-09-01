import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json(
      { error: "Хандах эрхгүй байна." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const botToken =
      typeof body.botToken === "string" && body.botToken.trim()
        ? body.botToken.trim()
        : process.env.TELEGRAM_BOT_TOKEN ||
          "8758601589:AAFqJ_IWnBcy8lCw9Vs-iq2ZJsX9NmUZilo";

    const chatId =
      typeof body.chatId === "string" && body.chatId.trim()
        ? body.chatId.trim()
        : process.env.ADMIN_CHAT_ID || "8411351733";

    if (!chatId) {
      return NextResponse.json(
        { error: "Шалгах Telegram Chat ID оруулна уу." },
        { status: 400 },
      );
    }

    const text = `🏥 *BB Dental Clinic Системийн Тест*\n\n✅ Супер админаас илгээсэн тест мэдэгдэл амжилттай хүргэгдлээ!\nЦаг: ${new Date().toLocaleString("mn-MN")}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      },
    );

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      return NextResponse.json(
        {
          error:
            tgData.description ||
            "Телеграм сервэр рүү илгээж чадсангүй. Chat ID болон Bot-оо /start хийсэн эсэхээ шалгана уу.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Telegram ID (${chatId}) рүү тест мэдэгдэл амжилттай илгээгдлээ!`,
    });
  } catch (error) {
    console.error("POST /api/telegram/test error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Тест мэдэгдэл илгээхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
