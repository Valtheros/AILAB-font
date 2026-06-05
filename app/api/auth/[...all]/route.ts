import { auth } from "@/lib/auth";
import { authUserExistsByEmail } from "@/lib/auth-database";
import { authEmailSchema } from "@/lib/auth-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function authErrorResponse({
  code,
  message,
  status,
}: {
  code: string;
  message: string;
  status: number;
}) {
  return NextResponse.json({ code, message }, { status });
}

function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    {
      code: "SIGNUP_RATE_LIMITED",
      message: "Too many signup attempts. Please wait a minute and try again.",
      retryAfter,
    },
    {
      headers: {
        "Retry-After": String(retryAfter),
      },
      status: 429,
    }
  );
}

async function readEmailFromRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const clonedRequest = request.clone();

  if (contentType.includes("application/json")) {
    const body = (await clonedRequest.json().catch(() => null)) as {
      email?: unknown;
    } | null;
    return typeof body?.email === "string" ? body.email : undefined;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await clonedRequest.formData().catch(() => null);
    const email = formData?.get("email");
    return typeof email === "string" ? email : undefined;
  }

  return undefined;
}

async function rejectDuplicateSignupEmail(request: NextRequest) {
  const ipLimit = checkRateLimit({
    key: `signup-email:ip:${clientIp(request)}`,
    max: 10,
    windowMs: 60_000,
  });
  if (ipLimit.limited) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  const email = await readEmailFromRequest(request);
  const result = authEmailSchema.safeParse(email);

  if (!result.success) {
    return authErrorResponse({
      code: "INVALID_EMAIL",
      message: result.error.issues[0]?.message ?? "Enter a valid email address.",
      status: 400,
    });
  }

  const normalizedEmail = result.data.toLowerCase();
  const emailLimit = checkRateLimit({
    key: `signup-email:email:${normalizedEmail}`,
    max: 5,
    windowMs: 60_000,
  });
  if (emailLimit.limited) {
    return rateLimitResponse(emailLimit.retryAfter);
  }

  if (await authUserExistsByEmail(normalizedEmail)) {
    return authErrorResponse({
      code: "EMAIL_ALREADY_EXISTS",
      message: "This email is already registered. Sign in instead.",
      status: 409,
    });
  }

  return null;
}

export function GET(request: NextRequest) {
  const url = new URL(request.url);

  if (url.pathname.endsWith("/api/auth/error")) {
    const redirectUrl = new URL("/auth-error", url.origin);
    const error = url.searchParams.get("error");
    const callbackURL = url.searchParams.get("callbackURL");

    if (error) {
      redirectUrl.searchParams.set("error", error);
    }

    if (callbackURL?.startsWith("/") && !callbackURL.startsWith("//")) {
      redirectUrl.searchParams.set("callbackURL", callbackURL);
    }

    return NextResponse.redirect(redirectUrl);
  }

  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  if (url.pathname.endsWith("/api/auth/sign-up/email")) {
    const duplicateResponse = await rejectDuplicateSignupEmail(request);
    if (duplicateResponse) {
      return duplicateResponse;
    }
  }

  return handlers.POST(request);
}

export const { PATCH, PUT, DELETE } = handlers;
