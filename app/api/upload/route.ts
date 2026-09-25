import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { apiError, HttpError } from "@/lib/security/http";
import { detectImageMime, MAX_IMAGE_BYTES } from "@/lib/security/image";
import { rateLimit } from "@/lib/security/rate-limit";
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (!user || user.role === "PATIENT") throw new HttpError(403, "Хандах эрхгүй байна.");
    await rateLimit("profile-upload", user.id, 30);
    const size = Number(request.headers.get("content-length"));
    if (size > MAX_IMAGE_BYTES + 65536) throw new HttpError(413, "Файлын хэмжээ хэтэрсэн байна.");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Зургийн файл сонгоно уу.");
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, "Файлын хэмжээ 8 MB-аас их байна.");
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectImageMime(buffer);
    if (!mime || (file.type && file.type !== mime)) throw new HttpError(400, "Зөвхөн JPG, PNG, WEBP зураг оруулна уу.");
    // Public profile/service images only. Medical assets require a separate private delivery workflow.
    const url = await uploadToCloudinary(buffer, mime, "bb-dental/profiles");
    await (await import("@/lib/prisma")).prisma.auditLog.create({ data: { actorId: user.id, action: "PROFILE_IMAGE_UPLOADED", entity: "User", entityId: user.id } });
    return NextResponse.json({ success: true, url, provider: "cloudinary" });
  } catch (error) { return apiError(error); }
}
