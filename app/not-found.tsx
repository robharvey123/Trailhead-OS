import Link from 'next/link'

export const metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F5F9] p-6">
      <div className="thmock w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-white p-8 shadow-sm">
        <p className="os-eyebrow">404</p>
        <h1 className="os-page-title mt-2">That page doesn&rsquo;t exist</h1>
        <p className="mt-3 text-sm text-[color:var(--text-2)]">
          The link may be out of date, or the record it pointed at has been deleted.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
