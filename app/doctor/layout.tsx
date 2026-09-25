import { ModeSwitcher } from "@/components/auth/ModeSwitcher";
import { DoctorShell } from "@/components/layout/DoctorShell";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";

export default async function DoctorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await sessionUser();

  if (!user) {
    redirect("/login");
  }

  if (!["DOCTOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    redirect(
      user.role === "ADMIN" || user.role === "SUPER_ADMIN"
        ? "/admin"
        : "/unauthorized",
    );
  }

  if (!user.doctorId) {
    redirect("/unauthorized");
  }

  return <DoctorShell name={user.name}>
    {user.role !== "DOCTOR" && <ModeSwitcher doctorId={user.doctorId} />}
    {children}
  </DoctorShell>;
}
