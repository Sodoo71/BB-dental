import { fetchJson } from "@/lib/api";
import type { DoctorRow } from "@/types/doctor";
import type { Overview } from "@/types/dashboard";
import type { ServiceRow } from "@/types/service";
import type { UserRow } from "@/types/user";

export type SuperAdminDashboard = {
  overview: Overview;
  doctors: DoctorRow[];
  users: UserRow[];
  services: ServiceRow[];
  pendingUsers: UserRow[];
};

export async function getCurrentSuperAdminProfile() {
  const profile = await fetchJson("/api/auth/me");
  if (profile?.data?.role !== "SUPER_ADMIN") {
    return null;
  }

  return {
    id: String(profile.data.id),
    role: profile.data.role,
  };
}

export async function getSuperAdminDashboard(): Promise<SuperAdminDashboard> {
  const [overviewResponse, doctorsResponse, usersResponse, servicesResponse] =
    await Promise.all([
      fetchJson("/api/super-admin/overview"),
      fetchJson("/api/super-admin/doctors"),
      fetchJson("/api/admin/users"),
      fetchJson("/api/services?all=true"),
    ]);

  const overview = overviewResponse.data as Overview;
  const doctors = (doctorsResponse.data ?? []) as DoctorRow[];
  const users = (usersResponse.data ?? []) as UserRow[];
  const services = (servicesResponse.data ?? []) as ServiceRow[];

  return {
    overview,
    doctors,
    users,
    services,
    pendingUsers: users.filter((user) => !user.isActive),
  };
}
