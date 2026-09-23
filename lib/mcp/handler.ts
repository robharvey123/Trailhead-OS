import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { tools } from '@/lib/mcp/tools'

/**
 * Trailhead OS MCP protocol handler (Streamable HTTP, stateless, JSON responses).
 *
 * Auth is deliberately NOT done here — the caller authenticates and then hands the
 * request over. Two routes call it:
 *   • `POST /api/mcp`            — `Authorization: Bearer <COWORK_API_KEY>`
 *   • `POST /api/mcp/c/[token]`  — secret in the URL, for claude.ai custom connectors
 *     (which cannot send an Authorization header)
 *
 * NOTE on transport: the Node `StreamableHTTPServerTransport` wraps
 * `IncomingMessage`/`ServerResponse` and does not fit Next.js App Router, which
 * speaks the Web Fetch `Request`/`Response`. `WebStandardStreamableHTTPServerTransport`
 * has `handleRequest(req: Request): Promise<Response>` — exactly what a route handler
 * needs. Used in stateless mode (no session id) with JSON responses (no SSE), one
 * server + transport per request.
 */

function buildServer() {
  const server = new Server(
    { name: 'trailhead-os', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((candidate) => candidate.name === request.params.name)
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`)
    }

    try {
      const result = await tool.handler(request.params.arguments ?? {})
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    } catch (error) {
      // Surface tool failures as an isError result so Claude sees the message,
      // rather than an opaque protocol error.
      const message = error instanceof Error ? error.message : 'Tool execution failed'
      return { content: [{ type: 'text', text: message }], isError: true }
    }
  })

  return server
}

/** Run one MCP JSON-RPC request. The caller must have authenticated it already. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: one server + transport per request
    enableJsonResponse: true, // return JSON, not an SSE stream
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}

/**
 * The only form of the connector path that may be written to a log, an error
 * message or an analytics event. The real path carries `MCP_CONNECTOR_TOKEN`, so
 * logging `request.url` or `nextUrl.pathname` for that route would leak the
 * credential. (Vercel's own platform request logs do record the full path — see
 * the security note in the route — so treat log access as credential access.)
 */
export const REDACTED_MCP_CONNECTOR_PATH = '/api/mcp/c/[redacted]'
