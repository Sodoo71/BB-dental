import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "smilecare_session";
const secret = () => process.env.AUTH_SECRET ?? "";
export const hashPassword = (password: string) => {
  const salt = randomUUID();
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
export const verifyPassword = (password: string, hash: string) => {
  if (typeof password !== "string" || typeof hash !== "string") return false;

  const [salt, value] = hash.split(":");
  if (!salt || !value || !/^[0-9a-fA-F]+$/.test(value)) return false;

  try {
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(derived, Buffer.from(value, "hex"));
  } catch {
    return false;
  }
};
const sign = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("base64url");
export async function sessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !secret()) return null;
  const [id, signature] = token.split(".");
  if (
    !id ||
    !signature ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id)))
  )
    return null;
  return prisma.user.findFirst({
    where: { id, isActive: true },
    select: { id: true, role: true, doctorId: true, name: true },
  });
}
export async function requireRole(...roles: string[]) {
  const user = await sessionUser();
  return user && roles.includes(user.role) ? user : null;
}
export const sessionCookie = (id: string) => ({
  name: COOKIE,
  value: `${id}.${sign(id)}`,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
});
