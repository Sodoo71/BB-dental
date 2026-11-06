"use client";
import { useMessage } from "./ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, ShieldCheck, Check, Send, Link2 } from "lucide-react";
import { useUser } from "./shell";
import {
  api,
  EntityForm,
  Feedback,
  useResource,
  type Entity,
  type Field,
} from "./ui";
import { roleNames } from "@/lib/domain";
import BrandLoader from "../components/brand-loader";
import UserAvatar from "../components/user-avatar";
export default function Profile() {
  const actor = useUser(),
    router = useRouter();
  const [savedProfile, setProfile] = useState<Entity | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useMessage();
  const allowed = actor.role === "ADMIN" || actor.role === "DOCTOR";
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramLink, setTelegramLink] = useState("");
  async function telegram(action: "link" | "test") {
    setTelegramBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "link") {
        const result = await api<{ url: string }>(
          "/api/erp/telegram-link",
          "POST",
          {},
        );
        setTelegramLink(result.url);
      } else {
        await api("/api/erp/telegram-user-test", "POST", {});
        setMessage("Telegram туршилт илгээгдлээ.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTelegramBusy(false);
    }
  }
  const {
    data: response,
    error: loadError,
    loading,
    retry,
  } = useResource<Entity>(allowed ? "/api/profile" : null);
  const profile = savedProfile || response;
  const fields: Field[] = [
    { key: "name", label: "Овог нэр", required: true },
    { key: "phone", label: "Утас", type: "tel", required: true },
    { key: "email", label: "Имэйл", type: "email" },
    {
      key: "telegramChatId",
      label: "Telegram Chat ID (заавал биш)",
      hint: "Bot дээр Start дарсан хувийн Chat ID.",
    },
    ...(actor.role === "DOCTOR"
      ? [
          { key: "specialty", label: "Мэргэжил", required: true },
          {
            key: "bio",
            label: "Танилцуулга",
            type: "textarea" as const,
            hint: "Үйлчлүүлэгчид нүүр хуудсанд харагдана.",
          },
          {
            key: "imageUrl",
            label: "Профайлын зураг",
            type: "image" as const,
            imagePurpose: "doctors" as const,
          },
        ]
      : []),
  ];
  if (!allowed) return <p className="erp-alert">Энэ хэсэгт хандах эрхгүй.</p>;
  return (
    <div className="profile-page">
      <div className="workspace-heading">
        <div>
          <p className="erp-kicker">МИНИЙ АЖЛЫН ОРЧИН</p>
          <h1>Миний профайл</h1>
          <p>Холбоо барих мэдээлэл, өөрийн танилцуулгаа шинэчлээрэй.</p>
        </div>
      </div>
      {loadError && <Feedback retry={retry}>{loadError}</Feedback>}
      {error && (
        <p className="erp-alert" role="alert">
          {error}
        </p>
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
        profile && (
          <div className="profile-layout">
            <aside className="erp-panel profile-summary">
              <span className="profile-avatar">
                <UserAvatar
                  imageUrl={profile.doctor?.imageUrl}
                  name={profile.name || actor.name}
                  size={76}
                  fallback={<UserRound size={36} />}
                />
              </span>
              <h2>{profile.name}</h2>
              <span className="profile-role">
                <ShieldCheck size={15} />
                {roleNames[actor.role]}
              </span>
              <p>{profile.phone}</p>
              <p>{profile.email || "Имэйл оруулаагүй"}</p>
              <div
                className="profile-telegram-actions"
                aria-busy={telegramBusy}
              >
                {telegramBusy && (
                  <p role="status">Telegram хүсэлт илгээж байна…</p>
                )}
                <button
                  className="erp-secondary"
                  disabled={telegramBusy}
                  onClick={() => telegram("link")}
                >
                  <Link2 size={16} />
                  Telegram холбох
                </button>
                <button
                  className="erp-secondary"
                  disabled={telegramBusy}
                  onClick={() => telegram("test")}
                >
                  <Send size={16} />
                  Холболт шалгах
                </button>
                {telegramLink && (
                  <p>
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noreferrer"
                      className="erp-secondary"
                    >
                      Bot нээж Start дарах
                    </a>
                    <small>Холбоос 15 минут хүчинтэй.</small>
                  </p>
                )}
              </div>
              {actor.role === "DOCTOR" && (
                <small>
                  Профайлд оруулсан нэр, мэргэжил, зураг, танилцуулга
                  үйлчлүүлэгчид харагдана.
                </small>
              )}
            </aside>
            <section className="erp-panel profile-form">
              <h2>Хувийн мэдээлэл</h2>
              <EntityForm
                key={JSON.stringify(profile)}
                fields={fields}
                initial={{
                  ...profile,
                  email: profile.email || "",
                  specialty: profile.doctor?.specialty || "Шүдний эмч",
                  bio: profile.doctor?.bio || "",
                  imageUrl: profile.doctor?.imageUrl || "",
                }}
                onCancel={() => router.push("/erp")}
                submitLabel="Профайл хадгалах"
                onSubmit={async (data) => {
                  setMessage("");
                  const result = await api<Entity>(
                    "/api/profile",
                    "PATCH",
                    data,
                  );
                  setProfile(result);
                  setMessage("Профайл шинэчлэгдлээ.");
                  router.refresh();
                }}
              />
            </section>
          </div>
        )
      )}
    </div>
  );
}
