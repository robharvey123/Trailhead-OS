/**
 * A post-auth redirect target from a query string or form field. Only
 * same-origin absolute paths are allowed: "/sales/dashboard" yes,
 * "//evil.example" or "https://evil.example" no (open redirect).
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}
