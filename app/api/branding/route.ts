import { connection } from "next/server";
import { databaseConfigured, db } from "@/lib/db";
import { isCloudinaryImage } from "@/lib/cloudinary";
import { json, safe } from "@/lib/http";

export async function GET() {
  return safe(async () => {
    await connection();
    const settings = databaseConfigured()
      ? await db.setting.findMany({
          where: { key: { in: ["logoUrl", "clinicName", "phone", "address"] } },
        })
      : [];
    const values = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return json({
      name: values.clinicName || "BB Dental Clinic",
      phone: values.phone || "+976 9596-3531",
      address: values.address || "",
      logoUrl:
        values.logoUrl && isCloudinaryImage(values.logoUrl)
          ? values.logoUrl
          : "/images/default-logo.png",
    });
  });
}
