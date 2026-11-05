import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { ApiError, ensureDatabase } from "./http";
import type { Role } from "./domain";
export const COOKIE = "bb_session";
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const userSelect = {
  id: true,
  name: true,
  phone: true,
  role: true,
  active: true,
  approvalStatus: true,
  doctor: { select: { id: true } },
} as const;
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  ensureDatabase();
  const session = await db.session.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { select: userSelect } },
  });
  return session &&
    session.expiresAt > new Date() &&
    session.user.active &&
    session.user.approvalStatus === "APPROVED"
    ? session.user
    : null;
}
export type Actor = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
export async function requireUser(roles?: readonly Role[]) {
  ensureDatabase();
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Нэвтэрнэ үү.");
  if (roles && !roles.includes(user.role))
    throw new ApiError(403, "Энэ үйлдлийг хийх эрхгүй.");
  return user;
}
export async function loginSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      userId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 12 * 3600_000),
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 43200,
  });
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const hashed = digest(key);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${hashed},1,${new Date(Date.now() + seconds * 1000)}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END, "expiresAt" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN EXCLUDED."expiresAt" ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > limit)
    throw new ApiError(
      429,
      "Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.",
    );
}
export function patientScope(user: Actor) {
  return user.role === "DOCTOR"
    ? {
        OR: [
          { appointments: { some: { doctorId: user.doctor?.id || "none" } } },
          { treatments: { some: { doctorId: user.doctor?.id || "none" } } },
          {
            transfers: { some: { targetDoctorId: user.doctor?.id || "none" } },
          },
        ],
      }
    : {};
}
export async function patientAccess(user: Actor, patientId: string) {
  const found = await db.patient.findFirst({
    where: { id: patientId, ...patientScope(user) },
    select: { id: true },
  });
  if (!found) throw new ApiError(404, "Өвчтөн олдсонгүй.");
}
export async function clinicalScope(user: Actor, patientId: string) {
  await patientAccess(user, patientId);
  const handover =
    user.role === "DOCTOR"
      ? await db.patientTransfer.findFirst({
          where: { patientId, targetDoctorId: user.doctor?.id || "none" },
          select: { id: true },
        })
      : null;
  return user.role === "DOCTOR" && !handover
    ? { doctorId: user.doctor?.id || "none" }
    : {};
}
export async function audit(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
) {
  await db.auditLog.create({
    data: { actorId: actor.id, action, entity, entityId },
  });
}
