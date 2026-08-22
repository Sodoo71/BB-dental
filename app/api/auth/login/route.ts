import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCookie, verifyPassword } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string")
      return NextResponse.json(
        { error: "Имэйл, нууц үг шаардлагатай." },
        { status: 400 },
      );
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Нэвтрэх мэдээлэл буруу байна." },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Таны бүртгэл Админы баталгаажуулалт хүлээж байна" },
        { status: 403 },
      );
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Нэвтрэх мэдээлэл буруу байна." },
        { status: 401 },
      );
    }
    const response = NextResponse.json({
      success: true,
      data: {
        name: user.name,
        role: user.role,
        doctorId: user.doctorId,
      },
    });
    response.cookies.set(sessionCookie(user.id));
    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { error: "Нэвтрэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
