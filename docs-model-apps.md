# Model App UI

- `/apps`: Model Apps tab creates a draft app or adds a release through
  `RunSetup` and `PublishForm`, selecting completed runs from the existing
  owner-scoped `/api/tasks`. API tab selects a completed run and reuses
  `ModelApiPanel` for endpoint/key management, including existing endpoints.
  Task detail keeps training, testing and evaluation, without publication panels.
  The server still validates checkpoint availability and ownership on creation;
  the run picker does not infer availability from a truncated artifact listing.
- Model Apps tab: owner-only management, preview, publish/rollback, unpublish, delete,
  copied share URL and aggregate usage. Preview success comes from the worker,
  not a client-side flag.
- `/apps/{owner}/{slug}`: login-required single-image prediction. Session data
  goes through the existing internal backend proxy, never an owner API key.
- `?version=N` is owner preview; `?job=UUID` restores only the requester's job.
  The server verifies both. Keep the `apps` callback allowlist and proxy matcher
  in sync when changing routes.
- `AppViewer` keeps submission state separate from the selected result and
  preserves a request key on an uncertain submission. Polling is scoped to job
  ID, aborts on navigation, and never shows a different app's output.
- Labels and errors are Thai/English; limits and privacy/expiry notes are shared
  with Guide. Classification scores are not accuracy; no metrics are invented.

Tests: `tests/model-apps.test.tsx`, `tests/model-app-manager.test.tsx`,
`tests/model-api-panel.test.tsx`, `tests/worker-status.test.tsx`,
`tests/auth-redirect.test.tsx`, and isolated
browser publication-to-result checks. Backend contracts and lifecycle live in
the backend repository's `docs/model-apps.md`.
