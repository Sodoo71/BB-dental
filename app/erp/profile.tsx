"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, ShieldCheck, Check } from "lucide-react";
import { useUser } from "./shell";
import { api, EntityForm, type Entity, type Field } from "./ui";
import { roleNames } from "@/lib/domain";
import BrandLoader from "../components/brand-loader";
export default function Profile() {
  const actor = useUser(),
    router = useRouter();
  const [profile, setProfile] = useState<Entity | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const allowed = actor.role === "ADMIN" || actor.role === "DOCTOR";
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    api<Entity>("/api/profile")
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [allowed]);
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
      {!profile && !error ? (
        <BrandLoader />
      ) : (
        profile && (
          <div className="profile-layout">
            <aside className="erp-panel profile-summary">
              <span className="profile-avatar">
                <UserRound size={36} />
              </span>
              <h2>{profile.name}</h2>
              <span className="profile-role">
                <ShieldCheck size={15} />
                {roleNames[actor.role]}
              </span>
              <p>{profile.phone}</p>
              <p>{profile.email || "Имэйл оруулаагүй"}</p>
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
