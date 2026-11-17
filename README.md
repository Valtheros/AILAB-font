# AILAB Frontend

Next.js frontend for AILAB, a no-code Computer Vision training platform. The UI
helps users upload datasets, configure models, start training, monitor progress,
and download artifacts from the FastAPI backend.

## What It Does

- Sign up, verify email, log in, and manage account password.
- Upload datasets and view backend-detected formats.
- Configure task, model, dataset, and training parameters.
- Submit jobs through the authenticated backend proxy.
- Monitor logs, metrics, and status through Server-Sent Events.
- Browse previous runs and download result files.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Radix UI primitives
- Zustand for draft training configuration
- Better Auth with PostgreSQL
- Nodemailer SMTP for verification and OTP emails

## Run Locally

Install dependencies:

```powershell
npm.cmd install
```

Copy `.env.example`, fill the values you have, then run the Better Auth
migration after PostgreSQL is available:

```powershell
npm.cmd run auth:migrate
```

Start the dev server:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`.

## Environment

Common local values:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_API_PROXY=true
BACKEND_INTERNAL_URL=http://localhost:8000
BACKEND_INTERNAL_TOKEN=

BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
TRUSTED_PROXY_IPS=
DATABASE_URL=postgresql://ailab:ailab_dev_password@localhost:5432/ailab

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASSWORD=
AUTH_EMAIL_FROM=
AUTH_EMAIL_LOG_LINKS=true
```

For Gmail, `SMTP_USER` must be the real sending email address and
`SMTP_PASSWORD` must be a Google app password. If `AUTH_EMAIL_FROM` is empty,
emails are sent as `AILAB <SMTP_USER>`.

## Authentication

### Public Landing And Private Workspace

- `/` shows the compact landing; a validated session redirects to `/dashboard`.
  `/overview` always shows that same landing, including for signed-in members.
  The landing uses public navigation without the workspace sidebar,
  account controls or notification polling. The public header contains only
  the overview logo link and language/theme controls. The hero's Enter AILAB leads to Dashboard,
  requiring login first for guests. Guests never request private data.
- `/guide` remains publicly readable. A validated, email-verified server session
  selects `MainLayout`, retaining the workspace sidebar, account controls and
  notifications. Guests and unverified accounts get the public header instead.
  Keep this choice based on the session, not cookie presence; the guide content
  and tab query parameters are the same in both layouts.
- `/annotate`, `/dataset`, and `/tasks`, including their exact roots, require
  login. Their workspaces mount only inside `AuthGate`, after session
  and email verification. Never place private fetches or polling in the page
  component above that boundary. Changing users remounts the workspace.
- Detail routes, Dashboard, Account, Admin, and legacy training routes remain
  protected. `MainLayout` always requires authentication.
  Public pages never make the backend proxy, uploads, or training anonymous.
- Start actions require login, preserving a local callback through signup and
  verification. `lib/auth-redirect.ts` rejects external, encoded unsafe, and
  authentication-loop destinations. Keep Label Studio project/transfer query
  parameters intact; no transfer request is made before authentication.
- Login/signup redirects use a validated server session, not cookie presence.
  Sign-out fully navigates to `/` after success so cached authenticated root
  redirects cannot send the user back into AuthGate. The proxy's cookie check is only an early redirect;
  backend APIs still validate the session, verification, and ownership.
- Detailed model/format information remains in Guide, not a second landing
  catalog. `public/landing/model-workflow.png` is an AI-generated conceptual
  illustration, not user data or an AILAB prediction. Its generation prompt
  and provenance are in `docs/landing-image.md`.

Regression checks: `tests/public-access.test.tsx`, `auth-redirect.test.tsx`,
`public-entrypoints.test.tsx`, `landing-page.test.tsx`, and the mobile sidebar tests. Before deployment,
check guest navigation without private API traffic, expired cookies, member
callbacks/sign-out, Label Studio transfer callbacks, and responsive TH/EN views.

### Account Access

Email/password signup requires email verification before users can access the
workspace. Forgot password uses a six-digit email OTP; the reset form is shown
only after the OTP is verified. Form validation uses Zod and shows field-level
errors under each input.

Google login is optional. Leave `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` until a
Google OAuth client ID and secret are configured.

PSU Microsoft Entra ID login is optional and disabled by default. It uses the
existing Better Auth provider, not a separate MSAL service. See
[Microsoft login configuration and account linking](docs-microsoft-login.md)
before enabling the server-only credentials. Linking keeps existing user IDs
and resources; never enable implicit email-based merging for this integration.

Behind a reverse proxy, set `TRUSTED_PROXY_IPS` to the verified proxy IPs or
CIDRs in the forwarded chain, separated by spaces or commas. Use the same
trusted proxy boundary as Caddy; never include untrusted client networks.

When upgrading Better Auth, read its version-specific upgrade guide, check for
duplicate provider/account pairs, and test existing sessions, email verification,
OTP password reset, and admin permissions against an isolated database first.
Back up the production database before deployment; do not run `auth:migrate`
against production without reviewing the generated schema changes. Public
`NEXT_PUBLIC_*` settings are embedded when the frontend image is built.

The non-consuming email OTP check endpoint is disabled because concurrent
checks can lose failed-attempt counts in Better Auth 1.7.14. Do not call its
server API directly. Password reset verifies and consumes the code atomically
when the new password is submitted.

## Backend Flow

Authenticated pages call:

```text
/api/backend/*
```

The Next.js proxy validates the Better Auth session, rejects unverified email
sessions, and forwards trusted user headers to FastAPI. Direct browser calls to
FastAPI should be used only for local debugging.

## Training UI Contracts

- Compute availability is polled independently of the saved draft. An offline
  worker or coordinator prevents starting a run; a busy GPU can still queue.
- Basic settings are shown first; advanced settings retain their existing values
  when collapsed. Label Studio semantic datasets determine DeepLab class count
  and ignore index. CPU memory is not estimated by the GPU VRAM preview.
- Run comparison presents recorded metrics without automatic conclusions about
  model quality or overfitting. Duplicate run names include time and run ID.
- Dataset details fetch paged thumbnail summaries and load annotations only
  for the selected image. Duplicate groups compare normalized pixels across
  splits; they are not similarity detection and never move or delete images.
- New test evaluations are independent queued jobs. Their results show the
  dataset version, image counts and measured metrics without recommending a
  winning model. Older test artifacts remain separate.
- Batch prediction and evaluation results belong to the requesting user.
  Batch results expire after 24 hours; evaluation results persist until
  deleted. Notifications poll only while the page is visible.
- Model API controls may show unavailable. Do not enable public endpoints until
  the backend storage-quota guard and all deployment/security checks pass.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

On Windows PowerShell, use `npm.cmd` to avoid execution policy issues with
`npm.ps1`.
