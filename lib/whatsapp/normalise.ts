// Name and text normalisation for WhatsApp exports.
//
// iOS exports are full of invisible characters: U+200E/U+200F around timestamps
// and attachment markers, U+202F narrow no-break space inside "~ Steve", and
// U+2068/U+2069 isolates around @mentions. They must all be stripped before any
// matching, or participant names silently fail to join up across exports.

// Zero-width, bidi and BOM marks. Never part of a name.
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g
// Non-breaking / narrow / figure spaces → plain space.
const NBSP_RE = /[\u00A0\u2007\u202F]/g

export function stripInvisible(input: string): string {
  return input.replace(INVISIBLE_RE, '').replace(NBSP_RE, ' ')
}

/**
 * The display name as we store it: invisibles stripped, the '~' unsaved-number
 * prefix removed (it is not part of the name and disappears once the number is
 * saved), whitespace collapsed. Case preserved.
 */
export function cleanDisplayName(raw: string): string {
  return stripInvisible(raw).replace(/^\s*~\s*/, '').replace(/\s+/g, ' ').trim()
}

/** Match key: cleanDisplayName lower-cased. Never match on the raw string. */
export function normaliseParticipantName(raw: string): string {
  return cleanDisplayName(raw).toLowerCase()
}
