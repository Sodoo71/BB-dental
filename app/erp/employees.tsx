"use client";
import BrandLoader from "../components/brand-loader";
import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  Stethoscope,
  UserRoundCog,
  MoreHorizontal,
  Send,
  KeyRound,
  Pencil,
  ArrowUpRight,
  Check,
  Copy,
  RefreshCw,
  Link2,
  LayoutGrid,
  List,
} from "lucide-react";
import { roleNames, type Role } from "@/lib/domain";
import { useUser } from "./shell";
import { api, EntityForm, Modal, type Entity, type Field } from "./ui";
import { employeeFields } from "./employee-fields";
const roles = Object.entries(roleNames).map(([value, label]) => ({
  value,
  label,
}));
export default function Employees() {
  const actor = useUser();
  const [items, setItems] = useState<Entity[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [search, setSearch] = useState(""),
    [role, setRole] = useState(""),
    [filter, setFilter] = useState("all"),
    [view, setView] = useState("grid");
  const [modal, setModal] = useState<{
    mode: "create" | "edit" | "role" | "review";
    user?: Entity;
  } | null>(null);
  const [link, setLink] = useState(""),
    [busy, setBusy] = useState("");
  async function load() {
    setLoading(true);
    try {
      const result = await api<{ items: Entity[] }>("/api/erp/users");
      setItems(result.items);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(t);
  }, [message]);
  const pending = items.filter((u) => u.approvalStatus === "PENDING").length,
    active = items.filter((u) => u.active).length;
  const filtered = items.filter(
    (u) =>
      (!role || u.role === role) &&
      (!search ||
        `${u.name} ${u.phone} ${u.email || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "all" ||
        (filter === "pending" && u.approvalStatus === "PENDING") ||
        (filter === "active" && u.active) ||
        (filter === "inactive" && !u.active)),
  );
  async function action(user: Entity, kind: "link" | "test" | "reset") {
    setBusy(user.id + kind);
    setError("");
    try {
      if (kind === "link") {
        const result = await api<{ url: string }>(
          `/api/erp/telegram-link/${user.id}`,
          "POST",
          {},
        );
        setLink(result.url);
      } else {
        const result = await api<{ message?: string }>(
          `/api/erp/${kind === "test" ? "telegram-user-test" : "user-password-reset"}/${user.id}`,
          "POST",
          {},
        );
        setMessage(result.message || "Telegram мэдэгдэл илгээгдлээ.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const modalFields: Field[] =
    modal?.mode === "role"
      ? [
          {
            key: "role",
            label: "Олгох эрх",
            type: "select",
            required: true,
            options: roles,
          },
        ]
      : modal?.mode === "review"
        ? [
            {
              key: "role",
              label: "Олгох эрх",
              type: "select",
              required: true,
              options: roles,
            },
            {
              key: "status",
              label: "Хяналтын шийдвэр",
              type: "select",
              required: true,
              default: "APPROVED",
              options: [
                { value: "APPROVED", label: "Зөвшөөрч идэвхжүүлэх" },
                { value: "REJECTED", label: "Татгалзах" },
              ],
            },
          ]
        : employeeFields(modal?.mode === "edit");
  if (actor.role !== "ADMIN")
    return (
      <div className="erp-alert">
        Ажилтны удирдлагад админ эрх шаардлагатай.
      </div>
    );
  return (
    <div className="employees-page">
      <div className="workspace-heading">
        <div>
          <p className="erp-kicker">БАГИЙН УДИРДЛАГА</p>
          <h1>Манай ажилтнууд</h1>
          <p>Хүмүүс, эрх болон Telegram холболтыг нэг дор удирдаарай.</p>
        </div>
        <div className="workspace-heading-actions">
          <button
            className="erp-icon-button"
            aria-label="Шинэчлэх"
            onClick={load}
          >
            <RefreshCw size={18} />
          </button>
          <button
            className="erp-primary"
            onClick={() => setModal({ mode: "create" })}
          >
            <Plus size={18} />
            Ажилтан нэмэх
          </button>
        </div>
      </div>
      <div className="team-overview">
        <div className="team-overview-title">
          <span>
            <Users size={27} />
          </span>
          <div>
            <strong>Нэгдсэн баг. Нэг ажлын орчин.</strong>
            <p>Хүн бүрт тохирох эрх, тодорхой хандалт.</p>
          </div>
        </div>
        <div className="team-stats">
          <div>
            <b>{items.length}</b>
            <span>Нийт ажилтан</span>
          </div>
          <div>
            <b>{active}</b>
            <span>Идэвхтэй</span>
          </div>
          <div>
            <b>{pending}</b>
            <span>Хяналт хүлээж буй</span>
          </div>
          <div>
            <b>{items.filter((u) => u.telegramChatId).length}</b>
            <span>Telegram холбосон</span>
          </div>
        </div>
      </div>
      <div className="employees-controls">
        <div className="employee-search">
          <Search size={19} />
          <input
            aria-label="Ажилтан хайх"
            placeholder="Нэр, утас эсвэл имэйлээр хайх…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="employee-role-filter">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Эрхээр шүүх"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Бүх эрх</option>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="employee-view-switch">
          <button
            aria-label="Картаар харах"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            aria-label="Жагсаалтаар харах"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <div className="employee-tabs">
        {[
          ["all", "Бүгд", items.length],
          ["pending", "Зөвшөөрөл хүлээж буй", pending],
          ["active", "Идэвхтэй", active],
          ["inactive", "Идэвхгүй", items.length - active],
        ].map(([value, label, count]) => (
          <button
            key={value}
            className={filter === value ? "selected" : ""}
            onClick={() => setFilter(String(value))}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>
      {error && (
        <div className="erp-alert" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="erp-toast" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
      {loading ? (
        <BrandLoader />
      ) : (
        <div className={`employee-grid employee-view-${view}`}>
          {filtered.map((user) => {
            const RoleIcon =
              user.role === "ADMIN"
                ? ShieldCheck
                : user.role === "DOCTOR"
                  ? Stethoscope
                  : UserRoundCog;
            return (
              <article
                className={`employee-card employee-${user.role?.toLowerCase()}`}
                key={user.id}
              >
                <div className="employee-card-top">
                  <span className="employee-avatar">
                    {user.name
                      ?.split(/\s+/)
                      .map((v) => v[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span
                    className={`employee-state ${user.approvalStatus === "PENDING" ? "pending" : user.active ? "active" : "inactive"}`}
                  >
                    {user.approvalStatus === "PENDING"
                      ? "Зөвшөөрөл хүлээж байна"
                      : user.approvalStatus === "REJECTED"
                        ? "Татгалзсан"
                        : user.active
                          ? "Идэвхтэй"
                          : "Идэвхгүй"}
                  </span>
                  <details className="employee-menu">
                    <summary aria-label={`${user.name} нэмэлт үйлдэл`}>
                      <MoreHorizontal size={21} />
                    </summary>
                    <div>
                      <button
                        disabled={!!busy || !user.active}
                        onClick={() => action(user, "link")}
                      >
                        <Link2 size={15} />
                        Telegram холбох
                      </button>
                      <button
                        disabled={
                          !!busy || !user.telegramChatId || !user.active
                        }
                        onClick={() => action(user, "test")}
                      >
                        <Send size={15} />
                        Мэдэгдэл турших
                      </button>
                      <button
                        aria-label="Telegram руу сэргээх холбоос илгээх"
                        disabled={
                          !!busy ||
                          !user.active ||
                          user.approvalStatus !== "APPROVED" ||
                          !user.telegramChatId
                        }
                        onClick={() => action(user, "reset")}
                      >
                        <KeyRound size={15} />
                        Нууц үг сэргээх
                      </button>
                    </div>
                  </details>
                </div>
                <div className="employee-identity">
                  <h2>
                    {user.name}
                    {user.id === actor.id && <small>Та</small>}
                  </h2>
                  <span className="employee-role">
                    <RoleIcon size={14} />
                    {roleNames[user.role as Role]}
                  </span>
                </div>
                <div className="employee-contacts">
                  <a href={`tel:${user.phone}`}>{user.phone}</a>
                  <span>{user.email || "Имэйл бүртгэлгүй"}</span>
                </div>
                <div
                  className={`employee-telegram ${user.telegramChatId ? "connected" : ""}`}
                >
                  <Send size={14} />
                  <span>
                    {user.telegramChatId
                      ? `Telegram · ${user.telegramChatId}`
                      : "Telegram холбогдоогүй"}
                  </span>
                </div>
                <div className="employee-card-actions">
                  <button
                    className="erp-secondary"
                    aria-label="Засах"
                    onClick={() => setModal({ mode: "edit", user })}
                  >
                    <Pencil size={14} />
                    Мэдээлэл засах
                  </button>
                  {user.approvalStatus === "PENDING" ? (
                    <button
                      className="erp-primary"
                      onClick={() => setModal({ mode: "review", user })}
                    >
                      <Check size={15} />
                      Хянах
                    </button>
                  ) : (
                    <button
                      className="employee-role-button"
                      onClick={() => setModal({ mode: "role", user })}
                    >
                      <ShieldCheck size={15} />
                      Эрх солих
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!filtered.length && (
            <div className="erp-empty">
              <Users size={30} />
              <strong>Тохирох ажилтан олдсонгүй</strong>
              <p>Хайлт эсвэл шүүлтүүрээ өөрчлөөд үзээрэй.</p>
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.mode === "create"
              ? "Шинэ ажилтан"
              : modal.mode === "review"
                ? "Бүртгэл хянах"
                : modal.mode === "role"
                  ? "Ажилтны эрх солих"
                  : "Ажилтны мэдээлэл"
          }
          onClose={() => setModal(null)}
        >
          {modal.mode === "role" && (
            <div className="employee-role-note">
              <ShieldCheck size={22} />
              <p>
                <strong>{modal.user?.name}</strong>
                <br />
                Эрх шинэчлэгдэхэд дахин нэвтэрнэ. Эмнэлзүйн түүх болон эмчийн
                профайлын холбоос хадгалагдана.
              </p>
            </div>
          )}
          <EntityForm
            fields={modalFields}
            initial={modal.user as Record<string, unknown> | undefined}
            onCancel={() => setModal(null)}
            onSubmit={async (values) => {
              const target = modal.user;
              if (
                values.password &&
                values.password !== values.passwordConfirmation
              )
                throw new Error("Давтан нууц үг таарахгүй байна.");
              if (modal.mode === "review")
                await api(
                  `/api/erp/user-approval/${target!.id}`,
                  "POST",
                  values,
                );
              else if (target)
                await api(`/api/erp/users/${target.id}`, "PATCH", {
                  name: target.name,
                  phone: target.phone,
                  email: target.email || "",
                  telegramChatId: target.telegramChatId || "",
                  role: target.role,
                  active: target.active,
                  ...values,
                });
              else await api("/api/erp/users", "POST", values);
              setModal(null);
              if (target?.id === actor.id) {
                window.location.assign("/login");
                return;
              }
              await load();
              setMessage("Ажилтны мэдээлэл шинэчлэгдлээ.");
            }}
          />
        </Modal>
      )}
      {link && (
        <Modal title="Telegram холбох холбоос" onClose={() => setLink("")}>
          <div className="telegram-link-modal">
            <Send size={32} />
            <p>
              Энэ холбоосыг ажилтанд дамжуулна. Ажилтан өөрийн Telegram-аас
              холбоосыг нээгээд Start дарна. Холбоос 15 минут хүчинтэй, нэг удаа
              ашиглагдана.
            </p>
            <input aria-label="Telegram холбох холбоос" readOnly value={link} />
            <button
              className="erp-primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setMessage("Холбоос хуулагдлаа.");
                } catch {
                  setMessage("Холбоосыг сонгон хуулна уу.");
                }
              }}
            >
              <Copy size={16} />
              Холбоос хуулах
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
