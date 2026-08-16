'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { buildAppLoginHref, buildMarketingHref } from '@/lib/site'

interface MarketingShellProps {
  children: ReactNode
  isLocalhost: boolean
}

const wrapperStyle = {
  '--marketing-text': '#0F172A',
  '--marketing-accent': '#0EA5E9',
  '--marketing-background': '#FFFFFF',
  '--marketing-surface': '#F8FAFC',
  '--marketing-border': '#E2E8F0',
} as CSSProperties

export default function MarketingShell({
  children,
  isLocalhost,
}: MarketingShellProps) {
  const [hasScrolled, setHasScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 10)

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close on route change, so back/forward navigation doesn't leave the panel
  // open. Render-time reset rather than setState-in-effect — the same pattern
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

  // The two lines of business are peers in the nav, then the things we sell.
  // Previously this listed four products at equal weight with no way to tell
  // consulting from builds, and Engineer OS — the only priced product with
  // paying customers — was absent entirely.
  const navItems = [
    { label: 'Consulting', href: buildMarketingHref('/consulting', isLocalhost) },
    {
      label: 'Web & App',
      href: buildMarketingHref('/web-app-design', isLocalhost),
    },
    { label: 'Products', href: buildMarketingHref('/products', isLocalhost) },
    { label: 'Blog', href: buildMarketingHref('/blog', isLocalhost) },
    { label: 'Contact', href: buildMarketingHref('/contact', isLocalhost) },
  ]

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
          <Link
            href={buildMarketingHref('/', isLocalhost)}
            className="flex items-center"
          >
            <img
              src="/logo.svg"
              alt="Trailhead Holdings"
              className="h-8 w-auto dark:hidden"
            />
            <img
              src="/logo-dark.svg"
              alt="Trailhead Holdings"
              className="hidden h-8 w-auto dark:block"
            />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-[var(--marketing-text)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <Link
              href={buildAppLoginHref(isLocalhost)}
              className="rounded-full border border-[var(--marketing-border)] px-4 py-2 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
            >
              Log in
            </Link>
          </div>

          {/* Below md the nav above is hidden. Without this trigger the header
              was a logo and nothing else, so /web-app-design — the page holding
              every named client, price and outcome — was unreachable on a phone. */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--marketing-border)] text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 md:hidden"
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
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-[var(--marketing-border)] py-4 text-base font-medium text-[var(--marketing-text)] last:border-b-0"
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 py-4">
                <Link
                  href={buildMarketingHref('/contact', isLocalhost)}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full bg-sky-700 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-800"
                >
                  Work with us
                </Link>
                <Link
                  href={buildAppLoginHref(isLocalhost)}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-[var(--marketing-border)] px-5 py-3 text-center text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
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
        {/* The footer used to carry only contact and legal links, so on mobile —
            where the nav is behind a menu — there was no second route to the
            work. Every page now has a navigable floor. */}
        <div className="mx-auto max-w-[1100px] border-b border-[var(--marketing-border)] px-6 py-8 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Explore
          </p>
          <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
            {navItems.map((item) => (
              <Link
                key={`footer-${item.href}`}
                href={item.href}
                className="transition hover:text-[var(--marketing-text)]"
              >
                {item.label}
              </Link>
            ))}
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
