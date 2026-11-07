import { ErpWorkspace } from "../workspace";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const sectionName = section?.[0] || "dashboard";
  if (
    (section && section.length > 1) ||
    ![
      "dashboard",
      "visits",
      "queue",
      "transactions",
      "receivables",
      "notifications",
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
    ].includes(sectionName)
  )
    notFound();
  return <ErpWorkspace />;
}
