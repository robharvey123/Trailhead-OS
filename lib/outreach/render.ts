// Merge-tag renderer for outreach templates. Replaces {{key}} tokens from a vars
// map. An unresolved token (key not supplied) THROWS rather than shipping a raw
// "{{company}}" to a prospect. Substituted values are HTML-escaped for the body;
// pass { escape: false } when rendering a plain-text subject line.

export const OUTREACH_TEMPLATE_VARS = [
  'email_greeting', 'company', 'name', 'city', 'channel', 'sub_trade', 'size_signal',
] as const

export type OutreachTemplateVar = (typeof OUTREACH_TEMPLATE_VARS)[number]

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function renderTemplate(
  body: string,
  vars: Record<string, string>,
  options: { escape?: boolean } = {}
): string {
  const escape = options.escape ?? true
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Unresolved template token: {{${key}}}`)
    }
    const value = vars[key] ?? ''
    return escape ? escapeHtml(value) : value
  })
}
