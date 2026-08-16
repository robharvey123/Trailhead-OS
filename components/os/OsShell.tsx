'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from './CommandPalette'
import PushPromptBanner from '@/components/notifications/PushPromptBanner'

interface OsShellProps {
  // `null` = the count query failed. Rendered as a warning glyph, not a zero.
  newEnquiryCount: number | null
  activeQuoteCount: number | null
  unreadTaskCount?: number | null
  unreadMailCount?: number | null
  unreadMessageCount?: number | null
  unreadMentionsCount?: number | null
  userId?: string
  children: ReactNode
}

export default function OsShell({
  newEnquiryCount,
  activeQuoteCount,
  unreadTaskCount = 0,
  unreadMailCount = 0,
  unreadMessageCount = 0,
  unreadMentionsCount = 0,
  userId,
  children,
}: OsShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // ⌘K / Ctrl+K from anywhere in the OS, except while typing into a field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      event.preventDefault()
      setSearchOpen((prev) => !prev)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openSearch = useCallback(() => setSearchOpen(true), [])

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
    // `data-sidebar` drives --os-sidebar-w (globals.css), which both the sidebar
    // rail and <main>'s left padding read. Snapping it beats transitioning it:
    // width/padding are layout properties, so the old 300ms transition reflowed
    // the whole document every frame of a toggle.
    <div
      className="os-shell min-h-screen bg-[#F1F5F9] text-[#0F172A]"
      data-sidebar={collapsed ? 'collapsed' : 'expanded'}
    >
      {/* First tab stop on every OS page: jump the ~40-item sidebar. */}
      <a
        href="#os-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-2xl focus:border focus:border-[#E2E8F0] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#0F172A] focus:outline-2 focus:outline-offset-2 focus:outline-[#0369A1]"
      >
        Skip to main content
      </a>
      <Sidebar
        newEnquiryCount={newEnquiryCount}
        activeQuoteCount={activeQuoteCount}
        unreadTaskCount={unreadTaskCount}
        unreadMailCount={unreadMailCount}
        unreadMessageCount={unreadMessageCount}
        unreadMentionsCount={unreadMentionsCount}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <main
        id="os-main"
        tabIndex={-1}
        className="os-shell-main min-h-screen"
      >
        <div className="thmock min-h-screen w-full bg-[var(--surface)] pt-14 md:pt-0">
          <Topbar onOpenSearch={openSearch} />
          <div className="w-full px-4 pb-8 pt-6 md:px-6 lg:px-8">{children}</div>
        </div>
      </main>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      {userId ? <PushPromptBanner userId={userId} /> : null}
    </div>
  )
}
