import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requirePermission } from "@/lib/auth";
import { mayManageUser } from "@/lib/permissions/policy";
import { lockUserAdministration } from "@/lib/auth/users";
import { passwordSchema } from "@/lib/validation/auth";
import { apiError, HttpError } from "@/lib/security/http";
export async function POST(request: Request) {
  try {
    const actor = await requirePermission("users:manage");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    const { userId, newPassword } = z.object({ userId: z.string().uuid(), newPassword: passwordSchema }).parse(await request.json());
    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await lockUserAdministration(tx, actor);
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) throw new HttpError(404, "Хэрэглэгч олдсонгүй.");
      if (!mayManageUser(actor, target)) throw new HttpError(403, "Энэ хэрэглэгчийн нууц үгийг өөрчлөх эрхгүй байна.");
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "PASSWORD_RESET", entity: "User", entityId: userId } });
    });
    return NextResponse.json({ success: true, message: "Нууц үг амжилттай шинэчлэгдлээ." });
  } catch (error) { return apiError(error); }
}
