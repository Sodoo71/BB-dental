import { normalizeRole, type StoredRole, type AppRole } from "@/lib/roles";
export type StaffRole = StoredRole;
export type AccountState = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
export type Permission = "users:manage" | "settings:manage" | "appointments:manage" | "patients:read" | "clinical:own";
export type Principal = { role: StaffRole; status: AccountState; isActive: boolean };
const grants: Record<AppRole, readonly Permission[]> = {
  ADMIN: ["users:manage", "settings:manage", "appointments:manage", "patients:read", "clinical:own"],
  RECEPTION: ["appointments:manage", "patients:read"],
  DOCTOR: ["clinical:own"],
  USER: [],
};
export function hasPermission(user: Principal | null, permission: Permission): boolean {
  const role = user && normalizeRole(user.role);
  return Boolean(user?.isActive && user.status === "ACTIVE" && role && grants[role].includes(permission));
}
export function mayManageUser(actor: { id: string; role: StaffRole }, target: { id: string; role: StaffRole }, nextRole?: StaffRole) {
  return normalizeRole(actor.role) === "ADMIN" && actor.id !== target.id &&
    (nextRole === undefined || (nextRole !== "SUPER_ADMIN" && nextRole !== "PATIENT"));
}
