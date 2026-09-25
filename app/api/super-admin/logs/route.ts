import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { apiError, HttpError } from "@/lib/security/http";
export async function GET(request: Request) {
  try {
    if (!await requirePermission("users:manage")) throw new HttpError(403, "Хандах эрхгүй байна.");
    const page = z.coerce.number().int().min(1).max(100000).parse(new URL(request.url).searchParams.get("page") ?? 1);
    const rows = await prisma.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50 });
    return NextResponse.json({ success: true, data: rows.map((row) => ({ id: row.id, action: row.action, category: row.entity === "User" ? "USER" : "SYSTEM", actor: row.actorId ?? "System", details: `${row.entity}: ${row.entityId}`, time: row.createdAt.toISOString(), badge: row.action, badgeColor: "bg-slate-100 text-slate-700" })) });
  } catch (error) { return apiError(error); }
}
