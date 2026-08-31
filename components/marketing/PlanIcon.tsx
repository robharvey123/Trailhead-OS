/**
 * The bay plan's icon set.
 *
 * Drawn, not typed. Unicode arrows (→ ↗ ←) and a text "+" were standing in for
 * an icon system, which means every glyph carried its font's weight and
 * terminals rather than the drawing's. These are one stroke weight with butt
 * caps and mitre joins, the way a plan is inked, and they scale with the label
 * they sit beside.
 */

type IconName = 'right' | 'left' | 'external' | 'cross'

const PATHS: Record<IconName, string> = {
  // Shaft plus a two-line head — a drawn arrow, not a chevron.
  right: 'M2 8h12M10 4l4 4-4 4',
  left: 'M14 8H2M6 4L2 8l4 4',
  external: 'M5 11L12 4M6 4h6v6',
  // The disclosure mark: a cross that rotates to a minus when the row opens.
  cross: 'M8 3v10M3 8h10',
}

export default function PlanIcon({
  name,
  size = 14,
  className = '',
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={`shrink-0 ${className}`.trim()}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
