import { canChangeAppointment, type AppointmentState } from "./doctor-workspace";

export function parseTelegramAction(data: unknown) {
  if (typeof data !== "string") return null;
  const match = /^(confirm|cancel):([a-zA-Z0-9_-]{1,50})$/.exec(data);
  return match ? { appointmentId: match[2], status: match[1] === "confirm" ? "CONFIRMED" as const : "CANCELLED" as const } : null;
}

export function canActOnTelegramAppointment(input: {
  senderId: unknown; chatId: unknown; chatType: unknown;
  telegramChatId: string | null | undefined; doctorActive: boolean; accountActive: boolean;
}) {
  const linkedId = input.telegramChatId?.trim();
  return Boolean(linkedId && /^[1-9]\d*$/.test(linkedId) && input.chatType === "private" &&
    String(input.senderId) === linkedId && String(input.chatId) === linkedId &&
    input.doctorActive && input.accountActive);
}

export function telegramStatusTransition(current: AppointmentState, target: "CONFIRMED" | "CANCELLED") {
  return canChangeAppointment(current, target);
}
