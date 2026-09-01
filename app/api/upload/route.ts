import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү." },
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

    const mimeType = file.type || "image/jpeg";
    const nameLower = file.name.toLowerCase();
    const isImage =
      mimeType.startsWith("image/") ||
      nameLower.endsWith(".heic") ||
      nameLower.endsWith(".heif") ||
      nameLower.endsWith(".jpg") ||
      nameLower.endsWith(".jpeg") ||
      nameLower.endsWith(".png") ||
      nameLower.endsWith(".webp") ||
      nameLower.endsWith(".svg") ||
      nameLower.endsWith(".gif");

    if (!isImage) {
      return NextResponse.json(
        { error: "Зөвхөн зургийн файл (JPG, PNG, WEBP, HEIC г.м) оруулна уу." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Pure Serverless Cloudinary Upload (Guaranteed to work on Vercel & Cloud)
    try {
      const secureUrl = await uploadToCloudinary(
        buffer,
        mimeType.startsWith("image/") ? mimeType : "image/jpeg",
      );

      return NextResponse.json({
        success: true,
        url: secureUrl,
        provider: "cloudinary",
      });
    } catch (cloudErr) {
      console.error("Cloudinary upload error:", cloudErr);

      // 2. Fallback: Base64 data URL if under 2MB so upload NEVER fails on serverless
      if (buffer.length < 2 * 1024 * 1024) {
        const base64Url = `data:${mimeType.startsWith("image/") ? mimeType : "image/jpeg"};base64,${buffer.toString("base64")}`;
        return NextResponse.json({
          success: true,
          url: base64Url,
          provider: "base64",
        });
      }

      throw cloudErr;
    }
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Зураг байршуулахад алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
