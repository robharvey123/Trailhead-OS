# Known hardening / future work

Deferred items captured during builds. Not blocking; revisit when useful.

## MCP server (brief 16 — v1)

Shipped: `/api/mcp` Streamable HTTP server with 12 tools, bearer-auth via
`COWORK_API_KEY`. See `docs/MCP_SERVER.md`.

Deferred to v2:

- **Per-user / per-token auth.** Single shared token only (Rob). No scoping.
- **Token rotation UI.** Rotate by editing `COWORK_API_KEY` in Netlify and
  redeploying.
- **Rate limiting.** No limits on `/api/mcp` (or `/api/cowork/*`).
- **Per-tool audit log.** Tool calls are not recorded. Consider a lightweight
  `mcp_audit` table (tool name, args digest, timestamp, result status).
- **Webhook / subscription tools.** No way for Claude to be notified when tasks
  change. Would need MCP resource subscriptions or an outbound webhook.
- **Expose more surface.** v1 deliberately omits enquiries, invoices, CRM, and
  calendar **mutations**. Add behind the same server when there's a need.
- **Project-scoped notes.** The `notes` table has no `project_id` column, so
  `add_note` supports workstream- and task-scoped notes only. Project notes
  would need a migration adding `notes.project_id` (+ index + RLS) and an
  updated `add_note` schema.
- **Tool error convention.** Failures are returned as `{ isError: true }` tool
  results (so Claude sees the message). Validation errors include the raw Zod
  issue JSON — fine for a single-user tool, but could be prettified.

## Pre-existing repo tech debt (observed, not introduced here)

- **No test suite.** `npm run lint` is the only automated quality gate. The MCP
  layer was verified with manual smoke tests (see `docs/MCP_SERVER.md`), not
  unit tests.
- **`npm run lint` is not clean on `main`.** As of this build it reports 4
  errors / 59 warnings in pre-existing files (`components/table/DataTable.tsx`,
  `lib/db/weekly-report.ts`, `lib/workspace/task-payload.ts`,
  `lib/workspace/task-relations.ts`). None are touched by the MCP work.
