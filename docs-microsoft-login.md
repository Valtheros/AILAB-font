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
- AILAB trusts PSU as its managed identity authority: a validated token from the
  configured PSU tenant, a PSU home identity provider, a valid `psu.ac.th` or
  `*.psu.ac.th` email, and no guest account claim give `emailVerified=true`.
  This is an explicit organization SSO trust policy, not a claim that every
  Microsoft email is mailbox-verified. Token validation runs before this policy.
  Microsoft's missing `idp` means use `iss`; explicit external IdPs and guest
  claims are not auto-verified. Guests/external addresses retain mailbox
  verification. Do not use a different organization's tenant for this PSU policy.
- New trusted PSU users receive no verification email and immediately pass the
  existing API/Label Studio/storage verification gates. Returning linked PSU
  users with a matching email are upgraded without changing their local ID or
  role. Password registration still requires mailbox verification, including PSU
  addresses; an unlinked password account is never claimed by matching email.
- Existing members sign in with their original method, open Account and link a
  Microsoft identity with the same email. The server requires a verified local
  session to begin linking. AILAB also checks that the same verified, non-banned
  user's session is still active at the callback before allowing the link.
  Linking preserves the local user ID, role, email verification and owned resources.
- While Microsoft is enabled, all OAuth providers use explicit linking instead
  of email-based implicit merging. Microsoft is trusted only within that policy
  so a verified, authenticated member can explicitly link its Entra
  identity; different emails still cannot link. No `trustedProviders` shortcut
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
They verify PSU provisioning without email, returning-account upgrades, guest and
password mailbox confirmation, stable identity, explicit linking,
ownership, bad tokens/state, cancellation, bans, OTP password setup and unlinking.
The integration fixture disables rate limiting so it can test many auth attempts
in one second, but explicitly enables origin/CSRF checks that Better Auth normally
skips in test mode. Production rate limiting remains enabled. No real tenant keys are
used. Actual PSU consent, MFA and Conditional Access must be verified after setup.

Deployment and activation: deployment repository `deploy/PSU_LOGIN.md`.

## Password Screens

The 2026-11-17 password-screen update changes presentation and navigation only.
The Better Auth configuration, password-change/reset endpoints, OTP verification,
session revocation and Microsoft unlink rules remain unchanged.

- Microsoft-only users open **Set an AILAB password** at `/account/password`.
  The screen displays their current account email read-only, hides the unrelated
  switch-email action and explains that an AILAB password does not change the
  PSU/Microsoft password or automatically unlink Microsoft. This uses the existing
  mailbox-OTP flow; it is not a new authentication API or a new identity.
- Signed-in visits to `/forgot-password` navigate to that setup screen only if
  there is no local password yet. Accounts with a password return to `/account`
  and its existing current-password form. Signed-out visitors retain the existing
  recovery screen with an editable recipient email.
- Users who already have a local password retain the existing **Change Password**
  form requiring their current password. The mailbox-recovery flow is separate.
- The OTP control is one accessible input with six visible slots, numeric input,
  paste/autofill support and no misleading prefilled-looking zeroes. It does not
  call the disabled OTP-precheck endpoint; final verification still happens when
  saving the password. Thai/English labels and notices follow the site language.
- Successful setup/reset still revokes sessions under the existing policy. The
  completion screen explains re-sign-in and that unlinking is a separate action.

Tests: `password-reset-flow`, `password-pages` and `microsoft-login-ui`; the existing
real-handler `microsoft-oauth-integration` also covers password setup before unlink.

## Unicode Profiles

Microsoft display names can contain Thai or other Unicode characters. Do not put
them in plain HTTP headers: the Fetch Headers API rejects characters outside a
ByteString. The backend proxy forwards only the authenticated user ID/email and
the internal token. The unused `x-user-name` header was removed; backend ownership
continues to be resolved from the database. `tests/backend-proxy.test.tsx` covers
Thai/emoji names, spoofed identity headers and missing/unverified sessions.

## Account Deletion

Microsoft-only users follow the same Admin removal lifecycle as password users.
Opening Account can allocate a `storage_accounts` row even when the user has no
datasets, training runs or Label Studio account. Its restrictive foreign key is
intentional: never delete that row or bypass the storage operator to make user
deletion succeed. Both Admin Remove and Delete account and data disable the
account, revoke sessions, call the existing backend cleanup (including storage
retirement), and only then delete the auth user. Auth accounts/sessions cascade.
The simple Remove action still rejects linked workspace data before any cleanup;
that data requires the explicit resource-impact dialog. Backend cleanup failures
retain the disabled user and credentials for retry. A successful HTTP status alone
is insufficient: cleanup must return JSON with `status: "success"` before the
auth account is removed. Connection/invalid-response errors and backend reasons
are visible inside the confirmation dialog, not hidden behind it. Removing the AILAB user does
not delete or disable the organization's Microsoft/PSU identity. Tests cover
storage-only accounts, cleanup failure/retry, self-deletion and admin-only access.
