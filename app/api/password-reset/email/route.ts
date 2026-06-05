import { type NextRequest, NextResponse } from "next/server";
import { authUserExistsByEmail } from "@/lib/auth-database";
import { forgotPasswordRequestSchema } from "@/lib/auth-validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    {
      detail: "Too many reset checks. Please wait a minute and try again.",
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

export async function POST(request: NextRequest) {
  const ipLimit = checkRateLimit({
    key: `password-reset-email:ip:${clientIp(request)}`,
    max: 10,
    windowMs: 60_000,
  });
  if (ipLimit.limited) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  const body = await request.json().catch(() => null);
  const result = forgotPasswordRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { detail: result.error.issues[0]?.message ?? "Invalid email." },
      { status: 400 }
    );
  }

  const emailLimit = checkRateLimit({
    key: `password-reset-email:email:${result.data.email.toLowerCase()}`,
    max: 5,
    windowMs: 60_000,
  });
  if (emailLimit.limited) {
    return rateLimitResponse(emailLimit.retryAfter);
  }

  const exists = await authUserExistsByEmail(result.data.email);

  return NextResponse.json({ exists });
}
