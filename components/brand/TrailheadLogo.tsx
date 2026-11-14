/**
 * The Trailhead lockup, drawn exactly as Brand Guidelines v1.0 specifies: four
 * ascending bars with the tallest in brand blue, "Trailhead" in Georgia bold at
 * -0.5px tracking and "HOLDINGS LTD" in Georgia regular at +1.5px tracking.
 *
 * `reverse` is for navy grounds (the marketing header and footer, the OS
 * sidebar, the login page). `positive` is for white. Do not recolour the bars
 * or reset the wordmark. This file is the one place outside the token sheet
 * where the logo's hex values are written.
 */
const PALETTE = {
  reverse: { bar: '#F1F5F9', accent: '#0EA5E9', name: 'text-[#F1F5F9]', sub: 'text-[#94A3B8]' },
  positive: { bar: '#0F172A', accent: '#0EA5E9', name: 'text-[#0F172A]', sub: 'text-[#64748B]' },
} as const

interface TrailheadLogoProps {
  variant?: 'reverse' | 'positive'
  /** Draw the four bars without the wordmark, for tight spaces such as the collapsed sidebar. */
  markOnly?: boolean
  /** Width of the mark in px. The lockup scales its type from the default 34. */
  size?: number
  className?: string
}

export function TrailheadMark({
  variant = 'reverse',
  size = 34,
  className,
}: Pick<TrailheadLogoProps, 'variant' | 'size' | 'className'>) {
  const colours = PALETTE[variant]
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={Math.round((size * 38) / 46)}
      viewBox="0 0 46 38"
      className={`shrink-0 ${className ?? ''}`}
    >
      <rect x="0" y="28" width="10" height="10" rx="2" fill={colours.bar} />
      <rect x="12" y="18" width="10" height="20" rx="2" fill={colours.bar} />
      <rect x="24" y="8" width="10" height="30" rx="2" fill={colours.bar} />
      <rect x="36" y="0" width="10" height="38" rx="2" fill={colours.accent} />
    </svg>
  )
}

export default function TrailheadLogo({
  variant = 'reverse',
  markOnly = false,
  size = 34,
  className,
}: TrailheadLogoProps) {
  if (markOnly) {
    return <TrailheadMark variant={variant} size={size} className={className} />
  }

  const colours = PALETTE[variant]
  return (
    <span className={`flex items-center gap-3 ${className ?? ''}`}>
      <TrailheadMark variant={variant} size={size} />
      <span className="flex flex-col leading-none">
        <span className={`font-[Georgia,serif] text-[1.125rem] font-bold tracking-[-0.5px] ${colours.name}`}>
          Trailhead
        </span>
        <span className={`mt-[5px] font-[Georgia,serif] text-[0.625rem] tracking-[1.5px] ${colours.sub}`}>
          HOLDINGS LTD
        </span>
      </span>
    </span>
  )
}
