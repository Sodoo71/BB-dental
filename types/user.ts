export type UserRole = "PATIENT" | "SUPER_ADMIN" | "ADMIN" | "DOCTOR";

export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  doctorId: string | null;
  createdAt: string;
  updatedAt?: string;
};
