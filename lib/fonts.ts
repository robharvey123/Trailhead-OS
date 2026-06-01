import { Syne, DM_Mono } from 'next/font/google'

// Mockup typography (scoped to /crm and /timesheet via the .thmock wrapper).
export const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

export const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const mockupFontVars = `${syne.variable} ${dmMono.variable}`
