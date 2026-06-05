import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/dataset", "/config", "/training", "/results", "/account"];
const authRoutes = ["/login", "/signup"];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAuthPath(pathname: string) {
  return authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (isProtectedPath(pathname) && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackURL", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (isAuthPath(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/dataset/:path*", "/config/:path*", "/training/:path*", "/results/:path*", "/account/:path*", "/login", "/signup"],
};
