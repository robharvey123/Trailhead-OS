import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { handleMcpRequest } from '@/lib/mcp/handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Trailhead OS MCP server, bearer-authed with the shared Cowork token.
 *
 * The protocol handling lives in `lib/mcp/handler.ts` so the secret-URL connector
 * route (`/api/mcp/c/[token]`, for claude.ai custom connectors, which cannot send
 * an Authorization header) serves the identical tool surface. This route's
 * behaviour is unchanged: bearer check, then the handler.
 */
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  return handleMcpRequest(request)
}

export async function GET() {
  return new Response('Method not allowed', { status: 405 })
}
