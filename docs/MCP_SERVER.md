# Trailhead OS — MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
Trailhead OS to Claude (Cowork, Claude Code, the API — anywhere with MCP
support) as typed, machine-discoverable tools instead of ad-hoc REST calls.

It is a **thin transport adapter** over the existing Cowork helpers
(`lib/cowork-*.ts`) and `lib/db/*` modules — no business logic of its own. The
same code backs both the Cowork REST API and the MCP tools, so the two surfaces
always agree on validation and response shapes.

---

## Endpoint

```
POST https://app.trailheadholdings.uk/api/mcp
```

(Replace the host with your deployment domain. Locally: `http://localhost:3000/api/mcp`.)

- Transport: **MCP Streamable HTTP**, stateless, JSON responses (no SSE session).
- Method: `POST` only. `GET` returns `405`.
- Runtime: Node.js (`runtime = 'nodejs'`).

---

## Authentication

Every request needs the shared bearer token — the **same `COWORK_API_KEY`** the
Cowork REST API already uses. There is no per-user token; Trailhead OS is
single-user (Rob only).

```
Authorization: Bearer ${COWORK_API_KEY}
```

Missing or wrong token → `401 Unauthorised`. The key lives in Netlify production
env (already set for the Cowork API) and in your local `.env.local`.

> **Middleware note:** `/api/mcp` is whitelisted in `middleware.ts`
> (`publicApiPrefixes`) so the app middleware does not 307-redirect it to
> `/login`. The route enforces the bearer token itself.

---

## Connecting

### From Cowork
Settings → add a custom MCP server:
- URL: `https://app.trailheadholdings.uk/api/mcp`
- Header: `Authorization: Bearer <COWORK_API_KEY>`

### From Claude Code
```sh
claude mcp add trailhead-os \
  --transport http \
  https://app.trailheadholdings.uk/api/mcp \
  --header "Authorization: Bearer ${COWORK_API_KEY}"
```
(or add an equivalent entry to `~/.claude.json`). Confirm with the `whoami` tool.

---

## Tool surface (v1)

8 tools. All inputs are validated server-side; a bad input or IO failure comes
back as a tool result with `isError: true` and a human-readable message.

> The workstream-scoped OS-task tools (`list_workstreams`, `list_tasks`,
> `create_task`, `update_task`, `complete_task`) were removed in brief 19 — the OS
> task system now runs on `engagement_tasks`. Use the `*_engagement_task(s)`
> tools below.

| Tool | Input (required **bold**) | Returns |
|---|---|---|
| `whoami` | — | `{ server, version, status, message, identity }` |
| `list_projects` | `status?` | project summary rows (task counts, next milestone) |
| `get_project` | **`id`** | project + phases + milestones + counts |
| `list_engagement_tasks` | **`project_id`**, `status?`, `priority?` | engagement_task rows (with relations) |
| `bulk_create_engagement_tasks` | **`project_id`**, **`tasks[]`** | created engagement_task rows |
| `update_engagement_task` | **`id`**, + any of `title`, `description`, `status`, `priority`, `due_date`, `labels`, `position` | updated engagement_task row (with relations) |
| `add_note` | **`task_id`**, `title?`, `body?` | created note |
| `briefing` | — | today's brief (tasks, calendar, enquiries, invoices) |

### Enums
- project `status`: `planning` · `active` · `on_hold` · `completed` · `cancelled`
- engagement task `status`: `backlog` · `in_progress` · `review` · `done` · `cancelled`
- engagement task `priority`: `low` · `normal` · `high` · `urgent`
- dates: `YYYY-MM-DD`; `completed_at`: ISO datetime

### Example invocations (raw JSON-RPC)

List the tools:
```sh
curl -X POST https://app.trailheadholdings.uk/api/mcp \
  -H "Authorization: Bearer ${COWORK_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Call a tool:
```sh
curl -X POST https://app.trailheadholdings.uk/api/mcp \
  -H "Authorization: Bearer ${COWORK_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"list_engagement_tasks","arguments":{"project_id":"<uuid>","status":"in_progress"}}}'
```

Import a roadmap (bulk):
```sh
... "params":{"name":"bulk_create_engagement_tasks","arguments":{
      "project_id":"<uuid>",
      "tasks":[{"title":"M1: Auth","priority":"high","labels":["M1"]},
               {"title":"M1: DB schema"}]}}
```

> **`Accept` header is required** by the Streamable HTTP transport: it must list
> both `application/json` and `text/event-stream`. MCP clients send this
> automatically; only raw curl needs it spelled out.

---

## Notes & limits

- **`add_note` attaches to a task** (`task_id`). (Project-scoped notes aren't
  supported — the `notes` table has no `project_id`. See `KNOWN_HARDENING.md`.)
- **`bulk_create_engagement_tasks`** derives the engagement from the project
  (`projects.engagement_id`) and appends `position` after any existing tasks,
  mirroring the roadmap-import commit flow.
- **Rate limits:** none yet. Future tech debt.
- **Audit log:** none yet. Future tech debt.
- **Out of scope for v1:** enquiries, invoices, CRM, calendar mutations,
  per-user tokens, token rotation UI, webhook/subscription tools. See
  `KNOWN_HARDENING.md`.

---

## How it fits together

```
Claude (MCP client)
   │  POST /api/mcp  (Bearer COWORK_API_KEY)
   ▼
app/api/mcp/route.ts          ← auth + WebStandardStreamableHTTPServerTransport
   │
lib/mcp/tools.ts              ← 12 typed tools (zod schemas)
   │
lib/cowork-tasks.ts           ← createCoworkTask / updateCoworkTask / listCoworkTasks / completeCoworkTask
lib/cowork-briefing.ts        ← getCoworkBriefing
lib/db/projects.ts            ← getProjects / getProjectById
lib/db/engagement-tasks.ts    ← listProjectEngagementTasks / bulkCreateEngagementTasks
lib/db/notes.ts               ← addNote
   │
Supabase (service-role client — single-user, no RLS scoping needed)
```

The Cowork REST routes (`/api/cowork/tasks`, `/api/cowork/briefing`, …) call the
exact same helpers, so REST and MCP never drift.
