/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Deliberately dependency-free and process-local. On Vercel Fluid Compute the
 * counters live per function instance, so the effective ceiling is
 * `limit × instances` rather than a hard global cap — enough to stop a single
 * client hammering one endpoint, not a billing control. If a strict global limit
 * is ever needed, back it with Upstash Redis rather than growing this file.
 */

type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()

/** Drop expired windows so a long-lived instance does not accumulate keys. */
function sweep(now: number) {
  if (windows.size < 1000) return
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Seconds until the window resets — for a Retry-After header. */
  retryAfter: number
}

/**
 * Count one hit against `key`. Returns ok:false once `limit` hits land inside
 * `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = windows.get(key)
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }

  existing.count += 1
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter }
  }
  return { ok: true, remaining: limit - existing.count, retryAfter }
}

/**
 * Best-effort client IP. Vercel sets x-forwarded-for and x-real-ip; both are
 * absent locally, where every caller then shares the 'unknown' bucket.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Clear all windows. Tests only. */
export function resetRateLimits() {
  windows.clear()
}
