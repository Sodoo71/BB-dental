import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "smilecare_session";
const secret = () =>
  process.env.AUTH_SECRET ?? "smilecare-dev-secret-change-me";

export type AppRole = "PATIENT" | "SUPER_ADMIN" | "ADMIN" | "DOCTOR";

export const getDashboardRouteForRole = (role: string | null | undefined) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";
    case "DOCTOR":
      return "/doctor";
    case "ADMIN":
      return "/admin";
    default:
      return "/login";
  }
};

export const getRoleLabel = (role: string | null | undefined) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "DOCTOR":
      return "Doctor";
    case "PATIENT":
      return "Patient";
    default:
      return "User";
  }
};

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
  if (!token) return null;

  const [id, signature] = token.split(".");
  if (
    !id ||
    !signature ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id)))
  )
    return null;

  return prisma.user.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      role: true,
      doctorId: true,
      name: true,
      email: true,
    },
  });
}

export async function requireRole(...roles: AppRole[]) {
  const user = await sessionUser();
  return user && roles.includes(user.role) ? user : null;
}

export const sessionCookie = (id: string) => {
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 12);

  return {
    name: COOKIE,
    value: `${id}.${sign(id)}`,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
    expires,
  };
};
