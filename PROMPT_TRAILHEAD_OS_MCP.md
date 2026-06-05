# Trailhead OS MCP Server

## Context

Trailhead OS is Rob's internal command centre, a Next.js 16 App Router app on Supabase. It already exposes a bearer-token-authenticated REST API at `/api/cowork/*` (tasks, projects, calendar, CRM, enquiries, invoices, briefing) used by the Cowork desktop app. The helpers and auth flow are all in place. See `lib/cowork-api.ts` and `lib/cowork-auth.ts`.

This brief adds a Model Context Protocol (MCP) server on top of the existing API so Claude (in Cowork mode, Claude Code, the API, anywhere with MCP support) can read and write to Trailhead OS using structured tool definitions rather than ad hoc REST calls. The benefit over raw REST: typed tool schemas, machine-discoverable surface, and Claude can call the tools without us teaching it the endpoint layout every conversation.

Reuse the existing Cowork helpers internally. Do not duplicate task / project / note logic in the MCP server. The MCP layer is a thin transport adapter.

You are the agent described in `CLAUDE.md` at the repo root. Read it first.

## Stack
Next.js 16 App Router, TypeScript strict, Tailwind CSS, Supabase, Netlify.
Single user (Rob only). Auth is via `COWORK_API_KEY` env var, single bearer token. Same as the existing Cowork API.

## What you are building

1. A single new API route at `/app/api/mcp/route.ts` that speaks the MCP HTTP streamable transport protocol.
2. A tool definition layer in `/lib/mcp/tools.ts` that maps MCP tool names to handler functions calling the existing `lib/cowork-api.ts` helpers (and `lib/db/*` directly where appropriate).
3. A `whoami` introspection tool that returns "Trailhead OS MCP v1, ok" so Claude can confirm the connection.
4. Documentation in `/docs/MCP_SERVER.md` covering: the endpoint URL, how to authenticate, the tool surface, and how to connect from Cowork / Claude Code.

Scope of tools for v1:

| Tool | What it does | Backing helper |
|---|---|---|
| `whoami` | Returns server version and authenticated identity | (none) |
| `list_workstreams` | List the 5 fixed workstreams | direct from `workstreams` table |
| `list_projects` | Projects with optional `workstream`, `status` filters | `lib/db/projects.ts` |
| `get_project` | Project + phases + milestones + counts by id | `lib/db/projects.ts` |
| `list_tasks` | OS kanban tasks (`tasks` table) with workstream/project/priority/due/master filters | existing `/api/cowork/tasks` logic |
| `create_task` | Create a single OS task | existing `/api/cowork/tasks` POST handler |
| `update_task` | Patch an OS task (status/priority/due/title/description/labels) | existing |
| `complete_task` | Convenience: set status `done` and `completed_at` | existing |
| `list_engagement_tasks` | engagement_tasks scoped to a project, with status/priority filters | `lib/db/engagement-tasks.ts` |
| `bulk_create_engagement_tasks` | Insert many engagement_tasks in one call (for roadmap import from Claude) | `lib/db/engagement-tasks.ts` |
| `add_note` | Add a note to a workstream, project, or task | `lib/db/notes.ts` |
| `briefing` | Today's brief (calendar + tasks + recent activity) | existing `/api/cowork/briefing` |

Do NOT expose: enquiries, invoices, CRM, calendar mutations. Those are out of scope for v1 and can be added later behind the same MCP server.

## STEP 1 — AUDIT FIRST

Read these files and report their current state. Do not change anything.

- `lib/cowork-api.ts` (shared helpers used by every `/api/cowork/*` route)
- `lib/cowork-auth.ts` (the `validateCoworkToken` function)
- `app/api/cowork/tasks/route.ts` and `app/api/cowork/tasks/[id]/route.ts`
- `app/api/cowork/projects/route.ts`
- `app/api/cowork/briefing/route.ts`
- `lib/db/engagement-tasks.ts`
- `lib/db/projects.ts`
- `lib/db/notes.ts`
- `lib/db/tasks.ts`
- `lib/types.ts` (the relevant `Task`, `EngagementTask`, `Project` types)
- `.env.example` (confirm `COWORK_API_KEY` is present)
- `package.json` (note Next.js version and whether `@modelcontextprotocol/sdk` is already a dep)

