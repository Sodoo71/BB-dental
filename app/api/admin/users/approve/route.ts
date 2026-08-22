import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { userId } = (await request.json()) as Record<string, unknown>;

    if (typeof userId !== "string" || !userId.trim()) {
      return NextResponse.json(
        { error: "Хэрэглэгчийн ID шаардлагатай." },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        doctorId: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Хэрэглэгч олдсонгүй." },
        { status: 404 },
      );
    }

    const approvedUser = await prisma.$transaction(async (tx) => {
      let doctorId = targetUser.doctorId;

      if (targetUser.role === "DOCTOR" && !doctorId) {
        const doctor = await tx.doctor.create({
          data: {
            name: targetUser.name,
            title: "Doctor",
            email: targetUser.email,
            phone: null,
            isActive: true,
          },
        });
        doctorId = doctor.id;
      }

      return tx.user.update({
        where: { id: targetUser.id },
        data: {
          isActive: true,
          doctorId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          doctorId: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: approvedUser });
  } catch (error) {
    console.error("POST /api/admin/users/approve error:", error);
    return NextResponse.json(
      { error: "Хэрэглэгчийг баталгаажуулахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
