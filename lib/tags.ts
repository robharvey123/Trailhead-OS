// Deterministic per-label colour so a given tag string always renders the same
// hue across cards and filter chips. Hue derived from a stable string hash; the
// background is an alpha tint so it reads on both light and dark surfaces.

export interface LabelColor {
  hue: number
  /** Soft tinted background for the resting chip. */
  bg: string
  /** Readable text/icon colour on the tint. */
  fg: string
  /** Subtle border matching the hue. */
  border: string
  /** Filled background for the active/selected state. */
  solidBg: string
}

function hashLabel(label: string): number {
  let h = 0
  const s = label.toLowerCase()
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function labelColor(label: string): LabelColor {
  const hue = hashLabel(label) % 360
  return {
    hue,
    bg: `hsl(${hue} 70% 50% / 0.14)`,
    fg: `hsl(${hue} 60% 32%)`,
    border: `hsl(${hue} 60% 50% / 0.32)`,
    solidBg: `hsl(${hue} 58% 45%)`,
  }
}
