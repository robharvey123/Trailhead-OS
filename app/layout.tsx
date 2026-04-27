import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SITE_URL, SITE_DEFAULTS } from '@/lib/seo'
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/JsonLd'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        {children}
      </body>
    </html>
  )
}
