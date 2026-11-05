import { requireUser, rateLimit, audit } from "@/lib/auth";
import { ApiError, json, safe, sameOrigin } from "@/lib/http";
import { MAX_IMAGE_BYTES, uploadImage } from "@/lib/cloudinary";
export async function POST(req: Request) {
  return safe(async () => {
    sameOrigin(req);
    const user = await requireUser(["ADMIN", "DOCTOR"]);
    await rateLimit(`image-upload:${user.id}`, 30, 3600);
    const limit = MAX_IMAGE_BYTES + 65536;
    if (Number(req.headers.get("content-length") || 0) > limit)
      throw new ApiError(413, "Зургийн хэмжээ 5 MB-аас хэтрэхгүй байна.");
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new ApiError(400, "Зургийн файл сонгоно уу.");
    const reader = req.body?.getReader();
    if (!reader) throw new ApiError(400, "Файл шаардлагатай.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(413, "Зургийн хэмжээ 5 MB-аас хэтрэхгүй байна.");
      }
      chunks.push(value);
    }
    let data: FormData;
    try {
      data = await new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": req.headers.get("content-type")! },
      }).formData();
    } catch {
      throw new ApiError(400, "Файлын хүсэлт буруу байна.");
    }
    const file = data.get("file"),
      purpose = data.get("purpose");
    if (
      !(file instanceof File) ||
      !["doctors", "services", "logo"].includes(String(purpose))
    )
      throw new ApiError(400, "Зураг болон зориулалтыг сонгоно уу.");
    if (user.role === "DOCTOR" && (purpose !== "doctors" || !user.doctor))
      throw new ApiError(403, "Зөвхөн өөрийн эмчийн профайлын зураг оруулна.");
    const result = await uploadImage(
      new Uint8Array(await file.arrayBuffer()),
      purpose as "doctors" | "services" | "logo",
    );
    await audit(user, "UPLOAD", "images", result.publicId);
    return json(result, 201);
  });
}
