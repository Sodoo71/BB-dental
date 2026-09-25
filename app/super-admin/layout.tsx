import { ModeSwitcher } from "@/components/auth/ModeSwitcher";
import { redirect } from "next/navigation";
import { SuperAdminLayout as DashboardShell } from "@/components/super-admin/layout";
import { sessionUser } from "@/lib/auth";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await sessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return <DashboardShell user={user}><ModeSwitcher doctorId={user.doctorId} />{children}</DashboardShell>;
}
