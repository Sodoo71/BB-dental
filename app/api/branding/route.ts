import { connection } from "next/server";
import { databaseConfigured, db } from "@/lib/db";
import { isCloudinaryImage } from "@/lib/cloudinary";
import { json, safe } from "@/lib/http";

export async function GET() {
  return safe(async () => {
    await connection();
    if (!databaseConfigured()) return json({ logoUrl: "" });
    const setting = await db.setting.findUnique({ where: { key: "logoUrl" } });
    const value = setting?.value || "";
    return json({ logoUrl: value && isCloudinaryImage(value) ? value : "" });
  });
}
