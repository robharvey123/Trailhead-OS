type TrendValueProps = {
  value: number
  previous?: number | null
  formatted: string
}

const UpArrow = () => (
  <svg
    viewBox="0 0 10 10"
    aria-hidden="true"
    className="h-2.5 w-2.5"
  >
    <path d="M5 2L8 6H2L5 2Z" fill="currentColor" />
  </svg>
)

const DownArrow = () => (
  <svg
    viewBox="0 0 10 10"
    aria-hidden="true"
    className="h-2.5 w-2.5"
  >
    <path d="M5 8L2 4H8L5 8Z" fill="currentColor" />
  </svg>
)

export default function TrendValue({ value, previous, formatted }: TrendValueProps) {
  if (previous === null || previous === undefined) {
    return <span>{formatted}</span>
  }

  const delta = value - previous
  if (!Number.isFinite(delta) || delta === 0) {
    return <span>{formatted}</span>
  }

  const isUp = delta > 0
  const colorClass = isUp ? 'text-emerald-400' : 'text-rose-400'

  return (
    <span className="inline-flex items-center gap-1">
      <span>{formatted}</span>
      <span className={colorClass}>{isUp ? <UpArrow /> : <DownArrow />}</span>
      <span className="sr-only">{isUp ? 'Up' : 'Down'}</span>
    </span>
  )
}
