import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth";
import { apiError } from "@/lib/security/http";
export async function POST() {
  try {
    await revokeCurrentSession();
    const response = NextResponse.json({ success: true });
    response.cookies.set("smilecare_session", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return response;
  } catch (error) { return apiError(error); }
}
