import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { digest } from "./auth";
import { ApiError } from "./http";
import { registrationSchema, resetPasswordSchema } from "./validation";
import { sendResetEmail, ensureMailConfigured } from "./mail";
import {
  ensureTelegramResetConfigured,
  sendTelegramReset,
} from "./reset-delivery";

export async function registerAccount(
  data: z.infer<typeof registrationSchema>,
) {
  const passwordHash = await hash(data.password, 12);
  return db.$transaction(async (tx) => {
    // The same lock serializes first-account registration, admin changes and seed.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('bb-users'))::text AS locked`;
    const first = (await tx.user.count()) === 0;
    const policy = await tx.setting.findUnique({
      where: { key: "autoApproveDoctors" },
    });
    const approved =
      first || (data.requestedRole === "DOCTOR" && policy?.value === "true");
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        telegramChatId: data.telegramChatId,
        passwordHash,
        role: first ? "ADMIN" : data.requestedRole,
        active: approved,
        approvalStatus: approved ? "APPROVED" : "PENDING",
        approvedAt: approved ? new Date() : null,
      },
      select: { id: true, role: true, approvalStatus: true },
    });
    if (user.role === "DOCTOR")
      await tx.doctor.create({
        data: {
          userId: user.id,
          name: data.name,
          specialty: "Шүдний эмч",
          telegramChatId: data.telegramChatId,
          active: approved,
        },
      });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: first
          ? "FIRST_ADMIN_REGISTERED"
          : approved
            ? "DOCTOR_AUTO_APPROVED"
            : "REGISTRATION_PENDING",
        entity: "users",
        entityId: user.id,
      },
    });
    return { ...user, first };
  });
}

type ResetRecipient = {
  id: string;
  name: string;
  email: string | null;
  telegramChatId: string;
  active: boolean;
  approvalStatus: string;
};
async function deliverReset(
  user: ResetRecipient,
  channel: "telegram" | "email",
  actorId?: string,
) {
  if (!user.active || user.approvalStatus !== "APPROVED")
    throw new ApiError(
      409,
      "Зөвхөн идэвхтэй, зөвшөөрөгдсөн ажилтны нууц үгийг сэргээнэ.",
    );
  if (channel === "telegram") {
    await ensureTelegramResetConfigured();
    if (!/^[1-9]\d{0,18}$/.test(user.telegramChatId))
      throw new ApiError(
        422,
        "Ажилтны бүртгэлд хувийн Telegram Chat ID тохируулаагүй байна.",
      );
  } else {
    ensureMailConfigured();
    if (!user.email) throw new ApiError(422, "Бүртгэлтэй имэйл байхгүй байна.");
  }
  const token = randomBytes(32).toString("hex");
  const item = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`reset:${user.id}`}))::text AS locked`;
    await tx.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
  });
  try {
    if (channel === "telegram")
      await sendTelegramReset(user.telegramChatId, user.name, token);
    else await sendResetEmail(user.email!, user.name, token);
  } catch (error) {
    await db.passwordReset.update({
      where: { id: item.id },
      data: { usedAt: new Date() },
    });
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "Сэргээх холбоос хүрсэнгүй. Түр хүлээгээд дахин оролдоно уу.",
    );
  }
  await db.auditLog.create({
    data: {
      actorId: actorId || user.id,
      action: actorId
        ? "ADMIN_PASSWORD_RESET_SENT"
        : "PASSWORD_RESET_REQUESTED",
      entity: "users",
      entityId: user.id,
    },
  });
}
const resetSelect = {
  id: true,
  email: true,
  name: true,
  telegramChatId: true,
  active: true,
  approvalStatus: true,
} as const;
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: resetSelect,
  });
  if (!user?.active || user.approvalStatus !== "APPROVED" || !user.email)
    return;
  await deliverReset(user, "email");
}
export async function requestTelegramPasswordReset(phone: string) {
  await ensureTelegramResetConfigured();
  const user = await db.user.findUnique({
    where: { phone },
    select: resetSelect,
  });
  // The public response does not reveal account status or stored Telegram IDs.
  if (
    !user?.active ||
    user.approvalStatus !== "APPROVED" ||
    !/^[1-9]\d{0,18}$/.test(user.telegramChatId)
  )
    return;
  await deliverReset(user, "telegram");
}
export async function adminTelegramPasswordReset(
  userId: string,
  actorId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: resetSelect,
  });
  if (!user) throw new ApiError(404, "Ажилтан олдсонгүй.");
  await deliverReset(user, "telegram", actorId);
}

export async function resetPassword(data: z.infer<typeof resetPasswordSchema>) {
  const passwordHash = await hash(data.password, 12);
  await db.$transaction(async (tx) => {
    const item = await tx.passwordReset.findUnique({
      where: { tokenHash: digest(data.token) },
    });
    if (!item)
      throw new ApiError(
        400,
        "Сэргээх холбоос хүчингүй эсвэл хугацаа дууссан байна.",
      );
    const consumed = await tx.passwordReset.updateMany({
      where: {
        id: item.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { active: true, approvalStatus: "APPROVED" },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1)
      throw new ApiError(
        400,
        "Сэргээх холбоос хүчингүй эсвэл хугацаа дууссан байна.",
      );
    await tx.user.update({
      where: { id: item.userId },
      data: { passwordHash },
    });
    await tx.passwordReset.updateMany({
      where: { userId: item.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.session.deleteMany({ where: { userId: item.userId } });
    await tx.auditLog.create({
      data: {
        actorId: item.userId,
        action: "PASSWORD_RESET",
        entity: "users",
        entityId: item.userId,
      },
    });
  });
}
