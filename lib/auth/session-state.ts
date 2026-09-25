export function activeSessionUser<T extends { isActive: boolean; status: string }>(session: { expiresAt: Date; user: T } | null, now = new Date()): T | null {
  if (!session || session.expiresAt <= now || !session.user.isActive || session.user.status !== "ACTIVE") return null;
  return session.user;
}
