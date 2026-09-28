import { NextResponse } from "next/server";
import { syncDoctor } from "@/lib/auth/users";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation/auth";
import { apiError } from "@/lib/security/http";
import { rateLimit } from "@/lib/security/rate-limit";
export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    await rateLimit("registration", "clinic", 30);
    await rateLimit("registration-email", input.email, 3, 60);
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async (tx) => {
      const setting = await tx.systemSetting.findUnique({ where: { key: "registration_policy" } });
      let autoApprove = false;
      if (setting) {
        try { autoApprove = JSON.parse(setting.value).autoApproveDoctors === true; } catch { /* fail closed */ }
      }
      const user = await tx.user.create({
        data: { name: input.name, email: input.email, role: input.role, passwordHash, isActive: autoApprove, status: autoApprove ? "ACTIVE" : "PENDING" },
        select: { id: true, name: true, email: true, role: true, status: true, isActive: true },
      });
      if (autoApprove && input.role === "DOCTOR") {
        await syncDoctor(tx, user.id);
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: "USER_REGISTERED", entity: "User", entityId: user.id, metadata: { status: user.status, role: user.role } } });
      return user;
    });
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) { return apiError(error); }
}
