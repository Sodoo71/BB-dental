export type UserRole = "PATIENT" | "SUPER_ADMIN" | "ADMIN" | "RECEPTION" | "DOCTOR";

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
