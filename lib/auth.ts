import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import {
  assertAuthEmailDeliveryConfigured,
  sendEmailVerificationLink,
  sendOtpEmail,
} from "@/lib/auth-email";
import { authDatabasePool } from "@/lib/auth-database";
import { getMicrosoftAuthConfig } from "@/lib/microsoft-auth";
import { authEmailSchema } from "@/lib/auth-validation";

const appUrl =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

const trustedOrigins = (
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
  `${appUrl},http://localhost:3000,http://127.0.0.1:3000`
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const secret = process.env.BETTER_AUTH_SECRET ?? "dev-only-change-me-in-production";
const trustedProxies = (process.env.TRUSTED_PROXY_IPS ?? "")
  .split(/[\s,]+/)
  .filter(Boolean);
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const microsoft = getMicrosoftAuthConfig();
export const microsoftAuthEnabled = Boolean(microsoft);

if (
  process.env.NODE_ENV === "production" &&
  !isProductionBuild &&
  secret === "dev-only-change-me-in-production"
) {
  throw new Error("BETTER_AUTH_SECRET must be set in production.");
}

assertAuthEmailDeliveryConfigured();

export const auth = betterAuth({
  baseURL: appUrl,
  advanced: { ipAddress: { trustedProxies } },
  database: authDatabasePool,
  disabledPaths: ["/email-otp/check-verification-otp"],
  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
      ...additionalFields,
      id,
    }),
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmailVerificationLink({
        name: user.name,
        to: user.email,
        url,
      });
    },
    sendOnSignIn: true,
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  plugins: [
    admin({
      adminRoles: ["admin"],
      defaultRole: "user",
    }),
    emailOTP({
      allowedAttempts: 3,
      expiresIn: 300,
      otpLength: 6,
      rateLimit: {
        max: 3,
        window: 60,
      },
      resendStrategy: "rotate",
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendOtpEmail({ email, otp, type });
      },
      storeOTP: "hashed",
    }),
  ],
  rateLimit: {
    enabled: true,
  },
  secret,
  socialProviders: {
    ...(googleClientId && googleClientSecret ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } } : {}),
    ...(microsoft ? { microsoft } : {}),
  },
  account: microsoft ? { accountLinking: {
    enabled: true,
    disableImplicitLinking: true,
    trustedProviders: ["microsoft"],
    allowDifferentEmails: false,
    updateUserInfoOnLink: false,
  } } : undefined,
  user: { validateUserInfo: async ({ user, source }, ctx) => {
    if (source.oauth?.providerId !== "microsoft") return;
    if (!microsoft || source.oauth.profile?.tid !== microsoft.tenantId) {
      return { error: "invalid_organization", errorDescription: "Use an account from the configured organization." };
    }
    if (!authEmailSchema.safeParse(user.email).success) {
      return { error: "email_not_found", errorDescription: "The organization must provide a valid email claim." };
    }
    if (source.action === "link-account") {
      const session = await getSessionFromCtx(ctx);
      if (!session?.user.emailVerified || session.user.id !== user.id || ("banned" in session.user && session.user.banned)) {
        return { error: "account_link_session_expired", errorDescription: "Sign in again before linking Microsoft." };
      }
    }
  } },
  hooks: { before: createAuthMiddleware(async ctx => {
    if (ctx.path !== "/link-social" || ctx.body?.provider !== "microsoft") return;
    const session = await getSessionFromCtx(ctx);
    if (!session?.user.emailVerified) throw new APIError("FORBIDDEN", {
      code: "EMAIL_NOT_VERIFIED", message: "Verify your AILAB email before linking Microsoft.",
    });
  }) },
  trustedOrigins,
});
