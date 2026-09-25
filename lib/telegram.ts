type DoctorNotification = {
  chatId: string;
  appointmentId?: string;
  doctorName: string;
  patientName: string;
  patientPhone: string;
  serviceName: string;
  appointmentDate: Date;
  startTime: string;
  chiefComplaint: string | null;
};

export async function sendTelegramRaw(
  endpoint: string,
  body: Record<string, unknown>,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/${endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return await res.json();
  } catch (err) {
    console.error(`Telegram API error [${endpoint}]:`, err);
    return null;
  }
}

export async function notifyDoctorOnTelegram(notification: DoctorNotification) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !notification.chatId) return false;

  const date = new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(notification.appointmentDate);

  const text = [
    "🦷 *ШИНЭ ЦАГИЙН ЗАХИАЛГА*",
    "",
    `👨‍⚕️ *Эмч:* ${notification.doctorName}`,
    `👤 *Үйлчлүүлэгч:* ${notification.patientName}`,
    `📞 *Утас:* \`${notification.patientPhone}\``,
    `🩺 *Үйлчилгээ:* ${notification.serviceName}`,
    `📅 *Өдөр:* ${date}`,
    `⏰ *Цаг:* ${notification.startTime}`,
    notification.chiefComplaint
      ? `📝 *Зовиур:* ${notification.chiefComplaint}`
      : null,
    "",
    "Доорх товчоор шууд баталгаажуулах эсвэл цуцлах боломжтой:",
  ]
    .filter(Boolean)
    .join("\n");

  const reply_markup = notification.appointmentId
    ? {
        inline_keyboard: [
          [
            {
              text: "✅ Баталгаажуулах",
              callback_data: `confirm:${notification.appointmentId}`,
            },
            {
              text: "❌ Цуцлах",
              callback_data: `cancel:${notification.appointmentId}`,
            },
          ],
        ],
      }
    : undefined;

  const result = await sendTelegramRaw("sendMessage", {
    chat_id: notification.chatId,
    text,
    parse_mode: "Markdown",
    reply_markup,
  });

  return result?.ok === true;
}

export async function notifyAppointmentReminder(params: {
  chatId: string;
  doctorName: string;
  patientName: string;
  patientPhone: string;
  serviceName: string;
  appointmentDate: Date;
  startTime: string;
}) {
  const date = new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    month: "numeric",
    day: "numeric",
  }).format(params.appointmentDate);

  const text = [
    "⏰ *ҮЗЛЭГИЙН ЦАГИЙН САНУУЛГА*",
    "",
    `👨‍⚕️ Эмч: ${params.doctorName}`,
    `👤 Үйлчлүүлэгч: ${params.patientName} (${params.patientPhone})`,
    `🩺 Үйлчилгээ: ${params.serviceName}`,
    `⏰ Товлосон цаг: ${date} өдрийн ${params.startTime}`,
  ].join("\n");

  const result = await sendTelegramRaw("sendMessage", {
    chat_id: params.chatId,
    text,
    parse_mode: "Markdown",
  });

  return result?.ok === true;
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
) {
  return sendTelegramRaw("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
) {
  return sendTelegramRaw("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
  });
}
