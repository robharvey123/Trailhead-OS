/**
 * Strip document wrappers (doctype / html / head+contents / body tags) from an
 * HTML fragment, anywhere they appear. Used to keep stored signatures and
 * composed outbound bodies as inner HTML only — so a signature pasted as a full
 * document from a designer's email client never nests a second document.
 */
export function stripDocumentWrappers(html: string): string {
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?(html|body)[^>]*>/gi, '')
    .trim()
}

/** True if the HTML carries any document-level wrapper (so it isn't clean inner HTML). */
export function hasDocumentWrappers(html: string): boolean {
  return /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(html)
}
