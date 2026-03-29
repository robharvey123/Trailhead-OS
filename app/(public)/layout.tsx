import type { ReactNode } from 'react'

export default function PublicLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-4 left-4 z-10">
        <span className="text-sm font-medium text-gray-500">
          Trailhead Holdings
        </span>
      </div>
      {children}
    </div>
  )
}
