# AILAB Frontend Agent Guide

## Scope

This repository is the Next.js frontend for AILAB. It owns authentication,
authorization UI, dataset/configuration workflows, training monitoring, result
downloads, and the authenticated proxy to the FastAPI backend.

The deployment repository is `/home/trainai/AILAB`. The backend is a separate
Git repository at `/home/trainai/AILAB/backend`. Run Git commands from this
directory; do not assume the parent repository tracks frontend changes.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Better Auth with PostgreSQL
- Tailwind CSS 4 and local shadcn/Radix components
- Zustand persisted training configuration
- Recharts for training metrics
- Zod for auth form validation
- English/Thai secondary-text translation in `lib/i18n.ts`

## Main Flow

1. Better Auth creates and validates the browser session.
2. Workspace pages call `/api/backend/*` by default.
3. `app/api/backend/[[...path]]/route.ts` validates the session and verified
   email, adds trusted identity headers plus `BACKEND_INTERNAL_TOKEN`, and
   forwards the request to FastAPI.
4. Dataset ZIP files are uploaded once to the staged inspect endpoint. Import
   commits the returned token; the browser must not upload the ZIP again.
5. Configuration is stored in browser localStorage by
   `lib/useTrainingConfig.ts`.
6. Training submits the current configuration to `/api/train`, then consumes
   status/log/metric updates from the backend SSE endpoint.
7. Results list user-owned runs and proxy artifact downloads.

Do not call the backend directly from browser code in production. The proxy is
the authentication boundary. `NEXT_PUBLIC_USE_API_PROXY=false` exists only for
local debugging.

## Important Files

- `app/layout.tsx`: fonts, theme/language providers, auth gate
- `app/dashboard/page.tsx`: quick actions and recent datasets/runs
- `app/dataset/page.tsx`: staged upload, import, inventory, delete, class dialog
- `app/config/page.tsx`: task/model/dataset selection and parameters
- `app/training/page.tsx`: payload review, start/stop, SSE, logs, metric charts
- `app/results/page.tsx`: run inventory, artifact download, run delete
- `app/admin/users/`: admin directory and destructive account operations
- `app/api/backend/[[...path]]/route.ts`: authenticated FastAPI proxy
- `app/api/auth/[...all]/route.ts`: Better Auth handler
- `lib/auth.ts`: server auth configuration and admin/email OTP plugins
- `lib/auth-client.ts`: browser auth client
- `lib/session.ts`: server session helper
- `lib/api.ts`: API base URL and artifact URL helpers
- `lib/useTrainingConfig.ts`: persisted configuration and manual device choice
- `lib/cvCatalog.ts`: catalog types and fallback catalog
- `lib/resourceSafety.ts`: frontend hints; backend remains authoritative
- `lib/i18n.ts`: EN/TH dictionary for secondary/detail text
- `lib/rate-limit.ts`: PostgreSQL-backed limiter with bounded memory fallback
- `components/ui/`: existing shadcn/Radix primitives; reuse these first
- `database/admin_schema.sql`: Better Auth admin plugin schema additions
- `scripts/bootstrap-admin.mjs`: idempotent admin bootstrap by email

## Authentication And Admin

- Session lifetime is one day (`expiresIn` and `updateAge` in `lib/auth.ts`).
- Email/password users must verify email before opening workspace pages.
- Password reset uses Better Auth email OTP.
- Platform admin is Better Auth `user.role = 'admin'`.
- Workspace roles are separate and must not grant platform-admin access.
- Every admin mutation must re-check admin authorization server-side.
- Destructive account removal first queries backend resource impact. Users with
  datasets/runs require the explicit cleanup flow; do not delete the auth row
  first.
- Never expose `BACKEND_INTERNAL_TOKEN`, SMTP credentials, OAuth secrets,
  `BETTER_AUTH_SECRET`, or `DATABASE_URL` to client components.

## UI And Language Rules

- Primary labels stay English: navigation, titles, buttons, form labels,
  statuses, model names, logs, metrics, and format IDs.
- Translate secondary/detail text through `useLanguage()` and `translate()`.
  Add both EN and natural Thai strings to `lib/i18n.ts`; English is fallback.
- Language persists in the `language` cookie and localStorage.
- Reuse components in `components/ui`; use `AlertDialog`/`Dialog`, never browser
  `alert()` or `confirm()` for product UI.
- Preserve mobile layouts. Tables and charts need a deliberate narrow-screen
  presentation; verify long Thai text and class names do not overflow.
- Device choice becomes manual after the user selects CPU/GPU. Do not overwrite
  it with hardware auto-detection after that point.
- Dataset cards in Configuration are directly selectable; do not add a second
  Select button.
- Training has one Stop action. Keep quality metrics (0-1) separate from loss
  metrics because they use different scales.

## Environment

Use `.env.example` as the key reference. Real env files are local-only and must
not be committed or printed. Required production values include:

- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `BACKEND_INTERNAL_URL`, `BACKEND_INTERNAL_TOKEN`
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_USE_API_PROXY`
- SMTP settings for verification/reset email

Google sign-in is optional and stays disabled unless explicitly configured.

## Commands

```bash
# Local development
npm ci
npm run dev

# Required checks
npm run lint
npm run build

# Better Auth schema/admin
npm run auth:migrate
ADMIN_BOOTSTRAP_EMAIL=user@example.com npm run admin:bootstrap
```

Production verification uses the root Compose file and Node 22 image:

```bash
cd /home/trainai/AILAB
docker compose --env-file .env.production -f docker-compose.prod.yml build frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps frontend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 frontend
```

Do not restart backend/worker services for frontend-only changes.

## Change Checklist

- Trace all callers before changing shared auth, API, config, or translation code.
- Keep server-only imports out of client components.
- Preserve the proxy identity boundary and verified-email check.
- Add no dependency when an existing component or browser/CSS feature suffices.
- Run `npm run build`; for deployment-sensitive changes, run the Docker build.
- Check `git status --short` and ensure no env, generated build, or secret file is staged.
