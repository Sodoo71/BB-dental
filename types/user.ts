export type { AppRole as UserRole } from "@/lib/roles";
import type { AppRole as UserRole } from "@/lib/roles";

export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  status: "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED";
  doctorId: string | null;
  createdAt: string;
  updatedAt?: string;
};
