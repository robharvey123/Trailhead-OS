'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { buildAppLoginHref, buildMarketingHref } from '@/lib/site'
import {
  getTrackTokens,
  trackFromPathname,
  type TrackNavItem,
} from '@/lib/marketing/tracks'

interface MarketingShellProps {
  children: ReactNode
  isLocalhost: boolean
}

/**
 * The chrome is the top rail of the bay plan.
 *
 * One shell, three sub-brands. The pathname decides which block colour the
 * chrome is keyed to, so a visitor on /consulting is standing in front of the
 * Commercial bay and a visitor on /studio in front of Studio's, without the
 * site splitting into two codebases.
 */
export default function MarketingShell({
  children,
  isLocalhost,
}: MarketingShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  const track = trackFromPathname(pathname)
  const tokens = getTrackTokens(track)

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

  const navLinkClass =
    'plan-label text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]'

  return (
    <div className="bay-plan min-h-screen" data-track={track}>
      <header className="sticky top-0 z-40 bg-[var(--plan)]">
        <div className="mx-auto flex w-full max-w-[78rem] items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <Link
            href={buildMarketingHref('/', isLocalhost)}
            className="flex items-center gap-3"
            aria-label={`Trailhead ${tokens.wordmark.replace(' LTD', '')}, home`}
          >
            {/* Four ascending bars, the last one carrying the track's key. The
                mark is a fixed brand commitment; only its keyed bar moves. */}
            <svg
              aria-hidden="true"
              width="30"
              height="34"
              viewBox="0 0 46 48"
              className="shrink-0"
            >
              <rect x="0" y="28" width="10" height="10" rx="2" fill="var(--ink)" />
              <rect x="12" y="18" width="10" height="20" rx="2" fill="var(--ink)" />
              <rect x="24" y="8" width="10" height="30" rx="2" fill="var(--ink)" />
              <rect x="36" y="0" width="10" height="38" rx="2" fill="var(--key-deep)" />
            </svg>
            <span className="flex flex-col leading-none">
              <span
                className="text-[1.0625rem] font-bold tracking-[0.02em] text-[var(--ink)]"
                style={{ fontStretch: '84%' }}
              >
                TRAILHEAD
              </span>
              <span className="plan-label mt-[3px] text-[var(--ink-3)]">
                {tokens.wordmark}
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <nav aria-label="Primary" className="flex items-center gap-5">
              {tokens.nav.map((item) => renderNavItem(item, navLinkClass))}
              {tokens.crossLink ? (
                <Link
                  href={buildMarketingHref(tokens.crossLink.href, isLocalhost)}
                  className="plan-label text-[var(--ink-3)] transition-colors hover:text-[var(--flash)]"
                >
                  {tokens.crossLink.label}
                </Link>
              ) : null}
            </nav>

            {tokens.cta ? (
              <Link href={buildMarketingHref(tokens.cta.href, isLocalhost)} className="flash">
                {tokens.cta.label}
              </Link>
            ) : null}

            <Link
              href={buildAppLoginHref(isLocalhost)}
              className="plan-label border border-[var(--hair)] px-3 py-2 text-[var(--ink-2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
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
            className="flex h-11 w-11 items-center justify-center border border-[var(--ink)] text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--plan)] md:hidden"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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

        {/* The rail. Every band on every page hangs from this line, and it
            prints which bay the visitor is standing in. */}
        <div className="rail bg-[var(--plan)]">
          <div className="mx-auto flex w-full max-w-[78rem] items-center justify-between gap-4 px-5 pt-2 pb-1.5 md:px-8">
            <span className="plan-data truncate text-[var(--ink-3)]">
              {tokens.bayCode}
              <span className="mx-2 text-[var(--hair)]">|</span>
              {tokens.bayMeasure}
            </span>

            {/* The dimension callout: a measured span with extension ticks and
                arrowheads, the way a bay width is called out on a plan. It is
                drawn, not lettered — the contract asked for a dimension and a
                text strip is not one. */}
            <span className="hidden flex-1 items-center gap-2 px-4 sm:flex">
              <svg
                aria-hidden="true"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                className="h-3 w-full text-[var(--hair)]"
              >
                <path
                  d="M1 0v12M199 0v12"
                  stroke="currentColor"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M1 6h198M5 3L1 6l4 3M195 3l4 3-4 3"
                  stroke="currentColor"
                  strokeWidth="1"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </span>

            <span className="plan-data hidden shrink-0 text-[var(--ink-3)] sm:block">
              TRAILHEADHOLDINGS.UK
            </span>
          </div>
        </div>

        {menuOpen ? (
          <div id={menuId} className="border-t border-[var(--ink)] bg-[var(--plan)] md:hidden">
            <nav
              aria-label="Primary, mobile"
              className="mx-auto flex w-full max-w-[78rem] flex-col px-5"
            >
              {tokens.nav.map((item) =>
                renderNavItem(
                  item,
                  'plan-label border-b border-[var(--hair)] py-4 text-[var(--ink)]'
                )
              )}
              {tokens.crossLink ? (
                <Link
                  href={buildMarketingHref(tokens.crossLink.href, isLocalhost)}
                  onClick={() => setMenuOpen(false)}
                  className="plan-label border-b border-[var(--hair)] py-4 text-[var(--ink-3)]"
                >
                  {tokens.crossLink.label}
                </Link>
              ) : null}
              <div className="flex flex-col gap-3 py-5">
                <Link
                  href={buildMarketingHref(tokens.cta?.href ?? '/contact', isLocalhost)}
                  onClick={() => setMenuOpen(false)}
                  className="flash justify-center"
                >
                  {tokens.cta?.label ?? 'Start a conversation'}
                </Link>
                <Link
                  href={buildAppLoginHref(isLocalhost)}
                  onClick={() => setMenuOpen(false)}
                  className="flash-ghost justify-center"
                >
                  Log in
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main>{children}</main>

      {/* The footer is the bottom rail: the plan's title block, carrying the
          registration facts and a second full route to every page — on mobile,
          where the nav sits behind a menu, this is the only one always in view. */}
      <footer className="rail mt-0 bg-[var(--plan-recess)]">
        <div className="mx-auto w-full max-w-[78rem] px-5 py-10 md:px-8 md:py-12">
          <div className="grid gap-8 border-b border-[var(--hair)] pb-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="plan-data text-[var(--ink-3)]">INDEX</p>
              <nav
                aria-label="Footer"
                className="mt-3 flex flex-wrap gap-x-6 gap-y-3"
              >
                {tokens.nav.map((item) =>
                  item.external ? (
                    <a
                      key={`footer-${item.href}`}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={navLinkClass}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={`footer-${item.href}`}
                      href={navHref(item)}
                      className={navLinkClass}
                    >
                      {item.label}
                    </Link>
                  )
                )}
                {tokens.crossLink ? (
                  <Link
                    href={buildMarketingHref(tokens.crossLink.href, isLocalhost)}
                    className={navLinkClass}
                  >
                    {tokens.crossLink.label}
                  </Link>
                ) : null}
                {tokens.track !== 'holdings' ? (
                  <Link
                    href={buildMarketingHref('/', isLocalhost)}
                    className={navLinkClass}
                  >
                    Trailhead Holdings
                  </Link>
                ) : null}
              </nav>
            </div>

            <div className="md:text-right">
              <p className="plan-data text-[var(--ink-3)]">DIRECT</p>
              <div className="mt-3 flex flex-col gap-2 md:items-end">
                <a
                  href="mailto:info@trailheadholdings.uk"
                  className="plan-label text-[var(--ink)] transition-colors hover:text-[var(--flash)]"
                >
                  info@trailheadholdings.uk
                </a>
                <a
                  href="tel:+447346808412"
                  className="plan-label text-[var(--ink)] transition-colors hover:text-[var(--flash)]"
                >
                  +44 7346 808412
                </a>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-baseline md:justify-between">
            <p className="plan-data text-[var(--ink-3)]">
              © 2026 TRAILHEAD HOLDINGS LTD · BRENTWOOD, ESSEX · REGISTERED IN
              ENGLAND &amp; WALES
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link
                href={buildMarketingHref('/privacy', isLocalhost)}
                className={navLinkClass}
              >
                Privacy
              </Link>
              <Link
                href={buildMarketingHref('/terms', isLocalhost)}
                className={navLinkClass}
              >
                Terms
              </Link>
              <Link
                href={buildMarketingHref('/contact', isLocalhost)}
                className={navLinkClass}
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
