import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";

const validRoles = ["DOCTOR", "ADMIN", "SUPER_ADMIN"] as const;

export async function GET(request: Request) {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pendingOnly = searchParams.get("pending") === "true";

  const users = await prisma.user.findMany({
    where: pendingOnly ? { isActive: false } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      doctorId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, data: users });
}

export async function POST(request: Request) {
  const currentUser = await requireRole("SUPER_ADMIN");
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "DOCTOR";
    const isActive = body.isActive === true;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Нэр, и-мэйл, нууц үг шаардлагатай." },
        { status: 400 },
      );
    }

    if (!validRoles.includes(role as (typeof validRoles)[number])) {
      return NextResponse.json({ error: "Роль буруу байна." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Нууц үг хамгийн багадаа 6 тэмдэгт байна." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "И-мэйл аль хэдийн бүртгэгдсэн байна." },
        { status: 409 },
      );
    }

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          role: role as (typeof validRoles)[number],
          isActive,
        },
      });

      if (role === "DOCTOR" && isActive) {
        const doctor = await tx.doctor.create({
          data: {
            name: user.name,
            title: "Doctor",
            email: user.email,
            phone: null,
            isActive: true,
          },
        });

        return tx.user.update({
          where: { id: user.id },
          data: { doctorId: doctor.id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            doctorId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          doctorId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json(
      { success: true, data: createdUser },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Хэрэглэгч үүсгэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const currentUser = await requireRole("SUPER_ADMIN");
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";

    if (!userId.trim()) {
      return NextResponse.json(
        { error: "Хэрэглэгчийн ID шаардлагатай." },
        { status: 400 },
      );
    }

    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "Өөрийн хэрэглэгчийн бүртгэлийг устгах боломжгүй." },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Хэрэглэгч олдсонгүй." },
        { status: 404 },
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      success: true,
      message: `${targetUser.name} хэрэглэгчийг устгалаа.`,
    });
  } catch (error) {
    console.error("DELETE /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Хэрэглэгч устгахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
