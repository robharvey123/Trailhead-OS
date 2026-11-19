import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { clientIp, rateLimit } from '@/lib/rate-limit'

/**
 * Shared plumbing for the public /api/proposal/[token]/* handlers.
 *
 * Every token failure returns the identical 404 body, so a caller cannot tell
 * a malformed token from a revoked one or a draft. rateLimit is in-memory per
 * function instance: it slows a single client down, it is not a hard cap. The
 * 256-bit token is the real gate.
 */

export const MAX_BODY_BYTES = 10 * 1024

export function proposalNotFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function jsonError(error: string, status: number, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error, ...extra }, { status })
}

/** Returns a 429 response when over the limit, else null. Keyed on ip + action + token. */
export function limitOrNull(
  request: Request,
  action: string,
  token: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const result = rateLimit(`proposal:${action}:${clientIp(request)}:${token}`, limit, windowMs)
  if (result.ok) return null
  return NextResponse.json(
    { error: 'Too many requests. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
  )
}

/**
 * Read and validate a JSON body: JSON content type only, at most 10KB (checked
 * on the declared length and again on the bytes actually read), then zod.
 */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const type = request.headers.get('content-type') ?? ''
  if (!type.toLowerCase().startsWith('application/json')) {
    return { ok: false, response: jsonError('Send JSON.', 415) }
  }
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return { ok: false, response: jsonError('Request too large.', 413) }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError('Request too large.', 413) }
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, response: jsonError('Invalid JSON.', 400) }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first?.path.length ? `${first.path.join('.')}: ` : ''
    return { ok: false, response: jsonError(`${where}${first?.message ?? 'Invalid request.'}`, 400) }
  }
  return { ok: true, data: parsed.data }
}

export function requestMeta(request: Request): { ip: string; user_agent: string | null } {
  return { ip: clientIp(request), user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null }
}
