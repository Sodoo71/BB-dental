import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { apiError, HttpError } from "@/lib/security/http";
export async function GET(request: Request) {
  try {
    if (!await requirePermission("users:manage")) throw new HttpError(403, "Хандах эрхгүй байна.");
    const params = new URL(request.url).searchParams;
    const page = z.coerce.number().int().min(1).max(100000).parse(params.get("page") ?? 1);
    const category = z.enum(["ALL", "APPOINTMENT", "USER", "DOCTOR", "SYSTEM"]).parse(params.get("category") ?? "ALL");
    const search = (params.get("search") ?? "").trim().slice(0, 120);
    const entities = { APPOINTMENT: "Appointment", USER: "User", DOCTOR: "Doctor" };
    const matchingActors = search ? await prisma.user.findMany({ where: { name: { contains: search, mode: "insensitive" } }, select: { id: true } }) : [];
    const where = {
      ...(category === "ALL" ? {} : category === "SYSTEM" ? { entity: { notIn: Object.values(entities) } } : { entity: entities[category] }),
      ...(search ? { OR: [{ action: { contains: search, mode: "insensitive" as const } }, { entityId: { contains: search, mode: "insensitive" as const } }, { actorId: { in: matchingActors.map(a => a.id) } }] } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50 }),
      prisma.auditLog.count({ where }),
    ]);
    const actors = await prisma.user.findMany({ where: { id: { in: rows.flatMap(r => r.actorId ? [r.actorId] : []) } }, select: { id: true, name: true } });
    const names = new Map(actors.map(a => [a.id, a.name]));
    return NextResponse.json({ success: true, pagination: { page, total, pageSize: 50 }, data: rows.map(row => ({ id: row.id, action: row.action, category: Object.entries(entities).find(([, entity]) => entity === row.entity)?.[0] ?? "SYSTEM", actor: row.actorId ? names.get(row.actorId) ?? row.actorId : "System", details: `${row.entity}: ${row.entityId}`, time: row.createdAt.toISOString(), badge: row.action, badgeColor: "bg-slate-100 text-slate-700" })) });
  } catch (error) { return apiError(error); }
}
