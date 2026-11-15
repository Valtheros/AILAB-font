"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [adminClient(), emailOTPClient()],
});

export async function signOutToHome() {
  const result = await authClient.signOut();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard authenticated route caches and pending AuthGate redirects.
  if (!result.error) window.location.assign("/");
  return result;
}
