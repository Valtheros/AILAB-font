import { z } from "zod";

function passwordSchema(label: string) {
  return z
    .string()
    .min(1, `${label} is required.`)
    .min(8, `${label} must be at least 8 characters.`)
    .max(128, `${label} must be 128 characters or fewer.`);
}

export const authPasswordSchema = passwordSchema("Password");
export const currentPasswordSchema = passwordSchema("Current password");
export const newPasswordSchema = passwordSchema("New password");

export const authNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .min(2, "Name must be at least 2 characters.")
  .max(80, "Name must be 80 characters or fewer.");

export const authEmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

export const loginSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
});

export const signupSchema = loginSchema.extend({
  name: authNameSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
    revokeOtherSessions: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      value.newPassword &&
      value.currentPassword &&
      value.newPassword === value.currentPassword
    ) {
      ctx.addIssue({
        code: "custom",
        message: "New password must be different from the current password.",
        path: ["newPassword"],
      });
    }

    if (
      value.newPassword &&
      value.confirmPassword &&
      value.newPassword !== value.confirmPassword
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

export const otpCodeSchema = z
  .string()
  .trim()
  .min(1, "Verification code is required.")
  .regex(/^\d{6}$/, "Enter the 6-digit code.");

export const forgotPasswordRequestSchema = z.object({
  email: authEmailSchema,
});

export const forgotPasswordOtpSchema = z.object({
  email: authEmailSchema,
  otp: otpCodeSchema,
});

export const forgotPasswordNewPasswordSchema = z
  .object({
    email: authEmailSchema,
    otp: otpCodeSchema,
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .superRefine((value, ctx) => {
    if (
      value.newPassword &&
      value.confirmPassword &&
      value.newPassword !== value.confirmPassword
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

export const forgotPasswordResetSchema = z
  .object({
    email: authEmailSchema,
    otp: otpCodeSchema,
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .superRefine((value, ctx) => {
    if (
      value.newPassword &&
      value.confirmPassword &&
      value.newPassword !== value.confirmPassword
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordRequestValues = z.infer<
  typeof forgotPasswordRequestSchema
>;
export type ForgotPasswordOtpValues = z.infer<typeof forgotPasswordOtpSchema>;
export type ForgotPasswordNewPasswordValues = z.infer<
  typeof forgotPasswordNewPasswordSchema
>;
export type ForgotPasswordResetValues = z.infer<
  typeof forgotPasswordResetSchema
>;

export function zodFieldErrors<TField extends string>(
  error: z.ZodError
): Partial<Record<TField, string>> {
  const fieldErrors: Partial<Record<TField, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") {
      continue;
    }

    const key = field as TField;
    fieldErrors[key] ??= issue.message;
  }

  return fieldErrors;
}
