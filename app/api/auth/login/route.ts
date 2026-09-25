import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCookie, verifyPassword } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/auth";
import { apiError, HttpError } from "@/lib/security/http";
import { rateLimit } from "@/lib/security/rate-limit";
const dummyHash = hashPassword("dummy-password-for-timing-only");
export async function POST(request: Request) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    await rateLimit("login", email, 8);
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
    if (!user || !valid) throw new HttpError(401, "Нэвтрэх мэдээлэл буруу байна.");
    if (user.status === "PENDING") throw new HttpError(403, "Таны бүртгэл админы баталгаажуулалт хүлээж байна.");
    if (!user.isActive || user.status !== "ACTIVE") throw new HttpError(403, "Таны бүртгэлийн эрх идэвхгүй байна. Админтай холбогдоно уу.");
    const response = NextResponse.json({ success: true, data: { name: user.name, role: user.role, doctorId: user.doctorId } });
    response.cookies.set(await sessionCookie(user.id));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return apiError(error); }
}
