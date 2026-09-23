import { timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { handleMcpRequest } from '@/lib/mcp/handler'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Trailhead OS MCP server, authenticated by a secret in the URL.
 *
 * claude.ai custom connectors cannot send an `Authorization` header, so the
 * bearer-authed `/api/mcp` route cannot be added as a connector. This route
 * serves the identical MCP surface with `MCP_CONNECTOR_TOKEN` carried in the
 * path instead. THE URL IS THE CREDENTIAL: it is as sensitive as the API key,
 * and must never be logged, committed or pasted into a chat.
 *
 * Fail-closed rules:
 *   • `MCP_CONNECTOR_TOKEN` unset or under 48 chars → 404 for every request.
 *   • Wrong token → 404, not 401, so the route never confirms it exists.
 *
 * Rate limited per IP (the codebase has no shared limiter; `lib/rate-limit.ts`
 * is process-local, see the note there). `/api/mcp` is unchanged and unlimited.
 *
 * Nothing here logs. If logging is ever added to this route, log
 * REDACTED_MCP_CONNECTOR_PATH from lib/mcp/handler.ts — never `request.url` or
 * `nextUrl.pathname`, which both carry the secret. Vercel's platform request logs
 * DO record the full path, so access to those logs is access to the credential;
 * rotate the token if the log drain is ever shared.
 */

const MIN_TOKEN_LENGTH = 48
const RATE_LIMIT_PER_MINUTE = 120

function notFound() {
  // Bodies and headers match a plain miss: nothing here distinguishes "wrong
  // token" from "no such route", nor which check failed.
  return new Response('Not Found', { status: 404 })
}

function tokenMatches(provided: string): boolean {
  const expected = process.env.MCP_CONNECTOR_TOKEN
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return false

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  // timingSafeEqual throws on a length mismatch, so length is checked first.
  // Length is not secret (the connector URL's shape is public knowledge).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Token check + per-IP rate limit. Returns a Response to send, or null to proceed. */
function guard(request: NextRequest, token: string): Response | null {
  if (!tokenMatches(token)) return notFound()

  const limit = rateLimit(`mcp-connector:${clientIp(request)}`, RATE_LIMIT_PER_MINUTE, 60_000)
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': String(limit.retryAfter) },
    })
  }
  return null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const blocked = guard(request, token)
  if (blocked) return blocked

  return handleMcpRequest(request)
}

// GET/DELETE mirror `/api/mcp`: this transport runs stateless with JSON responses,
// so there is no SSE stream to open and no session to terminate. Both still run
// the token check first, so a wrong token gets 404 rather than a 405 that would
// confirm the route exists.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const blocked = guard(request, token)
  if (blocked) return blocked

  return new Response('Method not allowed', { status: 405 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const blocked = guard(request, token)
  if (blocked) return blocked

  return new Response('Method not allowed', { status: 405 })
}
