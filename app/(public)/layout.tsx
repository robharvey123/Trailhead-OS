import type { ReactNode } from 'react'
import Link from 'next/link'

export default function PublicLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f7f1e8] text-[#1e293b]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.7),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(253,230,138,0.65),_transparent_34%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/discovery"
            className="inline-flex rounded-full border border-[#d6c8b6] bg-white/70 px-4 py-2 text-sm font-medium tracking-[0.18em] text-[#7c5a36] uppercase backdrop-blur"
          >
            Trailhead Holdings
          </Link>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
