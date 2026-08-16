import { SkeletonBar } from '@/components/os/skeletons'

/** Settings: one narrow column (`os-narrow`) of stacked os-card sections, plus the 2-col pair. */
export default function SettingsLoading() {
  return (
    <div className="os-narrow space-y-6" aria-hidden>
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-8 w-48 rounded-xl" />
        <SkeletonBar className="h-4 w-80" />
      </div>

      {Array.from({ length: 5 }).map((_, index) => (
        <section key={index} className="os-card space-y-4 p-6">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-5 w-40 rounded-lg" />
          <SkeletonBar className="h-3 w-3/4" />
          <div className="space-y-3 pt-2">
            <SkeletonBar className="h-10 w-full rounded-2xl" />
            <SkeletonBar className="h-10 w-full rounded-2xl" />
          </div>
        </section>
      ))}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="os-card space-y-3 p-6">
          <SkeletonBar className="h-5 w-40 rounded-lg" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-3xl bg-[var(--surface-2)] p-4">
              <SkeletonBar className="h-3 w-24" />
              <SkeletonBar className="mt-2 h-4 w-40" />
            </div>
          ))}
        </section>
        <section className="os-card space-y-3 p-6">
          <SkeletonBar className="h-5 w-40 rounded-lg" />
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBar key={index} className="h-11 w-full rounded-2xl" />
          ))}
        </section>
      </div>

      {Array.from({ length: 3 }).map((_, index) => (
        <section key={index} className="os-card space-y-4 p-6">
          <SkeletonBar className="h-5 w-40 rounded-lg" />
          <SkeletonBar className="h-10 w-full rounded-2xl" />
        </section>
      ))}
    </div>
  )
}
