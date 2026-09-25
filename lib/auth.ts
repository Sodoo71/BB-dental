import { activeSessionUser } from "@/lib/auth/session-state";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/permissions/policy";
import { newSessionToken, sessionTokenHash, validSessionToken, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/auth/session-token";
export { hashPassword, verifyPassword } from "@/lib/auth/password";
export { getDashboardRouteForRole, getRoleLabel, type AppRole } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";

export async function sessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !validSessionToken(token)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    select: { expiresAt: true, user: { select: { id: true, role: true, status: true, isActive: true, doctorId: true, name: true, email: true } } },
  });
  return activeSessionUser(session);
}
export const requireSessionUser = sessionUser;
export async function requireRole(...roles: AppRole[]) {
  const user = await sessionUser();
  return user && (roles.includes(user.role) || (roles.includes("DOCTOR") && Boolean(user.doctorId) && (user.role === "ADMIN" || user.role === "SUPER_ADMIN"))) ? user : null;
}
export async function requirePermission(permission: Permission) {
  const user = await sessionUser();
  return hasPermission(user, permission) ? user : null;
}
export async function sessionCookie(id: string) {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000);
  await prisma.session.create({ data: { userId: id, tokenHash: sessionTokenHash(token), expiresAt: expires } });
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS, expires };
}
export async function revokeCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && validSessionToken(token)) await prisma.session.deleteMany({ where: { tokenHash: sessionTokenHash(token) } });
}
