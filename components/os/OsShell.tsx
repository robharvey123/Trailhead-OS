'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import type { Workstream } from '@/lib/types'

interface OsShellProps {
  workstreams: Workstream[]
  newEnquiryCount: number
  children: ReactNode
}

export default function OsShell({
  workstreams,
  newEnquiryCount,
  children,
}: OsShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar
        workstreams={workstreams}
        newEnquiryCount={newEnquiryCount}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <main
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? 'md:pl-16' : 'md:pl-72'
        }`}
      >
        <div className="mx-auto min-h-screen max-w-screen-2xl px-4 pb-8 pt-20 md:px-8 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
