import { ModeSwitcher } from "@/components/auth/ModeSwitcher";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await sessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "RECEPTION") {
    redirect("/unauthorized");
  }

  return <><a className="skip-link" href="#reception-main">Үндсэн хэсэг рүү очих</a>{user.role !== "RECEPTION" && <div className="border-b border-slate-200 bg-white px-4 pt-4"><ModeSwitcher doctorId={user.doctorId} /></div>}{children}</>;
}
