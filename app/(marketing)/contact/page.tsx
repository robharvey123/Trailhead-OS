import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import ContactDetailsCard from '@/components/marketing/ContactDetailsCard'
import ContactForm, { type ContactTrack } from '@/components/marketing/ContactForm'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Contact Trailhead Holdings',
  description:
    'Talk to Rob Harvey about NGP and FMCG commercial strategy, a bespoke software build, or one of the Trailhead Labs products. UK-based, replies within 24 hours.',
  path: '/contact',
})

// Track-specific lead copy so a visitor arriving from /consulting or /studio
// is asked about their problem, not offered the whole holdco again.
const trackCopy: Record<ContactTrack, string> = {
  commercial:
    'Tell us about the brand, the markets you are weighing up, and the timing. You leave the first conversation with a written scope and a fixed price, whether or not you go ahead.',
  studio:
    'Tell us what the work looks like today: the spreadsheet, the WhatsApp group, the thing that keeps breaking. Add roughly what fixing it is worth to you. You leave with a written scope either way.',
  labs: 'Tell us which product you are interested in and a little about your team or club, and we will point you at the right place.',
}

const defaultCopy =
  "Whether you're looking for commercial consultancy, a development partner, or just want to find out more, we'd love to hear from you."

function parseTrack(value: string | string[] | undefined): ContactTrack | undefined {
  return value === 'commercial' || value === 'studio' || value === 'labs'
    ? value
    : undefined
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const track = parseTrack((await searchParams).track)

  return (
    <Reveal className="px-6 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-[1100px]">
        <Link
          href={buildMarketingHref('/', isLocalhost)}
          className="inline-flex items-center text-sm font-semibold text-slate-600 transition hover:text-[var(--marketing-text)]"
        >
          ← Back to home
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.75fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
              Get in touch
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-[var(--marketing-text)] md:text-5xl">
              Let&apos;s talk
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {track ? trackCopy[track] : defaultCopy}
            </p>
            <div className="mt-10">
              <ContactForm track={track} />
            </div>
          </div>

          <ContactDetailsCard includeLegalNote isLocalhost={isLocalhost} />
        </div>
      </div>
    </Reveal>
  )
}
