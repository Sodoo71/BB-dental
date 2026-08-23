import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BriefcaseMedical,
  CalendarDays,
  CalendarRange,
  Clock3,
  LayoutDashboard,
  Stethoscope,
  UserCircle2,
  Users,
} from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";
import { sessionUser } from "@/lib/auth";

const links = [
  { href: "/doctor", label: "Хянах самбар", icon: LayoutDashboard },
  { href: "/doctor/calendar", label: "Миний календарь", icon: CalendarRange },
  {
    href: "/doctor/availability",
    label: "Ажиллах цагийн хуваарь",
    icon: CalendarDays,
  },
  {
    href: "/doctor/exceptions",
    label: "Чөлөө",
    icon: Clock3,
  },
  { href: "/doctor/patients", label: "Миний өвчтөнүүд", icon: Users },
  {
    href: "/doctor/appointments",
    label: "Уулзалтууд",
    icon: BriefcaseMedical,
  },
  { href: "/doctor/profile", label: "Миний профайл", icon: UserCircle2 },
];

export default async function DoctorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await sessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "DOCTOR") {
    redirect(
      user.role === "ADMIN" || user.role === "SUPER_ADMIN"
        ? "/admin"
        : "/unauthorized",
    );
  }

  if (!user.doctorId) {
    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6 xl:flex-row">
        <aside className="w-full rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white shadow-lg shadow-slate-200 xl:max-w-[280px]">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
                Эмчийн портал
              </p>
              <h1 className="mt-1 text-lg font-black">Эмнэлгийн систем</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-2xl border border-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-900"
              >
                <Icon className="h-4 w-4 text-emerald-400" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <LogoutButton label="Гарах" />
          </div>
        </aside>

        <div className="flex-1">{children}</div>
      </div>
    </main>
  );
}
