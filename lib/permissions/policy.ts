export type StaffRole = "SUPER_ADMIN" | "ADMIN" | "RECEPTION" | "DOCTOR" | "PATIENT";
export type AccountState = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
export type Permission = "users:manage" | "settings:manage" | "appointments:manage" | "patients:read" | "clinical:own";
export type Principal = { role: StaffRole; status: AccountState; isActive: boolean };
const grants: Record<StaffRole, readonly Permission[]> = {
  SUPER_ADMIN: ["users:manage", "settings:manage", "appointments:manage", "patients:read", "clinical:own"],
  ADMIN: ["users:manage", "settings:manage", "appointments:manage", "patients:read", "clinical:own"],
  RECEPTION: ["appointments:manage", "patients:read"],
  DOCTOR: ["clinical:own"],
  PATIENT: [],
};
export function hasPermission(user: Principal | null, permission: Permission): boolean {
  return Boolean(user?.isActive && user.status === "ACTIVE" && grants[user.role].includes(permission));
}
export function mayManageUser(actor: { id: string; role: StaffRole }, target: { id: string; role: StaffRole }, nextRole?: StaffRole) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") return false;
  if (actor.id === target.id) return false;
  return actor.role === "SUPER_ADMIN" || (target.role !== "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN");
}
