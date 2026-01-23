import Link from 'next/link'

type FiltersBarProps = {
  basePath: string
  brand: string
  start: string
  end: string
}

export default function FiltersBar({
  basePath,
  brand,
  start,
  end,
}: FiltersBarProps) {
  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm"
    >
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Brand
        </span>
        <input
          name="brand"
          defaultValue={brand}
          placeholder="Brand"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Start month
        </span>
        <input
          type="month"
          name="start"
          defaultValue={start}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          End month
        </span>
        <input
          type="month"
          name="end"
          defaultValue={end}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950"
      >
        Apply
      </button>
      <Link
        href={basePath}
        className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase tracking-wide text-slate-300"
      >
        Reset
      </Link>
    </form>
  )
}
