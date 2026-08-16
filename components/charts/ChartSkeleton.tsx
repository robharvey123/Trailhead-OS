/**
 * Placeholder shown while a Recharts bundle is being fetched.
 *
 * Recharts (plus its d3 dependencies) is ~200kB of client JS that only matters
 * once a chart is actually on screen, so every chart module in
 * `app/(app)/workspace/**` is behind a `next/dynamic` boundary. This is what the
 * boundary renders in the meantime — it reuses the slate palette and card
 * geometry of the analytics `loading.tsx` files so the swap is not a jolt.
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
          className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70 p-6"
        >
          <div className="h-4 w-48 rounded bg-slate-800" />
          <div className={`mt-4 rounded-xl bg-slate-800/60 ${tall ? 'h-72' : 'h-64'}`} />
        </div>
      ))}
    </div>
  )
}
