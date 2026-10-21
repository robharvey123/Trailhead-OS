import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import SalesShell from '@/components/sales/SalesShell'
import { getCurrentProfile, roleCanUseSales, roleIsSales } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { mockupFontVars } from '@/lib/fonts'

export const dynamic = 'force-dynamic'

/**
 * /sales/* is for the Sales Lead seat, plus owner/admin (to see what the seat
 * sees). Middleware already keeps the seat inside /sales; this keeps other
 * roles (employee, contractor) out of it.
 */
export default async function SalesLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  if (!profile) redirect('/login?next=/sales/dashboard')
  if (!roleCanUseSales(profile.role)) redirect('/dashboard')

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <SalesShell displayName={profile.display_name} isOwnerView={!roleIsSales(profile.role)}>
        {children}
      </SalesShell>
    </div>
  )
}
