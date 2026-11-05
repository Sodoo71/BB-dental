import { ErpWorkspace } from "../workspace";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const module = section?.[0] || "dashboard";
  if (
    (section && section.length > 1) ||
    ![
      "dashboard",
      "profile",
      "appointments",
      "calendar",
      "patients",
      "treatments",
      "services",
      "doctors",
      "schedules",
      "leaves",
      "payments",
      "expenses",
      "inventory",
      "documents",
      "reports",
      "users",
      "settings",
      "audit",
    ].includes(module)
  )
    notFound();
  return <ErpWorkspace module={module} />;
}
