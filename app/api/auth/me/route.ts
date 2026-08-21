import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/auth";

export async function GET() {
  const user = await sessionUser();
  if (!user)
    return NextResponse.json(
      { error: "Нэвтрэх шаардлагатай." },
      { status: 401 },
    );
  return NextResponse.json({ success: true, data: user });
}
