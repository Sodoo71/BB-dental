import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: "userId болон newPassword шаардлагатай." },
        { status: 400 },
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Нууц үг хамгийн багадаа 6 тэмдэгт байна." },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Хэрэглэгч олдсонгүй." },
        { status: 404 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      message: "Нууц үг амжилттай шинэчлэгдлээ.",
    });
  } catch (error) {
    console.error("POST /api/admin/users/reset-password error:", error);
    return NextResponse.json(
      { error: "Нууц үгийг шинэчлэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
