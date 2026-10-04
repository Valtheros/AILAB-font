import { headers } from "next/headers";
import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const forwardedRequestHeaders = [
  "accept",
  "accept-language",
  "content-type",
  "range",
  "idempotency-key",
];

const blockedResponseHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

function backendBaseUrl() {
  const value =
    process.env.BACKEND_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";
  return value.startsWith("/") ? "http://localhost:8000" : value.replace(/\/$/, "");
}

function buildBackendRequestHeaders(request: NextRequest, session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>) {
  const requestHeaders = new Headers();

  for (const header of forwardedRequestHeaders) {
    const value = request.headers.get(header);
    if (value) {
      requestHeaders.set(header, value);
    }
  }

  requestHeaders.set("x-user-id", session.user.id);
  requestHeaders.set("x-user-email", session.user.email);
  requestHeaders.set("x-user-name", session.user.name ?? "");
  if (process.env.BACKEND_INTERNAL_TOKEN) {
    requestHeaders.set("x-internal-token", process.env.BACKEND_INTERNAL_TOKEN);
  }

  return requestHeaders;
}

async function proxyBackend(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
  if (!session.user.emailVerified) {
    return Response.json(
      { detail: "Email verification required" },
      { status: 403 }
    );
  }

  const params = await context.params;
  const path = `/${(params.path ?? []).map(encodeURIComponent).join("/")}`;
  const target = new URL(path, backendBaseUrl());
  target.search = request.nextUrl.search;

  const upstream = await fetch(target, {
    method: request.method,
    headers: buildBackendRequestHeaders(request, session),
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    cache: "no-store",
    duplex: "half",
  } as RequestInit & { duplex?: "half" });

  const responseHeaders = new Headers(upstream.headers);
  for (const header of blockedResponseHeaders) {
    responseHeaders.delete(header);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyBackend;
export const POST = proxyBackend;
export const PUT = proxyBackend;
export const PATCH = proxyBackend;
export const DELETE = proxyBackend;
