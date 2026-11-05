import { Prisma } from "@/app/generated/prisma/client";
import { ZodError } from "zod";
import { databaseConfigured } from "./db";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function ensureDatabase() {
  if (!databaseConfigured())
    throw new ApiError(
      503,
      "Supabase өгөгдлийн сангийн холболт тохируулаагүй байна.",
    );
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    !origin ||
    ![new URL(req.url).origin, process.env.APP_URL]
      .filter(Boolean)
      .includes(origin)
  )
    throw new ApiError(403, "Хүсэлтийн эх үүсвэр зөвшөөрөгдөөгүй.");
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 250_000)
    throw new ApiError(413, "Хүсэлт хэт том байна.");
  const text = await req.text();
  if (text.length > 250_000) throw new ApiError(413, "Хүсэлт хэт том байна.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "JSON хүсэлт буруу байна.");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function safe(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json(
        { error: error.issues[0]?.message || "Мэдээлэл буруу байна." },
        400,
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return json({ error: "Давхардсан бүртгэл байна." }, 409);
      if (error.code === "P2025")
        return json({ error: "Бүртгэл олдсонгүй." }, 404);
      if (error.code === "P2003")
        return json(
          { error: "Холбоотой бүртгэл байгаа тул устгах боломжгүй." },
          409,
        );
      if (error.code === "P2034")
        return json(
          { error: "Зэрэгцээ өөрчлөлт орлоо. Дахин оролдоно уу." },
          409,
        );
    }
    console.error(
      "ERP request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        error:
          "Үйлдлийг гүйцэтгэж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.",
      },
      500,
    );
  }
}
