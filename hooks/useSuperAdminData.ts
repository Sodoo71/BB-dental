"use client";

import { useEffect, useState } from "react";
import {
  getCurrentSuperAdminProfile,
  getSuperAdminDashboard,
} from "@/lib/api/super-admin";
import type { Overview } from "@/types/dashboard";
import type { DoctorRow } from "@/types/doctor";
import type { ServiceRow } from "@/types/service";
import type { UserRow } from "@/types/user";

export function useSuperAdminData() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);

      const profile = await getCurrentSuperAdminProfile();
      if (!profile) {
        window.location.replace("/login");
        return;
      }

      const data = await getSuperAdminDashboard();
      setSessionUserId(profile.id);
      setOverview(data.overview);
      setDoctors(data.doctors);
      setUsers(data.users);
      setPendingUsers(data.pendingUsers);
      setServices(data.services);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Хяналтын самбарыг ачаалах боломжгүй байна",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) return;
      await refresh();
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return {
    overview,
    doctors,
    users,
    pendingUsers,
    services,
    sessionUserId,
    loading,
    error,
    refresh,
    setUsers,
    setPendingUsers,
    setServices,
  } as const;
}
