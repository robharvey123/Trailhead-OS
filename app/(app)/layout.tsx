import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrailheadLogo from '@/components/brand/TrailheadLogo'

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
    // The legacy analytics app is a navy island. `thmock th-dark` remaps the
    // working tokens for a navy ground, so the components it shares with the OS
    // read correctly here. The token classes sit on this outer wrapper and the
    // layout utilities on the inner one, because the unlayered .thmock rules
    // beat utilities on the same element. `color-scheme` keeps native controls
    // (select menus, month pickers, scrollbars) dark as well.
    <div className="thmock th-dark [color-scheme:dark]">
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-4">
            <Link href="/workspaces" className="no-underline">
              <TrailheadLogo variant="reverse" />
            </Link>
            <form action="/logout" method="post">
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-screen-2xl px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
