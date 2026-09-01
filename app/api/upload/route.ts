import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { requireSessionUser } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Нэвтрэх шаардлагатай." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Хуулах зураг олдсонгүй." },
        { status: 400 },
      );
    }

    const mimeType = file.type;
    const nameLower = file.name.toLowerCase();
    const isImage =
      mimeType.startsWith("image/") ||
      nameLower.endsWith(".heic") ||
      nameLower.endsWith(".heif") ||
      nameLower.endsWith(".jpg") ||
      nameLower.endsWith(".jpeg") ||
      nameLower.endsWith(".png") ||
      nameLower.endsWith(".webp") ||
      nameLower.endsWith(".svg");

    if (!isImage) {
      return NextResponse.json(
        { error: "Зөвхөн зургийн файл (JPG, PNG, WEBP, HEIC г.м) оруулна уу." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Try Cloudinary Cloud Upload if configured
    if (process.env.CLOUDINARY_URL) {
      try {
        const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
          (resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: "bb-dental",
                resource_type: "auto",
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result as any);
              },
            );
            uploadStream.end(buffer);
          },
        );

        if (uploadResult?.secure_url) {
          return NextResponse.json({
            success: true,
            url: uploadResult.secure_url,
            fileName: uploadResult.public_id,
            provider: "cloudinary",
          });
        }
      } catch (cloudErr) {
        console.warn("Cloudinary upload failed, using local storage fallback:", cloudErr);
      }
    }

    // 2. Local Storage Fallback
    const extension = path.extname(file.name) || ".jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadDir, safeName);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${safeName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: safeName,
      provider: "local",
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: "Зураг байршуулахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
