import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Sign-in and account pages belong to the OS, not the marketing site: name the
// product in the tab and keep them out of search indexes.
export const metadata: Metadata = {
  title: { template: '%s | Trailhead OS', absolute: 'Trailhead OS' },
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
