import { NextResponse, type NextRequest } from "next/server";

import { isSameOriginMutation } from "@/lib/security/origin";

const protectedRoutes = ["/doctor", "/admin", "/super-admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Telegram webhook and cron authenticate separately; browser mutation routes require Origin.
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Application origin is not configured." }, { status: 503 });
  }
  const machineRoute = pathname === "/api/telegram/webhook";
  if (pathname.startsWith("/api/") && !machineRoute && !isSameOriginMutation(request.method, request.headers.get("origin"), process.env.APP_URL || request.url, request.headers.get("sec-fetch-site"))) {
    return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const session = request.cookies.get("smilecare_session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
