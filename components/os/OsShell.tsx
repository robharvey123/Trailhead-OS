'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import type { Workstream } from '@/lib/types'

interface OsShellProps {
  workstreams: Workstream[]
  newEnquiryCount: number
  activeQuoteCount: number
  unreadTaskCount?: number
  unreadMailCount?: number
  unreadMessageCount?: number
  children: ReactNode
}

export default function OsShell({
  workstreams,
  newEnquiryCount,
  activeQuoteCount,
  unreadTaskCount = 0,
  unreadMailCount = 0,
  unreadMessageCount = 0,
  children,
}: OsShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('sidebar-collapsed')

    if (saved !== 'true') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setCollapsed(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A]">
      <Sidebar
        workstreams={workstreams}
        newEnquiryCount={newEnquiryCount}
        activeQuoteCount={activeQuoteCount}
        unreadTaskCount={unreadTaskCount}
        unreadMailCount={unreadMailCount}
        unreadMessageCount={unreadMessageCount}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <main
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? 'md:pl-16' : 'md:pl-72'
        }`}
      >
        <div
          className="thmock min-h-screen w-full px-4 pb-8 pt-20 md:px-6 md:pt-8 lg:px-8"
          style={{ background: 'var(--surface)' }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
