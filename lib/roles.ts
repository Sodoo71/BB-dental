export type AppRole = "PATIENT" | "SUPER_ADMIN" | "ADMIN" | "DOCTOR";

export const getDashboardRouteForRole = (role: string | null | undefined) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";
    case "DOCTOR":
      return "/doctor";
    case "ADMIN":
      return "/admin";
    default:
      return "/login";
  }
};

export const getRoleLabel = (role: string | null | undefined) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "DOCTOR":
      return "Doctor";
    case "PATIENT":
      return "Patient";
    default:
      return "User";
  }
};
