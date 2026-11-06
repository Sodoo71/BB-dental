"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { ClinicLogo } from "../components/clinic-branding";
import UserAvatar from "../components/user-avatar";
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
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronRight,
  Clock3,
  ClipboardList,
  ShieldCheck,
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
  imageUrl?: string;
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
export function canVisitSection(role: Role, section: string) {
  return navigation
    .flatMap((group) => group.items)
    .some((item) => item.id === section && item.roles.includes(role));
}
const mobileQuery = "(max-width: 900px)";
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
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
  const activeTitle = navigation
    .flatMap((g) => g.items)
    .find((i) => i.id === active)?.label;
  useEffect(() => {
    document.title = `${activeTitle || "Ажлын орчин"} · BB Dental`;
  }, [activeTitle]);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const drawerOpen = mobile && open;
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!drawerOpen) return;
    const sidebar = sidebarRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), [tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const theme = document.querySelector<HTMLElement>(".theme-switcher");
    const previousInert = theme?.inert;
    if (theme) theme.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const list = focusable();
      const first = list[0];
      const last = list.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !sidebar?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      }
      if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !sidebar?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (theme) theme.inert = previousInert || false;
      if (previous?.isConnected) previous.focus();
    };
  }, [drawerOpen]);
  return (
    <UserContext.Provider value={user}>
      <div className={`erp-shell${collapsed ? " sidebar-collapsed" : ""}`}>
        <a href="#erp-main-content" className="skip-link" inert={drawerOpen}>
          Үндсэн агуулга руу очих
        </a>
        {drawerOpen && (
          <button
            className="sidebar-shade"
            tabIndex={-1}
            aria-label="Цэс хаах"
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          ref={sidebarRef}
          className={`erp-sidebar ${drawerOpen ? "open" : ""}`}
          inert={mobile && !drawerOpen}
          role={drawerOpen ? "dialog" : undefined}
          aria-modal={drawerOpen || undefined}
          aria-label="Ажлын цэс"
        >
          {drawerOpen && (
            <button
              type="button"
              className="erp-secondary"
              aria-label="Цэс хаах"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
              Цэс хаах
            </button>
          )}
          <Link href="/erp" className="erp-brand">
            <ClinicLogo alt="" width={39} height={39} />
            <span>
              BB Dental<small>CLINIC WORKSPACE</small>
            </span>
          </Link>
          <nav id="erp-navigation" aria-label="Ажлын цэс">
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
                        aria-label={i.label}
                        title={collapsed ? i.label : undefined}
                        aria-current={active === i.id ? "page" : undefined}
                        className={active === i.id ? "active" : ""}
                        onClick={() => setOpen(false)}
                      >
                        <i.icon size={19} />
                        <span className="nav-label">{i.label}</span>
                        {active === i.id && <span className="nav-active-dot" />}
                      </Link>
                    ))}
                  </div>
                )
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <span className="user-avatar">
                <UserAvatar imageUrl={user.imageUrl} name={user.name} />
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>{roleNames[user.role]}</small>
              </span>
            </div>
            <Link href="/" target="_blank">
              Эмнэлгийн вебсайт <ArrowUpRight size={16} />
            </Link>
          </div>
        </aside>
        <div className="erp-main" inert={drawerOpen}>
          <header className="erp-topbar">
            <button
              className="erp-collapse-menu"
              type="button"
              aria-label={collapsed ? "Цэс дэлгэх" : "Цэс хураах"}
              aria-expanded={!collapsed}
              aria-controls="erp-navigation"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </button>
            <button
              className="erp-mobile-menu"
              ref={menuRef}
              aria-label={drawerOpen ? "Цэс хаах" : "Цэс нээх"}
              aria-expanded={drawerOpen}
              aria-controls="erp-navigation"
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
                  <UserAvatar imageUrl={user.imageUrl} name={user.name} />
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
                  router.push("/login");
                  router.refresh();
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>
          <main id="erp-main-content" className="erp-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </UserContext.Provider>
  );
}
