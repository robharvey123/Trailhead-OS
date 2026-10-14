import type { Metadata } from 'next'
import { headers } from 'next/headers'
import ContactDetailsCard from '@/components/marketing/ContactDetailsCard'
import ContactForm, { type ContactTrack } from '@/components/marketing/ContactForm'
import Reveal from '@/components/marketing/Reveal'
import { isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'
import { BreadcrumbJsonLd } from '@/components/JsonLd'

export const metadata: Metadata = buildMetadata({
  title: 'Contact Rob Harvey',
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

// What happens after the form is sent. Every step is a promise the site
// already makes elsewhere: the reply time on the contact card, the fixed-price
// scope on /consulting and /studio.
const nextSteps = [
  {
    code: '01',
    title: 'Rob reads it',
    body: 'Every enquiry goes to Rob Harvey, not a shared inbox or a sales team. You get a reply within 24 hours, UK working hours.',
  },
  {
    code: '02',
    title: 'A short call',
    body: 'Usually within a few working days, to understand the problem properly. If it is not a fit, you hear that on the call, with a pointer to someone better placed where we know one.',
  },
  {
    code: '03',
    title: 'A written scope',
    body: 'If it is a fit, a scope with a fixed price in writing. Nothing is committed and nothing bills until you agree to it.',
  },
]

// The four things that make a first reply useful, per track.
const briefs: Array<{ track: ContactTrack; title: string; points: string[] }> = [
  {
    track: 'commercial',
    title: 'Consulting',
    points: [
      'What you sell, and where it sells today',
      'The market or channel you are trying to get into',
      'What is getting in the way: distributors, pricing, listings',
      'Your timeline, and anything fixed like a launch date',
    ],
  },
  {
    track: 'studio',
    title: 'A software build',
    points: [
      'How the work runs today: the spreadsheet, the WhatsApp group',
      'What keeps breaking, and who it costs time',
      'Roughly what fixing it is worth to you',
      'Your timeline, and any system it has to work with',
    ],
  },
  {
    track: 'labs',
    title: 'One of our products',
    points: [
      'Which product: Engineer OS, MVP Cricket or MVP Predictor',
      'The size of your team or club',
      'What you use now, if anything',
      'When you would want to start',
    ],
  },
]

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
      <BreadcrumbJsonLd items={[{ name: 'Contact', path: '/contact' }]} />
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

      {/* ---- What happens next ---- */}
      <section className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">NEXT</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">After you send it</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">What happens next</h2>
            <ol className="facings mt-8 md:grid-cols-3">
              {nextSteps.map((step) => (
                <li key={step.code} className="facing bg-[var(--plan)]">
                  <p className="plan-data text-[var(--ink-3)]">STEP {step.code}</p>
                  <h3 className="plan-h3 mt-3">{step.title}</h3>
                  <p className="plan-body mt-3 plan-body-sm">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---- What to include, with the visitor's own track first ---- */}
      <section className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">BRIEF</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">4 lines each</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">What to put in the message</h2>
            <p className="plan-body mt-4">
              Four lines are enough for a useful first reply. If you are not
              sure what to say, start with the problem and leave the rest to
              the call.
            </p>
            <div className="facings mt-8 md:grid-cols-3">
              {[...briefs]
                .sort((a, b) => Number(b.track === track) - Number(a.track === track))
                .map((brief) => (
                  <div key={brief.track} className="facing">
                    <p className="plan-data text-[var(--ink-3)]">
                      {trackBay[brief.track]}
                    </p>
                    <h3 className="plan-h3 mt-3">{brief.title}</h3>
                    <ul className="mt-4">
                      {brief.points.map((point) => (
                        <li
                          key={point}
                          className="plan-body plan-body-sm border-t border-[var(--hair)] py-2"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  )
}
