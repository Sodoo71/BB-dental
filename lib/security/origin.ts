export function isSameOriginMutation(method: string, origin: string | null, target: string, fetchSite: string | null) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  if (fetchSite === "cross-site") return false;
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(target).origin; } catch { return false; }
}
