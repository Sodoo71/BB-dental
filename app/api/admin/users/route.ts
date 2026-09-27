import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requirePermission } from "@/lib/auth";
import {
  publicUserSelect,
  lockUserAdministration,
  syncDoctor,
  changeAccountState,
} from "@/lib/auth/users";
import { mayManageUser } from "@/lib/permissions/policy";
import {
  emailSchema,
  passwordSchema,
  roleSchema,
  accountStatusSchema,
} from "@/lib/validation/auth";
import { apiError, HttpError } from "@/lib/security/http";
const nullableText = z.string().trim().max(120).nullable().optional();
const fields = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: nullableText,
  telegramChatId: nullableText,
  avatarUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .url()
        .max(2048)
        .refine((v) => v.startsWith("https://")),
    ])
    .nullable()
    .optional(),
  role: roleSchema,
  isActive: z.boolean().optional(),
  status: accountStatusSchema.optional(),
});
export async function GET(request: Request) {
  try {
    if (!(await requirePermission("users:manage")))
      throw new HttpError(403, "Хандах эрхгүй байна.");
    const params = new URL(request.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(params.get("page") ?? 1);
    const search = (params.get("search") ?? "").slice(0, 120);
    const where = {
      ...(params.get("pending") === "true"
        ? { status: "PENDING" as const }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: { ...publicUserSelect, doctor: { select: { title: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 50,
        take: 50,
      }),
      prisma.user.count({ where }),
    ]);
    return NextResponse.json({
      success: true,
      data: users.map((u) => ({ ...u, doctorTitle: u.doctor?.title ?? null })),
      pagination: { page, pageSize: 50, total },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requirePermission("users:manage");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    const input = fields
      .extend({ password: passwordSchema })
      .parse(await request.json());
    if (input.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN")
      throw new HttpError(403, "Энэ эрхийг олгох боломжгүй.");
    const passwordHash = await hashPassword(input.password);
    const status = input.status ?? (input.isActive ? "ACTIVE" : "PENDING");
    const user = await prisma.$transaction(async (tx) => {
      await lockUserAdministration(tx, actor);
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          avatarUrl: input.avatarUrl,
          telegramChatId: input.telegramChatId,
          role: input.role,
          passwordHash,
          status,
          isActive: status === "ACTIVE",
        },
      });
      await syncDoctor(tx, user.id);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "USER_CREATED",
          entity: "User",
          entityId: user.id,
          metadata: { role: user.role, status },
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: publicUserSelect,
      });
    });
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const actor = await requirePermission("users:manage");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    const input = fields
      .partial()
      .extend({
        id: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        password: passwordSchema.optional(),
      })
      .parse(await request.json());
    const id = input.id ?? input.userId;
    if (!id) throw new HttpError(400, "Хэрэглэгчийн ID шаардлагатай.");
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : undefined;
    const user = await prisma.$transaction(async (tx) => {
      await lockUserAdministration(tx, actor);
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw new HttpError(404, "Хэрэглэгч олдсонгүй.");
      if (!mayManageUser(actor, target, input.role))
        throw new HttpError(403, "Энэ хэрэглэгчийг өөрчлөх эрхгүй байна.");
      const status =
        input.status ??
        (input.isActive === undefined
          ? target.status
          : input.isActive
            ? "ACTIVE"
            : target.status === "PENDING"
              ? "PENDING"
              : "SUSPENDED");
      await tx.user.update({
        where: { id },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          avatarUrl: input.avatarUrl,
          telegramChatId: input.telegramChatId,
          role: input.role,
          status,
          isActive: status === "ACTIVE",
          passwordHash,
        },
      });
      await syncDoctor(tx, id);
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "USER_UPDATED",
          entity: "User",
          entityId: id,
          metadata: {
            previousRole: target.role,
            role: input.role ?? target.role,
            previousStatus: target.status,
            status,
          },
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id },
        select: publicUserSelect,
      });
    });
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission("users:manage");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    const { userId } = z
      .object({ userId: z.string().uuid() })
      .parse(await request.json());
    // Preserve authorship and audit history instead of deleting staff identities.
    await changeAccountState(actor, userId, "SUSPENDED");
    return NextResponse.json({
      success: true,
      message: "Хэрэглэгчийн эрхийг түдгэлзүүллээ.",
    });
  } catch (error) {
    return apiError(error);
  }
}
