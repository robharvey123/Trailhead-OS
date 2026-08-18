/**
 * Dependency-free inline sparkline (server-renderable SVG). Flat-lines render
 * mid-height so "no movement" reads as a line, not an empty box.
 */
export default function Sparkline({
  values,
  width = 120,
  height = 30,
  stroke = 'var(--accent)',
}: {
  values: number[]
  width?: number
  height?: number
  stroke?: string
}) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const pad = 2
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2)
      const y =
        range === 0
          ? height / 2
          : pad + (1 - (v - min) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
