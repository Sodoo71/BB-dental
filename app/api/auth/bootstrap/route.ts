import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST() {
  const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password)
    return NextResponse.json(
      { error: "Super Admin environment тохиргоо дутуу байна." },
      { status: 503 },
    );
  const existing = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });
  if (existing && process.env.NODE_ENV === "production")
    return NextResponse.json(
      { error: "Super Admin аль хэдийн үүссэн байна." },
      { status: 409 },
    );
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { email, passwordHash: hashPassword(password), isActive: true },
    });
    return NextResponse.json({
      success: true,
      message: "Local Super Admin нууц үг шинэчлэгдлээ.",
    });
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: "Super Admin",
      passwordHash: hashPassword(password),
      role: "SUPER_ADMIN",
    },
  });
  return NextResponse.json(
    { success: true, data: { id: user.id, email: user.email } },
    { status: 201 },
  );
}
