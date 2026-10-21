/**
 * Constant-time string comparison for shared secrets (API keys, connector
 * tokens). Pure JS so it runs in the Edge middleware as well as Node routes,
 * where node:crypto timingSafeEqual is not available. Length is not secret.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
