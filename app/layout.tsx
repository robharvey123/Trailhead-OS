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
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: SITE_DEFAULTS.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_DEFAULTS.name} | ${SITE_DEFAULTS.tagline}`,
    description: SITE_DEFAULTS.description,
    images: ['/opengraph-image.png'],
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
