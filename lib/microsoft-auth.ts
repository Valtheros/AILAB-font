import { microsoft, type MicrosoftOptions } from "better-auth/social-providers";
import { validateToken } from "better-auth/oauth2";
import { z } from "zod";

export function isTrustedPsuProfile(profile: Record<string, unknown>, tenantId: string): boolean {
  const email = z.email().safeParse(profile.email);
  if (!email.success) return false;
  const domain = email.data.split("@")[1].toLowerCase();
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  // Microsoft defines a missing idp as the token issuer, not an external IdP.
  const idp = profile.idp === undefined ? profile.iss : profile.idp;
  return profile.tid === tenantId && profile.iss === issuer
    && (profile.acct === undefined || profile.acct === 0 || profile.acct === "0")
    && (idp === issuer || idp === `https://sts.windows.net/${tenantId}/`)
    && (domain === "psu.ac.th" || domain.endsWith(".psu.ac.th"));
}

export function getMicrosoftAuthConfig(env: Record<string, string | undefined> = process.env): MicrosoftOptions | undefined {
  if (env.MICROSOFT_AUTH_ENABLED !== "true") return undefined;
  const clientId = env.MICROSOFT_CLIENT_ID?.trim().toLowerCase();
  const clientSecret = env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenantId = env.MICROSOFT_TENANT_ID?.trim().toLowerCase();
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!clientId || !guid.test(clientId) || !clientSecret || !tenantId || !guid.test(tenantId)
      || tenantId === "9188040d-6c67-4c5b-b112-36a304b66dad") {
    throw new Error("Microsoft login requires MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and a specific organizational MICROSOFT_TENANT_ID. Leave MICROSOFT_AUTH_ENABLED=false until configured.");
  }
  const options: MicrosoftOptions = {
    clientId, clientSecret, tenantId,
    prompt: "select_account",
    disableDefaultScope: true,
    scope: ["openid", "profile", "email"],
    disableProfilePhoto: true,
    // Trust PSU's managed identity, not arbitrary Microsoft email claims.
    mapProfileToUser: profile => ({ emailVerified: isTrustedPsuProfile(profile, tenantId), image: undefined }),
  };
  const provider = microsoft(options);
  return { ...options, async getUserInfo(tokens) {
    if (!tokens.idToken) return null;
    try {
      // Verify the ID token before the provider decodes it in code callbacks.
      const claims = await validateToken(tokens.idToken, `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`, {
        audience: clientId, issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`, algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "sub", "oid", "tid"],
      });
      if (claims.payload.tid !== tenantId) return null;
      return await provider.getUserInfo(tokens);
    } catch { return null; }
  } };
}
