'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { buildAppLoginHref, buildMarketingHref, WHATSAPP_HREF } from '@/lib/site'
import {
  BUSINESSES,
  UTILITY_NAV,
  getTrackTokens,
  trackFromPathname,
  type TrackNavItem,
} from '@/lib/marketing/tracks'

interface MarketingShellProps {
  children: ReactNode
  isLocalhost: boolean
}

/**
 * The site chrome: a navy glass header and a navy footer, both carrying the
 * reverse logo exactly as the brand guidelines draw it.
 *
 * Navigation is two-tier. The header carries the three businesses, always,
 * with the current one marked in brand blue; a slim bar beneath carries that
 * business's own sections where it has any.
 */

/** The reverse lockup: three pale bars, the tallest in brand blue, the
 * wordmark in Georgia. Colours and spacing follow Brand Guidelines v1.0. */
function TrailheadLogo() {
  return (
    <span className="flex items-center gap-3">
      <svg
        aria-hidden="true"
        width="34"
        height="28"
        viewBox="0 0 46 38"
        className="shrink-0"
      >
        <rect x="0" y="28" width="10" height="10" rx="2" fill="#F1F5F9" />
        <rect x="12" y="18" width="10" height="20" rx="2" fill="#F1F5F9" />
        <rect x="24" y="8" width="10" height="30" rx="2" fill="#F1F5F9" />
        <rect x="36" y="0" width="10" height="38" rx="2" fill="#0EA5E9" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-[Georgia,serif] text-[1.125rem] font-bold tracking-[-0.5px] text-[#F1F5F9]">
          Trailhead
        </span>
        <span className="mt-[5px] font-[Georgia,serif] text-[0.625rem] tracking-[1.5px] text-[#94A3B8]">
          HOLDINGS LTD
        </span>
      </span>
    </span>
  )
}
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
    'text-[0.875rem] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]'
  const footerLinkClass =
    'text-[0.9375rem] text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]'

  return (
    <div className="bay-plan min-h-screen" data-track={track}>
      <header className="th-dark sticky top-0 z-40 border-b border-white/10 bg-[rgba(11,17,32,0.94)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[72rem] items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <Link
            href={buildMarketingHref('/', isLocalhost)}
            aria-label="Trailhead Holdings, home"
          >
            <TrailheadLogo />
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {/* Tier one: the three businesses, constant everywhere. The active
                one carries a brand-blue rule. */}
            <nav aria-label="Businesses" className="flex items-center gap-6">
              {BUSINESSES.map((item) => {
                const active = item.track === track
                return (
                  <Link
                    key={item.href}
                    href={buildMarketingHref(item.href, isLocalhost)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative py-1.5 text-[0.875rem] font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:transition-colors ${
                      active
                        ? 'text-[var(--ink)] after:bg-[var(--blue)]'
                        : 'text-[var(--ink-2)] after:bg-transparent hover:text-[var(--ink)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <span aria-hidden="true" className="h-4 w-px bg-[var(--hair)]" />

            <nav aria-label="Secondary" className="flex items-center gap-6">
              {UTILITY_NAV.map((item) => renderNavItem(item, navLinkClass))}
            </nav>

            <div className="flex items-center gap-2.5">
              <Link
                href={buildAppLoginHref(isLocalhost)}
                className="rounded-full px-3.5 py-2 text-[0.875rem] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]"
              >
                Log in
              </Link>
              <Link
                href={buildMarketingHref(tokens.cta?.href ?? '/contact', isLocalhost)}
                className="flash !px-4 !py-2.5 !text-[0.875rem]"
              >
                {tokens.cta?.label ?? 'Start a conversation'}
              </Link>
            </div>
          </div>

          {/* Below lg the nav above is hidden, so this trigger is the only
              route to the rest of the site on a phone. */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--hair)] text-[var(--ink)] transition-colors hover:bg-white/10 lg:hidden"
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

        {/* Tier two: the sections of the business the visitor is in. */}
        {tokens.sections.length ? (
          <div className="hidden border-t border-white/[0.07] lg:block">
            <nav
              aria-label="Sections on this page"
              className="mx-auto flex w-full max-w-[72rem] items-center gap-6 px-8 py-2"
            >
              {tokens.sections.map((item) =>
                renderNavItem(
                  item,
                  'whitespace-nowrap text-[0.8125rem] text-[var(--ink-3)] transition-colors hover:text-[var(--flash)]'
                )
              )}
            </nav>
          </div>
        ) : null}

        {menuOpen ? (
          <div
            id={menuId}
            className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-[var(--hair)] bg-[var(--navy-deep)] lg:hidden"
          >
            <div className="mx-auto flex w-full max-w-[72rem] flex-col px-5">
              <nav aria-label="Businesses, mobile" className="flex flex-col">
                {BUSINESSES.map((item) => {
                  const active = item.track === track
                  return (
                    <Link
                      key={item.href}
                      href={buildMarketingHref(item.href, isLocalhost)}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between border-b border-[var(--hair)] py-4 font-[Georgia,serif] text-[1.375rem] font-bold tracking-[-0.01em] ${
                        active ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'
                      }`}
                    >
                      {item.label}
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="h-1 w-7 rounded-full bg-[var(--blue)]"
                        />
                      ) : null}
                    </Link>
                  )
                })}
              </nav>

              {tokens.sections.length ? (
                <nav
                  aria-label="Sections on this page, mobile"
                  className="flex flex-col border-b border-[var(--hair)] py-2 pl-4"
                >
                  {tokens.sections.map((item) =>
                    renderNavItem(
                      item,
                      'py-2.5 text-[0.9375rem] text-[var(--ink-3)]'
                    )
                  )}
                </nav>
              ) : null}

              <nav aria-label="Secondary, mobile" className="flex flex-col">
                {UTILITY_NAV.map((item) =>
                  renderNavItem(
                    item,
                    'border-b border-[var(--hair)] py-4 text-[1rem] font-medium text-[var(--ink-2)]'
                  )
                )}
              </nav>

              <div className="flex flex-col gap-3 py-6">
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
            </div>
          </div>
        ) : null}
      </header>

      <main>{children}</main>

      {/* The footer carries a second full route to every page: on mobile,
          where the nav sits behind a menu, it is the only one always in view. */}
      <footer className="th-dark border-t border-white/10 bg-[#070b16]">
        <div className="mx-auto w-full max-w-[72rem] px-5 pt-14 pb-10 md:px-8 md:pt-16">
          <div className="grid gap-10 border-b border-[var(--hair)] pb-12 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <Link
                href={buildMarketingHref('/', isLocalhost)}
                aria-label="Trailhead Holdings, home"
                className="inline-block"
              >
                <TrailheadLogo />
              </Link>
              <p className="mt-5 max-w-[26ch] font-[Georgia,serif] text-[1.125rem] leading-snug text-[var(--ink)]">
                Commercial strategy. Digital products. Built to last.
              </p>
            </div>

            <nav aria-label="Footer, businesses">
              <p className="plan-label text-[var(--ink-3)]">Businesses</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {BUSINESSES.map((item) => (
                  <li key={`footer-${item.href}`}>
                    <Link href={navHref(item)} className={footerLinkClass}>
                      Trailhead {item.label}
                    </Link>
                  </li>
                ))}
                {tokens.sections.map((item) => (
                  <li key={`footer-${item.href}`}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={footerLinkClass}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link href={navHref(item)} className={footerLinkClass}>
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Footer, company">
              <p className="plan-label text-[var(--ink-3)]">Company</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                <li>
                  <Link
                    href={buildMarketingHref('/', isLocalhost)}
                    className={footerLinkClass}
                  >
                    Home
                  </Link>
                </li>
                {UTILITY_NAV.map((item) => (
                  <li key={`footer-${item.href}`}>
                    {renderNavItem(item, footerLinkClass)}
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className="plan-label text-[var(--ink-3)]">Direct</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                <li>
                  <a
                    href="mailto:info@trailheadholdings.uk"
                    className={footerLinkClass}
                  >
                    info@trailheadholdings.uk
                  </a>
                </li>
                <li>
                  <a href="tel:+447346808412" className={footerLinkClass}>
                    +44 7346 808412
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={footerLinkClass}
                  >
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-[0.8125rem] text-[var(--ink-3)]">
              © 2026 Trailhead Holdings Ltd · Brentwood, Essex · Registered in
              England &amp; Wales
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                ['Privacy', '/privacy'],
                ['Terms', '/terms'],
                ['Contact', '/contact'],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={buildMarketingHref(href, isLocalhost)}
                  className="text-[0.8125rem] text-[var(--ink-3)] transition-colors hover:text-[var(--flash)]"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
