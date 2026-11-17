# PSU Microsoft Login

Microsoft Entra ID (Azure AD) is an additional login method through the existing
Better Auth 1.7 provider. No MSAL service, auth database replacement or schema
migration is required. Password login and existing user IDs remain available.

## Configuration

Server-only environment variables:

```dotenv
MICROSOFT_AUTH_ENABLED=false
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
```

Enable only after supplying all three credentials. Client/tenant IDs must be
GUIDs. The tenant must be the organization's specific workforce tenant; `common`,
`organizations`, personal Microsoft accounts and domain-name authorities are
rejected. An enabled, incomplete configuration fails startup rather than opening
authentication to an unintended tenant. The disabled configuration needs no keys.

Login/Signup receive only an enabled boolean from the server at request time.
Neither credentials nor a `NEXT_PUBLIC_*` auth flag are sent to the browser.
Changing configuration requires a frontend restart, not a new build for the flag.

Register the Web callback exactly as:
`https://ai-lab.cs.psu.ac.th/api/auth/callback/microsoft`.
Use an ID-token `email` optional claim for managed accounts. There is no fallback
from email to a username/UPN or a fabricated mailbox. Only `openid profile email`
is requested; Graph profile photos and offline refresh access are not requested.

## Account And Identity Contract

- Better Auth manages state and PKCE S256. Before
  decoding callback profile data, `getUserInfo` uses Better Auth's `validateToken`
  utility to verify the Microsoft JWKS signature, issuer, audience, expiry and
  required identity claims. The provider binds accounts by Entra `oid`.
  Admission also enforces the configured `tid` on create, link and returning login.
- Entra's email claim is not mailbox verification. Newly provisioned Microsoft
  users remain `emailVerified=false` until they follow AILAB's verification email
  or complete its mailbox OTP password setup. Existing API/Label Studio/storage
  gates keep requiring verification. No blanket verified/admin assignment exists.
- Existing members sign in with their original method, open Account and link a
  Microsoft identity with the same email. The server requires a verified local
  session to begin linking. AILAB also checks that the same verified, non-banned
  user's session is still active at the callback before allowing the link.
  Linking preserves the local user ID, role, email verification and owned resources.
- While Microsoft is enabled, all OAuth providers use explicit linking instead
  of email-based implicit merging. Microsoft is trusted only within that policy
  so a verified, authenticated member can explicitly link its unverified Entra
  email claim; different emails still cannot link. No `trustedProviders` shortcut
  may be added without keeping `disableImplicitLinking=true`.
- The Account page fetches only its session user's account IDs, provider IDs and
  password-presence booleans. Tokens, password hashes and secrets are not serialized.
  Microsoft-only members do not see Change Password with an impossible old password.
  They can set a local password using the existing mailbox OTP reset flow.
- Unlinking requires confirmation and is offered only when a local password exists.
  Better Auth verifies ownership of the account row ID and rejects removing the
  last sign-in method server-side. Existing AILAB sessions are not an Entra global
  logout or continuous directory synchronization; AILAB bans/revocation still apply.
- The provider account is a normal Better Auth `account` record under the existing
  user. No new dataset, quota identity, Model App owner or Label Studio account is
  created by linking. Existing account cleanup applies; resource transfer does not
  transfer credentials between users.

## Verification

Tests cover configuration, UI and the real Better Auth handler against an isolated
memory adapter with RSA-signed fixture ID tokens and intercepted Microsoft endpoints.
They verify provisioning/mailbox confirmation, stable identity, explicit linking,
ownership, bad tokens/state, cancellation, bans, OTP password setup and unlinking.
The integration fixture disables rate limiting so it can test many auth attempts
in one second, but explicitly enables origin/CSRF checks that Better Auth normally
skips in test mode. Production rate limiting remains enabled. No real tenant keys are
used. Actual PSU consent, MFA and Conditional Access must be verified after setup.

Deployment and activation: deployment repository `deploy/PSU_LOGIN.md`.
