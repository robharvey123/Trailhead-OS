'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
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

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 10)

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { label: 'Services', href: buildMarketingHref('/#services', isLocalhost) },
    {
      label: 'MVP Cricket',
      href: buildMarketingHref('/mvp-cricket', isLocalhost),
    },
    { label: 'Blog', href: buildMarketingHref('/blog', isLocalhost) },
    { label: 'Contact', href: buildMarketingHref('/#contact', isLocalhost) },
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
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-[var(--marketing-border)] bg-white">
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
