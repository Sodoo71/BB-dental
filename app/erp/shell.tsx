"use client";
import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { ClinicLogo } from "../components/clinic-branding";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  CreditCard,
  Package,
  FileText,
  ChartNoAxesCombined,
  UserRoundCog,
  Settings2,
  LogOut,
  Search,
  Menu,
  X,
  ChevronRight,
  Clock3,
  ClipboardList,
  ShieldCheck,
  CircleHelp,
  ArrowUpRight,
  BadgeDollarSign,
} from "lucide-react";
import { roleNames, type Role } from "@/lib/domain";
export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  doctorId?: string;
};
const UserContext = createContext<SessionUser | null>(null);
export function useUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error("No staff session");
  return user;
}
const navigation = [
  {
    section: "ЕРӨНХИЙ",
    items: [
      {
        id: "profile",
        label: "Миний профайл",
        icon: UserRoundCog,
        roles: ["ADMIN", "DOCTOR"],
      },
      {
        id: "dashboard",
        label: "Хяналтын самбар",
        icon: LayoutDashboard,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
    ],
  },
  {
    section: "ЭМНЭЛЭГ",
    items: [
      {
        id: "calendar",
        label: "Календарь",
        icon: CalendarDays,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "appointments",
        label: "Цаг захиалга",
        icon: Clock3,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "patients",
        label: "Өвчтөн",
        icon: Users,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "treatments",
        label: "Эмчилгээ",
        icon: Stethoscope,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "services",
        label: "Үйлчилгээ",
        icon: ClipboardList,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "doctors",
        label: "Эмч нар",
        icon: UserRoundCog,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "schedules",
        label: "Ажлын хуваарь",
        icon: CalendarDays,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "leaves",
        label: "Чөлөө, хаалт",
        icon: Clock3,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
    ],
  },
  {
    section: "САНХҮҮ БА БҮРТГЭЛ",
    items: [
      {
        id: "payments",
        label: "Касс, төлбөр",
        icon: CreditCard,
        roles: ["ADMIN", "RECEPTION"],
      },
      {
        id: "expenses",
        label: "Зардал",
        icon: BadgeDollarSign,
        roles: ["ADMIN"],
      },
      {
        id: "inventory",
        label: "Бараа материал",
        icon: Package,
        roles: ["ADMIN", "RECEPTION"],
      },
      {
        id: "documents",
        label: "Баримт, зөвшөөрөл",
        icon: FileText,
        roles: ["ADMIN", "DOCTOR", "RECEPTION"],
      },
      {
        id: "reports",
        label: "Тайлан",
        icon: ChartNoAxesCombined,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    section: "УДИРДЛАГА",
    items: [
      {
        id: "users",
        label: "Ажилтан, эрх",
        icon: UserRoundCog,
        roles: ["ADMIN"],
      },
      { id: "settings", label: "Тохиргоо", icon: Settings2, roles: ["ADMIN"] },
      {
        id: "audit",
        label: "Үйлдлийн түүх",
        icon: ShieldCheck,
        roles: ["ADMIN"],
      },
    ],
  },
];
export function ErpShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname.split("/")[2] || "dashboard";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <UserContext.Provider value={user}>
      <div className="erp-shell">
        {open && (
          <button
            className="sidebar-shade"
            aria-label="Цэс хаах"
            onClick={() => setOpen(false)}
          />
        )}
        <aside className={`erp-sidebar ${open ? "open" : ""}`}>
          <Link href="/erp" className="erp-brand">
            <ClinicLogo alt="" width={39} height={39} />
            <span>
              BB Dental<small>CLINIC WORKSPACE</small>
            </span>
          </Link>
          <div className="clinic-card">
            <div className="clinic-avatar">
              <ClinicLogo alt="" width={34} height={34} />
            </div>
            <span>
              <strong>BB Dental Clinic</strong>
              <small>Эмнэлгийн удирдлага</small>
            </span>
            <ChevronRight size={15} />
          </div>
          <nav aria-label="Ажлын цэс">
            {navigation.map((group) => {
              const items = group.items.filter((i) =>
                i.roles.includes(user.role),
              );
              return (
                items.length > 0 && (
                  <div className="nav-group" key={group.section}>
                    <p>{group.section}</p>
                    {items.map((i) => (
                      <Link
                        key={i.id}
                        href={i.id === "dashboard" ? "/erp" : `/erp/${i.id}`}
                        aria-current={active === i.id ? "page" : undefined}
                        className={active === i.id ? "active" : ""}
                        onClick={() => setOpen(false)}
                      >
                        <i.icon size={19} />
                        {i.label}
                        {active === i.id && <span className="nav-active-dot" />}
                      </Link>
                    ))}
                  </div>
                )
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <Link href="/" target="_blank">
              Эмнэлгийн вебсайт <ArrowUpRight size={16} />
            </Link>
            <span>
              <CircleHelp size={16} /> Дотоод ажлын орчин
            </span>
          </div>
        </aside>
        <div className="erp-main">
          <header className="erp-topbar">
            <button
              className="erp-mobile-menu"
              aria-label="Цэс нээх"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <div className="erp-breadcrumb">
              Ажлын орчин <ChevronRight size={14} />
              <span>
                {
                  navigation
                    .flatMap((g) => g.items)
                    .find((i) => i.id === active)?.label
                }
              </span>
            </div>
            <form
              className="erp-global-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/erp/services?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={18} />
              <input
                aria-label="Үйлчилгээ хайх"
                placeholder="Үйлчилгээ хайх…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <div className="erp-user">
              {user.role !== "RECEPTION" ? (
                <Link
                  className="user-avatar profile-link"
                  href="/erp/profile"
                  aria-label="Миний профайл засах"
                  title="Миний профайл"
                >
                  {user.name.slice(0, 1)}
                </Link>
              ) : (
                <span className="user-avatar">{user.name.slice(0, 1)}</span>
              )}
              <span>
                <strong>{user.name}</strong>
                <small>{roleNames[user.role]}</small>
              </span>
              <button
                aria-label="Гарах"
                title="Гарах"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.assign("/login");
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>
          <div className="erp-content">{children}</div>
        </div>
      </div>
    </UserContext.Provider>
  );
}
