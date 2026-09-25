export type AppRole = "PATIENT" | "SUPER_ADMIN" | "ADMIN" | "RECEPTION" | "DOCTOR";

export const getDashboardRouteForRole = (role: string | null | undefined) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";
    case "DOCTOR":
      return "/doctor";
    case "ADMIN":
      return "/super-admin";
    case "RECEPTION":
      return "/admin";
    default:
      return "/login";
  }
};

export const getRoleLabel = (role: string | null | undefined) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "Ерөнхий админ";
    case "ADMIN":
      return "Админ";
    case "DOCTOR":
      return "Эмч";
    case "RECEPTION":
      return "Ресепшн";
    case "PATIENT":
      return "Үйлчлүүлэгч";
    default:
      return "Хэрэглэгч";
  }
};
