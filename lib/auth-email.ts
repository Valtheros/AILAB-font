import nodemailer from "nodemailer";

type AuthEmail = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

type OtpEmailType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

const appName = "AILAB";

function optionalEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const smtpHost = optionalEnv(process.env.SMTP_HOST);
const smtpPort = Number(optionalEnv(process.env.SMTP_PORT) ?? "587");
const smtpSecureSetting = optionalEnv(process.env.SMTP_SECURE);
const smtpSecure =
  smtpSecureSetting === undefined
    ? smtpPort === 465
    : smtpSecureSetting === "true";
const smtpUser = optionalEnv(process.env.SMTP_USER);
const smtpPassword = optionalEnv(process.env.SMTP_PASSWORD);
const authEmailFrom =
  optionalEnv(process.env.AUTH_EMAIL_FROM) ??
  (smtpUser ? `${appName} <${smtpUser}>` : `${appName} <auth@example.com>`);
const hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPassword);
const shouldLogAuthEmails =
  process.env.AUTH_EMAIL_LOG_LINKS === "true" ||
  (process.env.NODE_ENV !== "production" && !hasSmtpConfig);
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

export function assertAuthEmailDeliveryConfigured() {
  if (process.env.NODE_ENV === "production" && !isProductionBuild && !hasSmtpConfig) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set in production because email verification is required."
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendViaSmtp(email: AuthEmail) {
  if (!hasSmtpConfig) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transporter.sendMail({
    from: authEmailFrom,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

async function sendAuthEmail(email: AuthEmail) {
  if (shouldLogAuthEmails) {
    console.info(
      [
        "[auth-email] Development email delivery",
        `To: ${email.to}`,
        `Subject: ${email.subject}`,
        email.text,
      ].join("\n")
    );
  }

  if (!hasSmtpConfig) {
    return;
  }

  try {
    await sendViaSmtp(email);
  } catch (error) {
    if (!shouldLogAuthEmails) {
      throw error;
    }

    console.error("[auth-email] SMTP delivery failed; using logged link fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendEmailVerificationLink({
  name,
  to,
  url,
}: {
  name?: string | null;
  to: string;
  url: string;
}) {
  const safeName = escapeHtml(name?.trim() || "there");
  const safeUrl = escapeHtml(url);
  const subject = `Verify your ${appName} email`;
  const text = [
    `Hi ${name?.trim() || "there"},`,
    "",
    `Verify your email address to finish creating your ${appName} account:`,
    url,
    "",
    "If you did not request this account, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Hi ${safeName},</p>
      <p>Verify your email address to finish creating your ${appName} account.</p>
      <p>
        <a href="${safeUrl}" style="display:inline-block;border-radius:6px;background:#111827;color:#ffffff;padding:10px 16px;text-decoration:none">
          Verify email
        </a>
      </p>
      <p>If the button does not work, paste this link into your browser:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>If you did not request this account, you can ignore this email.</p>
    </div>
  `;

  await sendAuthEmail({ html, subject, text, to });
}

function otpEmailCopy(type: OtpEmailType) {
  if (type === "forget-password") {
    return {
      action: "reset your password",
      subject: `Reset your ${appName} password`,
      warning: "If you did not request a password reset, you can ignore this email.",
    };
  }

  if (type === "change-email") {
    return {
      action: "confirm your new email address",
      subject: `Confirm your ${appName} email change`,
      warning: "If you did not request this email change, you can ignore this email.",
    };
  }

  if (type === "sign-in") {
    return {
      action: "sign in",
      subject: `Your ${appName} sign-in code`,
      warning: "If you did not try to sign in, you can ignore this email.",
    };
  }

  return {
    action: "verify your email address",
    subject: `Verify your ${appName} email`,
    warning: "If you did not request this code, you can ignore this email.",
  };
}

export async function sendOtpEmail({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: OtpEmailType;
}) {
  const { action, subject, warning } = otpEmailCopy(type);
  const safeOtp = escapeHtml(otp);
  const text = [
    `Use this code to ${action} in ${appName}:`,
    "",
    otp,
    "",
    "This code expires in 5 minutes.",
    warning,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Use this code to ${action} in ${appName}:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${safeOtp}</p>
      <p>This code expires in 5 minutes.</p>
      <p>${escapeHtml(warning)}</p>
    </div>
  `;

  await sendAuthEmail({ html, subject, text, to: email });
}
