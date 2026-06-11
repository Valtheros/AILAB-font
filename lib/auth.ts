import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import {
  assertAuthEmailDeliveryConfigured,
  sendEmailVerificationLink,
  sendOtpEmail,
} from "@/lib/auth-email";
import { authDatabasePool } from "@/lib/auth-database";

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
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

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
  database: authDatabasePool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
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
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : undefined,
  trustedOrigins,
});
