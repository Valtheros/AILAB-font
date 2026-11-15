import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { authHref } from "@/lib/auth-redirect";

const protectedRoutes = ["/dashboard", "/dataset", "/tasks", "/annotate", "/admin", "/config", "/training", "/results", "/account"];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (isProtectedPath(pathname) && !hasSessionCookie) {
    return NextResponse.redirect(new URL(authHref("login", `${pathname}${search}`), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/annotate/:path*", "/dashboard/:path*", "/dataset/:path*", "/tasks/:path*", "/admin/:path*", "/config/:path*", "/training/:path*", "/results/:path*", "/account/:path*"],
};
