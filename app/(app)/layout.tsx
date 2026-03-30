import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-4">
          <Link href="/analytics" className="text-sm font-semibold">
            Trailhead OS
          </Link>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-slate-700 px-4 py-1 text-xs uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-2xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
