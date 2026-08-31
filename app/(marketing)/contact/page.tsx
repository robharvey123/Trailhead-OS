import type { Metadata } from 'next'
import { headers } from 'next/headers'
import ContactDetailsCard from '@/components/marketing/ContactDetailsCard'
import ContactForm, { type ContactTrack } from '@/components/marketing/ContactForm'
import Reveal from '@/components/marketing/Reveal'
import { isLocalDevelopmentHost } from '@/lib/site'
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

const trackBay: Record<ContactTrack, string> = {
  commercial: 'BAY 01 · COMMERCIAL',
  studio: 'BAY 02 · STUDIO',
  labs: 'BAY 03 · LABS',
}

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
    <Reveal>
      <div className="pt-10 pb-16 md:pt-16 md:pb-20">
        <div className="bay">
          <div className="bay-code hidden lg:block">
            <p className="plan-note text-[var(--ink-3)]">Enquiry</p>
            <p className="plan-data mt-1 text-[var(--ink-3)]">
              {track ? trackBay[track] : 'ANY BAY'}
            </p>
          </div>

          <div className="min-w-0">
            <h1 className="plan-display rack max-w-[10ch]">Let&rsquo;s talk</h1>
            <p className="plan-lede mt-7">{track ? trackCopy[track] : defaultCopy}</p>

            <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
              <ContactForm track={track} />
              <ContactDetailsCard includeLegalNote isLocalhost={isLocalhost} />
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  )
}
