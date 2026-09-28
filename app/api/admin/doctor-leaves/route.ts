import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { hasDoctorLeaveConflict } from "@/lib/doctor-leaves";
import { apiError, HttpError } from "@/lib/security/http";

export async function GET(request: Request) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const status = new URL(request.url).searchParams.get("status");
  const validStatuses = ["PENDING", "APPROVED", "ALL"] as const;
  if (
    status &&
    !validStatuses.includes(status as (typeof validStatuses)[number])
  ) {
    return NextResponse.json({ error: "Төлөв буруу байна." }, { status: 400 });
  }

  const requests = await prisma.doctorAvailabilityException.findMany({
    include: { doctor: { select: { id: true, name: true, title: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
  });
  const withStatus = requests.map((item) => ({
    ...item,
    status: item.isActive ? "APPROVED" : "PENDING",
  }));
  const filtered =
    !status || status === "ALL"
      ? withStatus
      : withStatus.filter((item) => item.status === status);

  return NextResponse.json({ success: true, data: filtered });
}

export async function PATCH(request: Request) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    if (!id || (action !== "APPROVE" && action !== "CANCEL")) {
      throw new HttpError(400, "Хүсэлт болон үйлдлээ шалгана уу.");
    }

    const requestItem = await prisma.doctorAvailabilityException.findUnique({
      where: { id },
    });
    if (!requestItem) throw new HttpError(404, "Чөлөөний хүсэлт олдсонгүй.");

    if (action === "APPROVE" && requestItem.isActive) {
      throw new HttpError(409, "Зөвхөн хүлээгдэж буй хүсэлтийг батална.");
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const dateKey = requestItem.date.toISOString().slice(0, 10);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${requestItem.doctorId}:${dateKey}`}))::text`;

        const current = await tx.doctorAvailabilityException.findUnique({
          where: { id },
        });
        if (!current || current.isActive !== requestItem.isActive) {
          throw new HttpError(
            409,
            "Хүсэлт өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.",
          );
        }

        if (action === "APPROVE") {
          const appointments = await tx.appointment.findMany({
            where: {
              doctorId: current.doctorId,
              appointmentDate: current.date,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            select: { startTime: true, endTime: true },
          });
          const conflict = hasDoctorLeaveConflict(
            current.type,
            current.startTime,
            current.endTime,
            appointments,
          );
          if (conflict) {
            throw new HttpError(
              409,
              "Энэ хугацаанд баталгаажсан эсвэл хүлээгдэж буй үзлэг байна. Захиалгыг эхлээд шилжүүлж эсвэл зохицуулна уу.",
            );
          }
        }

        if (action === "APPROVE") {
          const updated = await tx.doctorAvailabilityException.updateMany({
            where: { id, isActive: false },
            data: { isActive: true },
          });
          if (!updated.count) {
            throw new HttpError(
              409,
              "Хүсэлт өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.",
            );
          }
        } else {
          const deleted = await tx.doctorAvailabilityException.deleteMany({
            where: { id, isActive: current.isActive },
          });
          if (!deleted.count) {
            throw new HttpError(
              409,
              "Хүсэлт өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.",
            );
          }
        }
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action:
              action === "APPROVE"
                ? "DOCTOR_LEAVE_APPROVED"
                : "DOCTOR_LEAVE_CANCELLED",
            entity: "DoctorAvailabilityException",
            entityId: id,
            ...(action === "CANCEL" && {
              metadata: {
                date: current.date.toISOString(),
                type: current.type,
                startTime: current.startTime,
                endTime: current.endTime,
                reason: current.reason,
                wasApproved: current.isActive,
              },
            }),
          },
        });
        if (action === "CANCEL") return { id, status: "CANCELLED" as const };
        const approved = await tx.doctorAvailabilityException.findUniqueOrThrow(
          {
            where: { id },
            include: {
              doctor: { select: { id: true, name: true, title: true } },
            },
          },
        );
        return { ...approved, status: "APPROVED" as const };
      },
      { timeout: 15000 },
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiError(error);
  }
}
