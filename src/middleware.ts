import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session-token";
import { verifyMiddlewareSession } from "@/lib/auth/middleware-session";

const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.next();
  }
  const secret = process.env.MC_AUTH_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = secret
    ? await verifySessionToken(token || "", secret)
    : null;
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const valid =
    payload && supabaseUrl && serviceRoleKey
      ? await verifyMiddlewareSession(payload, {
          supabaseUrl,
          serviceRoleKey,
        })
      : false;

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
