import { redirect } from "next/navigation";
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

  if (user.role !== "SUPER_ADMIN") {
    redirect(user.role === "ADMIN" ? "/admin" : "/unauthorized");
  }

  return <>{children}</>;
}
