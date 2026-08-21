type DoctorNotification = {
  chatId: string;
  doctorName: string;
  patientName: string;
  patientPhone: string;
  serviceName: string;
  appointmentDate: Date;
  startTime: string;
  chiefComplaint: string | null;
};

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
    "🦷 Шинэ цагийн захиалга",
    `👨‍⚕️ Эмч: ${notification.doctorName}`,
    `👤 Үйлчлүүлэгч: ${notification.patientName}`,
    `📞 Утас: ${notification.patientPhone}`,
    `🩺 Үйлчилгээ: ${notification.serviceName}`,
    `📅 Өдөр: ${date}`,
    `⏰ Цаг: ${notification.startTime}`,
    notification.chiefComplaint ? `📝 Зовиур: ${notification.chiefComplaint}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: notification.chatId, text }),
    },
  );

  return response.ok;
}
