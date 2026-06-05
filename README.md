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

Email/password signup requires email verification before users can access the
workspace. Forgot password uses a six-digit email OTP; the reset form is shown
only after the OTP is verified. Form validation uses Zod and shows field-level
errors under each input.

Google login is optional. Leave `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` until a
Google OAuth client ID and secret are configured.

## Backend Flow

Authenticated pages call:

```text
/api/backend/*
```

The Next.js proxy validates the Better Auth session, rejects unverified email
sessions, and forwards trusted user headers to FastAPI. Direct browser calls to
FastAPI should be used only for local debugging.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

On Windows PowerShell, use `npm.cmd` to avoid execution policy issues with
`npm.ps1`.
