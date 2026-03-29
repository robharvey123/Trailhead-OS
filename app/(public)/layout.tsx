import type { ReactNode } from 'react'

export default function PublicLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-4 left-4 z-10">
        <img src="/logo.svg" alt="Trailhead Holdings" className="h-7 w-auto" />
      </div>
      {children}
    </div>
  )
}
