import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Оруулсан мэдээллээ шалгана уу." }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Хүсэлтийн мэдээлэл буруу байна." }, { status: 400 });
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Энэ бүртгэл аль хэдийн байна." }, { status: 409 });
  console.error("ERP request failed", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "Хүсэлт амжилтгүй боллоо. Дахин оролдоно уу." }, { status: 500 });
}
