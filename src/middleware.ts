import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session-token";

const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.next();
  }
  const secret = process.env.MC_AUTH_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = secret ? await verifySessionToken(token || "", secret) : null;

  if (path === "/login") {
    return valid
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }
  if (!valid && path.startsWith("/api/mc/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!valid) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
