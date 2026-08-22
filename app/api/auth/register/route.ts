import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const validRoles = ["DOCTOR", "ADMIN", "SUPER_ADMIN"] as const;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "DOCTOR";

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

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "И-мэйл аль хэдийн бүртгэгдсэн байна." },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        role: role as (typeof validRoles)[number],
        isActive: false,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Бүртгэл үүсгэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
