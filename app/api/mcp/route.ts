import { NextRequest } from 'next/server'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { tools } from '@/lib/mcp/tools'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Trailhead OS MCP server (Streamable HTTP, stateless, JSON responses).
 *
 * NOTE on transport: the original brief used the Node `StreamableHTTPServerTransport`
 * with `transport.handleHttpRequest(request)`. In SDK ≥1.x that transport is a Node
 * `IncomingMessage`/`ServerResponse` wrapper and does not fit Next.js App Router,
 * which speaks the Web Fetch `Request`/`Response`. The SDK ships
 * `WebStandardStreamableHTTPServerTransport` whose `handleRequest(req: Request)`
 * returns a Web `Response` — exactly what a route handler needs. We use it in
 * stateless mode (no session id) with JSON responses (no SSE), one server per
 * request. Auth is the shared Cowork bearer token.
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

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: one server + transport per request
    enableJsonResponse: true, // return JSON, not an SSE stream
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function GET() {
  return new Response('Method not allowed', { status: 405 })
}
