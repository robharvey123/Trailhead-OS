'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { buildAppLoginHref, buildMarketingHref } from '@/lib/site'
import { getTrackTokens, trackFromPathname, type TrackNavItem } from '@/lib/marketing/tracks'

interface MarketingShellProps {
  children: ReactNode
  isLocalhost: boolean
}

export default function MarketingShell({
  children,
  isLocalhost,
}: MarketingShellProps) {
  const [hasScrolled, setHasScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // One shell, three sub-brands. The pathname decides which identity the
  // chrome wears (wordmark, accent, nav, CTA), so a visitor on /consulting
  // sees a specialist consultancy and a visitor on /studio sees a software
  // studio, without the site splitting into two codebases.
  const tokens = getTrackTokens(trackFromPathname(pathname))

  const wrapperStyle = {
    '--marketing-text': '#0F172A',
    '--marketing-accent': tokens.accent,
    '--marketing-accent-strong': tokens.accentStrong,
    '--marketing-accent-soft': tokens.accentSoft,
    '--marketing-accent-border': tokens.accentBorder,
    '--marketing-background': '#FFFFFF',
    '--marketing-surface': '#F8FAFC',
    '--marketing-border': '#E2E8F0',
  } as CSSProperties

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 10)

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close on route change, so back/forward navigation doesn't leave the panel
  // open. Render-time reset rather than setState-in-effect, the same pattern
  // components/os/ConfirmDialog.tsx uses, and what the lint rule wants.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMenuOpen(false)
  }

  // Escape closes and returns focus to the trigger; lock scroll while open.
  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const navHref = (item: TrackNavItem) =>
    item.external ? item.href : buildMarketingHref(item.href, isLocalhost)

  const renderNavItem = (item: TrackNavItem, className: string) =>
    item.external ? (
      <a
        key={item.href}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={() => setMenuOpen(false)}
      >
        {item.label}
      </a>
    ) : (
      <Link
        key={item.href}
        href={navHref(item)}
        className={className}
        onClick={() => setMenuOpen(false)}
      >
        {item.label}
      </Link>
    )

  return (
    <div
      style={wrapperStyle}
      className="min-h-screen bg-[var(--marketing-background)] text-[var(--marketing-text)]"
    >
      <header
        className={`sticky top-0 z-40 transition ${
          hasScrolled
            ? 'border-b border-[var(--marketing-border)] bg-white/92 backdrop-blur'
            : 'border-b border-transparent bg-white/80'
        }`}
      >
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-6 py-4 md:px-8">
          {/* The wordmark is the endorsed sub-brand: same Trailhead mark, a
              different second word per track. Rendered inline (not the static
              logo.svg) so the second word and the accent bar can change. */}
          <Link
            href={buildMarketingHref('/', isLocalhost)}
            className="flex items-center gap-3"
            aria-label={`Trailhead ${tokens.wordmark.replace(' LTD', '')}, home`}
          >
            <svg
              aria-hidden="true"
              width="34"
              height="38"
              viewBox="0 0 46 48"
              className="shrink-0"
            >
              <rect x="0" y="28" width="10" height="10" rx="2" fill="var(--marketing-text)" />
              <rect x="12" y="18" width="10" height="20" rx="2" fill="var(--marketing-text)" />
              <rect x="24" y="8" width="10" height="30" rx="2" fill="var(--marketing-text)" />
              <rect x="36" y="0" width="10" height="38" rx="2" fill="var(--marketing-accent)" />
            </svg>
            <span className="flex flex-col leading-none" style={{ fontFamily: 'Georgia, serif' }}>
              <span className="text-lg font-bold tracking-[-0.02em] text-[var(--marketing-text)]">
                Trailhead
              </span>
              <span className="mt-1 text-[11px] tracking-[0.14em] text-slate-500">
                {tokens.wordmark}
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
              {tokens.nav.map((item) =>
                renderNavItem(item, 'transition hover:text-[var(--marketing-text)]')
              )}
              {tokens.crossLink ? (
                <Link
                  href={buildMarketingHref(tokens.crossLink.href, isLocalhost)}
                  className="text-slate-400 transition hover:text-[var(--marketing-text)]"
                >
                  {tokens.crossLink.label}
                </Link>
              ) : null}
            </nav>

            {tokens.cta ? (
              <Link
                href={buildMarketingHref(tokens.cta.href, isLocalhost)}
                className="rounded-full bg-[var(--marketing-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--marketing-accent-strong)]"
              >
                {tokens.cta.label}
              </Link>
            ) : null}

            <Link
              href={buildAppLoginHref(isLocalhost)}
              className="rounded-full border border-[var(--marketing-border)] px-4 py-2 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-[var(--marketing-accent-border)] hover:bg-[var(--marketing-accent-soft)]"
            >
              Log in
            </Link>
          </div>

          {/* Below md the nav above is hidden. Without this trigger the header
              was a logo and nothing else, so the pages holding every named
              client, price and outcome were unreachable on a phone. */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--marketing-border)] text-[var(--marketing-text)] transition hover:border-[var(--marketing-accent-border)] hover:bg-[var(--marketing-accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-accent)] md:hidden"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>

        {menuOpen ? (
          <div
            id={menuId}
            className="border-t border-[var(--marketing-border)] bg-white md:hidden"
          >
            <nav aria-label="Primary" className="mx-auto flex max-w-[1100px] flex-col px-6 py-2">
              {tokens.nav.map((item) =>
                renderNavItem(
                  item,
                  'border-b border-[var(--marketing-border)] py-4 text-base font-medium text-[var(--marketing-text)] last:border-b-0'
                )
              )}
              {tokens.crossLink ? (
                <Link
                  href={buildMarketingHref(tokens.crossLink.href, isLocalhost)}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-[var(--marketing-border)] py-4 text-base font-medium text-slate-500"
                >
                  {tokens.crossLink.label}
                </Link>
              ) : null}
              <div className="flex flex-col gap-3 py-4">
                <Link
                  href={buildMarketingHref(
                    tokens.cta?.href ?? '/contact',
                    isLocalhost
                  )}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full bg-[var(--marketing-accent)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[var(--marketing-accent-strong)]"
                >
                  {tokens.cta?.label ?? 'Work with us'}
                </Link>
                <Link
                  href={buildAppLoginHref(isLocalhost)}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-[var(--marketing-border)] px-5 py-3 text-center text-sm font-semibold text-[var(--marketing-text)] transition hover:border-[var(--marketing-accent-border)] hover:bg-[var(--marketing-accent-soft)]"
                >
                  Log in
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main>{children}</main>

      <footer className="border-t border-[var(--marketing-border)] bg-white">
        {/* The footer used to carry only contact and legal links, so on mobile,
            where the nav is behind a menu, there was no second route to the
            work. Every page now has a navigable floor. */}
        <div className="mx-auto max-w-[1100px] border-b border-[var(--marketing-border)] px-6 py-8 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Explore
          </p>
          <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
            {tokens.nav.map((item) =>
              item.external ? (
                <a
                  key={`footer-${item.href}`}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-[var(--marketing-text)]"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={`footer-${item.href}`}
                  href={navHref(item)}
                  className="transition hover:text-[var(--marketing-text)]"
                >
                  {item.label}
                </Link>
              )
            )}
            {tokens.crossLink ? (
              <Link
                href={buildMarketingHref(tokens.crossLink.href, isLocalhost)}
                className="transition hover:text-[var(--marketing-text)]"
              >
                {tokens.crossLink.label}
              </Link>
            ) : null}
            {tokens.track !== 'holdings' ? (
              <Link
                href={buildMarketingHref('/', isLocalhost)}
                className="transition hover:text-[var(--marketing-text)]"
              >
                Trailhead Holdings
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-6 py-8 text-sm text-slate-600 md:flex-row md:items-center md:justify-between md:px-8">
          <p>
            © 2026 Trailhead Holdings Ltd · Brentwood, Essex · Registered in
            England &amp; Wales
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href="mailto:info@trailheadholdings.uk"
              className="transition hover:text-[var(--marketing-text)]"
            >
              info@trailheadholdings.uk
            </a>
            <a
              href="tel:+447346808412"
              className="transition hover:text-[var(--marketing-text)]"
            >
              +44 7346 808412
            </a>
            <Link
              href={buildMarketingHref('/privacy', isLocalhost)}
              className="transition hover:text-[var(--marketing-text)]"
            >
              Privacy Policy
            </Link>
            <Link
              href={buildMarketingHref('/terms', isLocalhost)}
              className="transition hover:text-[var(--marketing-text)]"
            >
              Terms of Service
            </Link>
            <Link
              href={buildMarketingHref('/contact', isLocalhost)}
              className="transition hover:text-[var(--marketing-text)]"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
