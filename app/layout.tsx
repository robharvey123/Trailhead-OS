import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { SITE_URL, SITE_DEFAULTS } from '@/lib/seo'
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/JsonLd'

// The .thmock design system reads these two as --sans / --mono (app/globals.css).
// Loaded here via next/font so they are self-hosted and preloaded rather than
// pulled from fonts.googleapis.com with a render-blocking @import.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_DEFAULTS.name} | ${SITE_DEFAULTS.tagline}`,
    template: `%s | ${SITE_DEFAULTS.name}`,
  },
  description: SITE_DEFAULTS.description,
  applicationName: SITE_DEFAULTS.name,
  authors: [{ name: SITE_DEFAULTS.founder }],
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    siteName: SITE_DEFAULTS.name,
    locale: SITE_DEFAULTS.defaultLocale,
    url: SITE_URL,
    title: `${SITE_DEFAULTS.name} | ${SITE_DEFAULTS.tagline}`,
    description: SITE_DEFAULTS.description,
    // No explicit `images` here on purpose. app/opengraph-image.tsx generates
    // the real 1200x630 card and Next serves it via the file convention; an
    // explicit entry OVERRIDES that convention, and the path this used to
    // hardcode ('/opengraph-image.png') is a 404 — so every social card on
    // every route rendered blank.
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_DEFAULTS.name} | ${SITE_DEFAULTS.tagline}`,
    description: SITE_DEFAULTS.description,
    // Same reasoning as openGraph above — let the file convention supply it.
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  // verification: { google: 'REPLACE_WITH_GSC_TOKEN', other: { 'msvalidate.01': 'REPLACE_WITH_BING_TOKEN' } },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {/* Direction contract for the marketing surface (app/(marketing)).
            Emitted into the built markup so it can be audited after a
            production build. The OS app does not use this world. */}
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html: `<!--
IMPECCABLE DIRECTION CONTRACT · marketing surface · seed 19e1c14f

THESIS: Trailhead's job is getting a thing onto a shelf it is not on yet, so the
site IS the bay plan. It refuses the founder-consultancy default of white ground,
rounded cards and a blue accent; nothing floats and no claim appears without the
artifact that proves it.

OWN-WORLD: Plan stock (#E7EAE4) under black hairline rails with tick marks.
Facings divided by rule, never cards. White shelf-edge tickets with a mounting
notch carry codes, prices and dates in Martian Mono. Archivo across its width
axis is the only face: condensed heavy for display, normal for reading. Colour is
keyed data — ink blue Commercial, chrome yellow Studio, green Labs, and signal
red reserved for the price flash on every primary action.

STORY: A buyer sees a plan drawn by someone who works in their world, reads a
checkable fact under every claim, and starts a conversation in the right bay.

FIRST VIEWPORT: Rail with dimension callout under the header; ticket mounted at
left carrying the registration facts; condensed display headline black on stock;
below the second rail, two full-height brand blocks side by side, each with its
ticket, spec list and red price-flash CTA.

DEVIATION 2026-08-31 (FIRST VIEWPORT, partial): the two tickets and their
price-flash CTAs land at y=1206 at 1440x900, not above the fold. Closing that
gap requires deleting each block's four-line spec list, and those lines qualify
the buyer before the click — product truth outranks fold placement here. The
persuade requirement is met independently: a primary action ships in the header
on first paint, and both blocks read as distinct offers within the fold. The
clause above is unmet as written and is recorded, not rewritten.

FORM: The category manager's planogram. Candidate 6 of 7 on the grounded list;
assigned by seed 19e1c14f.

FINISH: code-led — no image generation in this harness, so no comp round; the
ambition lives in FIRST VIEWPORT and the rail readout.
-->`,
          }}
        />
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        {children}
        {/* Every toast.success/toast.error call site in the app depends on this
            being mounted. Without it sonner silently discards them all. */}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
