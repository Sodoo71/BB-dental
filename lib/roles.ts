export const primaryRoles = ["ADMIN", "DOCTOR", "RECEPTION", "USER"] as const;
export type AppRole = typeof primaryRoles[number];
// Read compatibility only. New role assignments must use primaryRoles.
export type StoredRole = AppRole | "SUPER_ADMIN" | "PATIENT";
export function normalizeRole(role: string): AppRole | null {
  if (role === "SUPER_ADMIN") return "ADMIN";
  if (role === "PATIENT") return "USER";
  return primaryRoles.includes(role as AppRole) ? role as AppRole : null;
}
export function normalizeUserRole<T extends { role: string }>(user: T): Omit<T, "role"> & { role: AppRole } {
  const role = normalizeRole(user.role);
  if (!role) throw new Error("Unsupported account role");
  return { ...user, role };
}
export const getDashboardRouteForRole = (role: string | null | undefined) => {
  switch (normalizeRole(role ?? "")) {
    case "ADMIN": return "/super-admin";
    case "DOCTOR": return "/doctor";
    case "RECEPTION": return "/admin";
    default: return "/login";
  }
};
export const getRoleLabel = (role: string | null | undefined) => {
  switch (normalizeRole(role ?? "")) {
    case "ADMIN": return "Админ";
    case "DOCTOR": return "Эмч";
    case "RECEPTION": return "Ресепшн";
    case "USER": return "Хэрэглэгч";
    default: return "Хэрэглэгч";
  }
};
