import Link from 'next/link'

/**
 * The Growth engine, as a numbered checklist. Every step's done-state is
 * derived from live data, the first not-done step is highlighted as "you are
 * here", and each step links to the screen where it happens. Auto-expands
 * while the site is still being set up; collapses to a summary line after.
 */

export interface PipelineStep {
  title: string
  detail: string
  href: string
  done: boolean
}

export default function PipelineGuide({ steps }: { steps: PipelineStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  const currentIndex = steps.findIndex((s) => !s.done)

  return (
    <details className="os-card p-6" open={doneCount < 4}>
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
        How the engine works — step {Math.min(currentIndex + 1, steps.length)} of {steps.length}
        <span className="ml-2 font-normal text-[color:var(--text-3)]">
          ({doneCount} done)
        </span>
      </summary>
      <ol className="mt-4 space-y-1.5">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex
          return (
            <li key={step.title}>
              <Link
                href={step.href}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-2.5 transition hover:border-[color:var(--accent)] ${
                  isCurrent
                    ? 'border-[color:var(--accent)] bg-[var(--accent-dim)]'
                    : 'border-transparent'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    step.done
                      ? 'bg-emerald-100 text-emerald-700'
                      : isCurrent
                        ? 'bg-[var(--accent)] text-white'
                        : 'border border-[color:var(--border)] text-[color:var(--text-3)]'
                  }`}
                >
                  {step.done ? '✓' : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${
                      step.done ? 'text-[color:var(--text-3)]' : 'text-[color:var(--text)]'
                    }`}
                  >
                    {step.title}
                    {isCurrent ? (
                      <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        you are here
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-sm text-[color:var(--text-2)]">{step.detail}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
