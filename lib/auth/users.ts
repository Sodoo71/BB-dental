import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { mayManageUser, type StaffRole, type AccountState } from "@/lib/permissions/policy";
import { HttpError } from "@/lib/security/http";
export const publicUserSelect = { id: true, name: true, email: true, phone: true, avatarUrl: true, telegramChatId: true, role: true, status: true, isActive: true, doctorId: true, createdAt: true, updatedAt: true } satisfies Prisma.UserSelect;
export async function lockUserAdministration(tx: Prisma.TransactionClient, actor?: { id: string; role: StaffRole }) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(82173642)::text`;
  if (actor) {
    const current = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, status: true, isActive: true } });
    if (!current || current.role !== actor.role || !current.isActive || current.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(current.role)) throw new HttpError(403, "Хандах эрх өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.");
  }
}
export async function syncDoctor(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "DOCTOR" && !user.doctorId && user.status === "ACTIVE") {
    const existing = await tx.doctor.findFirst({ where: { user: null, email: { equals: user.email, mode: "insensitive" } } });
    const doctor = existing ?? await tx.doctor.create({ data: { name: user.name, email: user.email, specialty: "", experience: 0, phone: user.phone, avatarUrl: user.avatarUrl, imageUrl: user.avatarUrl, telegramChatId: user.telegramChatId, isActive: user.isActive } });
    await tx.user.update({ where: { id: user.id }, data: { doctorId: doctor.id } });
    if (existing) await syncDoctor(tx, userId);
  } else if (user.doctorId) {
    await tx.doctor.update({ where: { id: user.doctorId }, data: { name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl, imageUrl: user.avatarUrl, telegramChatId: user.telegramChatId, isActive: user.isActive && user.status === "ACTIVE" && ["DOCTOR", "ADMIN", "SUPER_ADMIN"].includes(user.role) } });
  }
}
export async function changeAccountState(actor: { id: string; role: StaffRole }, userId: string, status: AccountState) {
  return prisma.$transaction(async (tx) => {
    await lockUserAdministration(tx, actor);
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new HttpError(404, "Хэрэглэгч олдсонгүй.");
    if (!mayManageUser(actor, target)) throw new HttpError(403, "Энэ хэрэглэгчийн эрхийг өөрчлөх боломжгүй.");
    await tx.user.update({ where: { id: userId }, data: { status, isActive: status === "ACTIVE" } });
    await syncDoctor(tx, userId);
    await tx.session.deleteMany({ where: { userId } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: `USER_${status}`, entity: "User", entityId: userId, metadata: { previousStatus: target.status, status } } });
    return tx.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });
  });
}

// Keep the clinical profile and login identity consistent when edited from the doctor pages.
export async function updateDoctorProfile(actor: { id: string; role: StaffRole }, doctorId: string, input: {
  specialty?: string; experience?: number; description?: string | null;
  name: string; title: string | null; phone: string | null; email: string | null;
  avatarUrl: string | null; telegramChatId: string | null; isActive: boolean;
}) {
  return prisma.$transaction(async tx => {
    await lockUserAdministration(tx, actor);
    const linked = await tx.user.findUnique({ where: { doctorId } });
    if (linked) {
      if (linked.id !== actor.id && !mayManageUser(actor, linked)) throw new HttpError(403, "Энэ ажилтны мэдээллийг өөрчлөх эрхгүй байна.");
      if (linked.id === actor.id && !input.isActive) throw new HttpError(400, "Өөрийн эрхийг түдгэлзүүлэх боломжгүй.");
      await tx.user.update({ where: { id: linked.id }, data: {
        name: input.name, phone: input.phone, email: input.email || linked.email,
        avatarUrl: input.avatarUrl, telegramChatId: input.telegramChatId,
        ...(!input.isActive ? { isActive: false, status: "SUSPENDED" } : {}),
      } });
      if (!input.isActive || (input.email && input.email !== linked.email)) await tx.session.deleteMany({ where: { userId: linked.id } });
    }
    const doctor = await tx.doctor.update({ where: { id: doctorId }, data: {
      ...input, imageUrl: input.avatarUrl,
      ...(linked ? { email: input.email || linked.email, isActive: input.isActive && linked.isActive && linked.status === "ACTIVE" } : {}),
    } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "DOCTOR_UPDATED", entity: "Doctor", entityId: doctorId } });
    return doctor;
  });
}
