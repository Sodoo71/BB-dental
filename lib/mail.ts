import nodemailer from "nodemailer";
import { ApiError } from "./http";
import { resetLink } from "./reset-delivery";
export function ensureMailConfigured() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_FROM ||
    (process.env.NODE_ENV === "production" && !process.env.APP_URL)
  )
    throw new ApiError(
      503,
      "Имэйлээр сэргээх тохиргоо хийгдээгүй байна. Эмнэлгийн админтай холбогдоно уу.",
    );
}
export async function sendResetEmail(
  email: string,
  name: string,
  token: string,
) {
  ensureMailConfigured();
  const port = Number(process.env.SMTP_PORT || 587);
  const host = process.env.SMTP_HOST!;
  const local = ["127.0.0.1", "localhost", "::1"].includes(host);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: !local && port !== 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  const link = resetLink(token);
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "BB Dental · Нууц үг сэргээх",
    text: `Сайн байна уу, ${name}.\n\nНууц үгээ шинэчлэх холбоос:\n${link}\n\nХолбоос 30 минут хүчинтэй, нэг удаа ашиглагдана. Хүсэлт гаргаагүй бол энэ имэйлийг үл тооно уу.\n\nBB Dental Clinic`,
  });
}
