import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trailhead Holdings',
  description: 'Commercial strategy. Digital products. Built to last.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