Report back:

- The exact shape of the POST body the existing `/api/cowork/tasks` route accepts (you'll mirror this in the `create_task` MCP tool)
- The exact filter params the GET route accepts (mirror in `list_tasks`)
- Whether any task / project mutation logic lives inside the route handlers vs in `lib/db/*` (so we know how much to factor out)
- Whether the project supports running both Cowork API and MCP server on the same Netlify deployment (it should, both are just Next.js routes)

Compile and confirm: `npm run typecheck && npm run lint`

## STEP 2 — Install the MCP SDK

```sh
npm install @modelcontextprotocol/sdk
```

Confirm version is at least 1.x. If the SDK has changed shape since this brief was written, follow the current Next.js + HTTP streamable transport docs at https://modelcontextprotocol.io/docs.

Compile and confirm: `npm run typecheck && npm run lint`

## STEP 3 — Refactor the cowork-api helpers if needed

Each existing route handler in `/app/api/cowork/*/route.ts` reads the request, validates auth, hits a helper, returns JSON. Some of the work happens inline in the route (parsing query params, mapping shapes), some in `lib/cowork-api.ts`.

The MCP tool handlers will call those helpers directly (not the HTTP route handlers). If any business logic lives in a route handler and not in a helper, extract it into a helper now so both the REST API and the MCP layer can call it. Do not break the REST API contract.

For each of the tools in the table above, identify the helper that backs it. If no helper exists, create one in the same file pattern as the existing Cowork helpers. Examples:

- `createTaskFromCoworkPayload(input)` in `lib/cowork-api.ts` (or a new `lib/cowork-tasks.ts`) — used by both `POST /api/cowork/tasks` and the MCP `create_task` tool.
- `updateTaskFromCoworkPayload(id, patch)` similarly.

Compile and confirm: `npm run typecheck && npm run lint`. Run the existing tests (`npm run lint` is the only quality gate today, this codebase has no test suite — flag that as tech debt in the audit but do not block).

## STEP 4 — Define the MCP tool layer

Create `/lib/mcp/tools.ts`. Use a typed tool registry pattern:

```ts
import { z } from 'zod'

export type McpTool<TInput, TOutput> = {
  name: string
  description: string
  inputSchema: z.ZodType<TInput>
  handler: (input: TInput) => Promise<TOutput>
}

// One export per tool. Each handler calls the existing helper.
export const whoami: McpTool<Record<string, never>, { server: string; version: string }> = {
  name: 'whoami',
  description: 'Returns server identity and version. Use to confirm the MCP connection is healthy.',
  inputSchema: z.object({}),
  handler: async () => ({ server: 'trailhead-os', version: '1.0.0' }),
}

// ... one similar export per tool from the table above

export const tools = [whoami, listWorkstreams, listProjects, getProject, listTasks, createTask, updateTask, completeTask, listEngagementTasks, bulkCreateEngagementTasks, addNote, briefing]
```

Schemas should be tight. Use Zod enums for status, priority, workstream slugs. Pull existing enum values from `lib/types.ts` rather than reinventing them.

Each handler:
- Throws on validation failure (the MCP server wraps thrown errors into tool error responses, do not catch and return ok with an error inside).
- Returns plain JSON-serializable objects matching the existing API shapes (so Claude has a consistent mental model when switching between REST and MCP).
- Org-scoping is not relevant here, Trailhead OS is single-user.

Compile and confirm: `npm run typecheck && npm run lint`

## STEP 5 — Mount the MCP server

Create `/app/api/mcp/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { tools } from '@/lib/mcp/tools'
import { validateCoworkToken } from '@/lib/cowork-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function buildServer() {
  const server = new Server(
    { name: 'trailhead-os', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema), // small helper
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name)
    if (!tool) throw new Error(`Unknown tool: ${req.params.name}`)
    const input = tool.inputSchema.parse(req.params.arguments ?? {})
    const result = await tool.handler(input)
    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  })

  return server
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const server = buildServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless per request
  })

  await server.connect(transport)
  return transport.handleHttpRequest(request)
}

export async function GET() {
  return new Response('Method not allowed', { status: 405 })
}
```

Notes:
- The MCP SDK has been evolving. If the imports above don't resolve, follow the current SDK README pattern for HTTP streamable. The key principle is: bearer-auth the request, build a stateless `Server`, connect a streamable HTTP transport, hand it the request.
- `zodToJsonSchema` is a tiny utility you'll need to write or pull from `zod-to-json-schema` if it's not already a dep. Do not over-engineer.

Compile and confirm: `npm run typecheck && npm run lint`

## STEP 6 — Document the surface

Create `/docs/MCP_SERVER.md`:

- Endpoint: `https://<your-trailhead-os-domain>/api/mcp`
- Authentication: `Authorization: Bearer ${COWORK_API_KEY}` header on every request.
- How to connect from Cowork: in Cowork settings, add a custom MCP server with the URL above and the bearer token.
- How to connect from Claude Code: add to `~/.claude.json` or via `claude mcp add` with HTTP transport and the bearer token.
- Tool surface: enumerate each tool with its input schema and example invocation. Generate this from the tool definitions so it stays in sync.
- Rate limits: none yet. Note as future tech debt.
- Audit log: not yet implemented. Note as future tech debt.

## STEP 7 — Smoke test

Local:

1. `npm run dev`
2. In another terminal, hit `/api/mcp` with a fake MCP `tools/list` JSON-RPC payload and the bearer token:

```sh
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer ${COWORK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

3. Confirm the response lists all 12 tools.
4. Call `whoami`:

```sh
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer ${COWORK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"whoami","arguments":{}}}'
```

5. Call `list_tasks` with `workstream=app-dev`. Confirm Engineer OS tasks come back if any exist.
6. Call `create_task` to add a smoke task ("MCP smoke test, delete me"). Confirm it appears in the Trailhead OS UI under the right workstream.
7. Call `update_task` to flip the smoke task to status `done`. Confirm the UI reflects it.
8. Call `bulk_create_engagement_tasks` with 2 fake rows. Confirm both land. Delete them after.

Auth negative test:

9. Hit `/api/mcp` without the bearer token. Confirm 401.
10. Hit with a wrong token. Confirm 401.

## STEP 8 — Deploy

1. Confirm `COWORK_API_KEY` is set in Netlify production env (it should already be there, the Cowork API uses the same key).
2. Push and let Netlify deploy.
3. Re-run the smoke tests against production: same curl commands with the production URL.
4. From Cowork on Rob's machine: connect the new MCP server. Confirm `whoami` returns ok.
5. Open the Engineer OS project in Trailhead OS. From Cowork ask Claude to "list open M1 tasks on Engineer OS" via the MCP. Confirm it returns the right rows.

## Final check

Run `npm run typecheck && npm run lint && npm run build` and report the output.
List every file modified, created, deleted.
Confirm the existing Cowork REST API still works (smoke any one endpoint, e.g. `GET /api/cowork/tasks?workstream=app-dev`).
Confirm the smoke task created in STEP 7 has been cleaned up.
Note any deviations from this brief and the reasons.

## Out of scope (do not build in v1)

- Multi-user / per-user tokens. Single token, Rob only.
- Token rotation UI. Edit `COWORK_API_KEY` in Netlify and redeploy when needed.
- Rate limiting.
- Per-tool audit log.
- Webhook / subscription tools (for Claude to be notified when tasks change). Not yet, save for v2.
- Exposing enquiries, invoices, CRM, calendar. Same reason.

These are all "v2 if useful" items. Capture them in `KNOWN_HARDENING.md` (create the file if it doesn't exist) at the end of this brief.
