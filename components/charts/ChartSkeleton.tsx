/**
 * Placeholder shown while a Recharts bundle is being fetched.
 *
 * Recharts (plus its d3 dependencies) is ~200kB of client JS that only matters
 * once a chart is actually on screen, so every chart module in
 * `app/(app)/workspace/**` is behind a `next/dynamic` boundary. This is what the
 * boundary renders in the meantime. It reuses the token card and geometry of
 * the analytics `loading.tsx` files so the swap is not a jolt, and it reads the
 * working tokens only, so it works on the white OS ground and on navy.
 */
export default function ChartSkeleton({
  cards = 1,
  tall = false,
}: {
  /** How many chart cards the real component renders, so the space is reserved. */
  cards?: number
  /** `true` for the ~h-72 charts (company summary), `false` for the h-64 ones. */
  tall?: boolean
}) {
  return (
    <div className={cards > 1 ? 'grid gap-6 lg:grid-cols-2' : ''}>
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-card border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[var(--shadow-sm)]"
        >
          <div className="h-4 w-48 rounded-control bg-[var(--surface-3)]" />
          <div className={`mt-4 rounded-card bg-[var(--surface-3)] ${tall ? 'h-72' : 'h-64'}`} />
        </div>
      ))}
    </div>
  )
}
