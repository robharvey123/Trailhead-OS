import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
import PlateSlot from '@/components/marketing/PlateSlot'
import Reveal from '@/components/marketing/Reveal'
import { AboutPageJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { absoluteUrl, buildMetadata, SITE_DEFAULTS } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'About Rob Harvey, Founder',
  description:
    'Rob Harvey has worked in nicotine and FMCG sales since 2013. Trailhead Holdings is the company he runs: a consultancy, a software studio and three products.',
  path: '/about',
  // This page owns the "who is behind it" queries. Service keywords stay with
  // /consulting and /studio.
  keywords: [
    'Rob Harvey',
    'Rob Harvey NGP',
    'about Trailhead Holdings',
    'Trailhead Holdings Ltd',
  ],
})

// Every line here is a public, checkable fact. Companies House is linked rather
// than reprinted: the register is the primary source and its details change
// between filings.
const COMPANIES_HOUSE_URL =
  'https://find-and-update.company-information.service.gov.uk/company/16910286'

const registration = [
  ['COMPANY', 'Trailhead Holdings Ltd'],
  ['NUMBER', '16910286'],
  ['INCORPORATED', '15 DEC 2025'],
  ['TRADING', 'SINCE NOV 2025'],
  ['REGISTERED', 'ENGLAND & WALES'],
  ['BASED', 'BRENTWOOD, ESSEX'],
]

// The three tracks, one line each. The detail lives on each track's own page.
const tracks = [
  {
    code: 'BAY 01',
    name: 'Trailhead Commercial',
    line: 'Market entry, route to market, pricing and interim commercial leadership for nicotine, reduced-risk and FMCG brands.',
    href: '/consulting',
  },
  {
    code: 'BAY 02',
    name: 'Trailhead Studio',
    line: 'Bespoke software for businesses that have outgrown spreadsheets, WhatsApp and memory. Built in-house; you own the code.',
    href: '/studio',
  },
  {
    code: 'BAY 03',
    name: 'Trailhead Labs',
    line: 'Products we own and run: Engineer OS and MVP Cricket, both live with paying customers, and MVP Predictor in build.',
    href: '/labs',
  },
]

// The career in one column. The full elevation, with tenure to scale, is on
// /consulting#track-record; this is the summary that links to it.
const timeline = [
  { period: '2025–', company: 'Trailhead Holdings', role: 'Founder and Director', current: true },
  { period: '2024–26', company: 'Dholakia Tobacco', role: 'Head of Sales and Business Development' },
  { period: '2023–24', company: 'RoarLabs', role: 'Chief Executive Officer' },
  { period: '2022–23', company: 'Flonq', role: 'Head of Sales UK' },
  { period: '2020–22', company: 'V&YOU', role: 'Head of Sales and Marketing' },
  { period: '2013–20', company: 'EOS Leisure', role: 'Founder and CCO. Exit in 2019' },
]

// How the business runs. Each of these is already promised on a track page;
// collected here because they are true of the whole company.
const principles = [
  {
    code: 'OP-01',
    title: 'The person who scopes it does it',
    body: 'There is no account manager and no junior team. You deal with Rob from the first call to the last invoice.',
  },
  {
    code: 'OP-02',
    title: 'Price in writing first',
    body: 'Every engagement starts with a written scope and a fixed price. Nothing bills by the hour.',
  },
  {
    code: 'OP-03',
    title: 'Say no to the wrong brief',
    body: 'If work sits outside what we know, we say so rather than learn on your budget.',
  },
]

export default async function AboutPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const linkedIn = SITE_DEFAULTS.sameAs[0]

  return (
    <div>
      <BreadcrumbJsonLd items={[{ name: 'About', path: '/about' }]} />
      <AboutPageJsonLd url={absoluteUrl('/about')} />

      {/* ---- Hero: the operator, because the operator is the company ---- */}
      <section className="pt-10 pb-10 md:pt-16 md:pb-12">
        <div className="bay">
          <div className="bay-code hidden lg:block">
            <p className="plan-data text-[var(--ink-3)]">BAY 00</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">About</p>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
            <div className="min-w-0">
              <h1 className="plan-display rack max-w-[16ch]">
                One operator. Thirteen years in hard markets.
              </h1>
              <p className="plan-lede mt-7">
                Trailhead Holdings is run by Rob Harvey. He has worked in
                nicotine and reduced-risk products since 2013: founding a vaping
                company and taking it from £1,500 to a £5M exit, then leading
                sales and market entry for brands across six markets. Trailhead
                is what he built next, a consultancy and a software studio run
                by the same person.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={buildMarketingHref('/contact', isLocalhost)}
                  className="flash justify-center"
                >
                  Start a conversation
                </Link>
                {linkedIn ? (
                  <a
                    href={linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flash-ghost justify-center"
                  >
                    Rob on LinkedIn
                  </a>
                ) : null}
              </div>
            </div>

            <div className="lg:pt-2">
              <PlateSlot
                src="/rob-harvey.webp"
                alt="Rob Harvey, arms folded at a stand table"
                width={1066}
                height={1600}
                className="max-w-[15rem]"
                sizes="15rem"
                priority
              />
              <div className="ticket mt-4 max-w-[15rem]">
                <p className="plan-label text-[var(--ink)]">Rob Harvey</p>
                <p className="plan-data mt-1.5 text-[var(--ink-3)]">
                  FOUNDER AND DIRECTOR
                </p>
                <p className="plan-data ticket-rule text-[var(--ink-2)]">
                  IN NGP SINCE 2013
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Why it exists ---- */}
      <Reveal className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">ORIGIN</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Why it exists</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target max-w-[22ch]">
              The bottleneck was almost never the product.
            </h2>
            <div className="mt-6 space-y-4">
              <p className="plan-body">
                Restricted categories are a hard school. Advertising is limited
                or closed, listings are fought over by better-funded incumbents,
                and compliance sits on every claim and every pack. You cannot buy
                your way to attention, so you earn distribution by knowing the
                route to market, the distributor&rsquo;s economics, and what the
                buyer needs to justify the listing.
              </p>
              <p className="plan-body">
                Thirteen years of field sales, national accounts and distributor
                management kept showing the same thing. Brands with good products
                stalled on the commercial process around them: pricing in a
                spreadsheet on one laptop, orders taken over WhatsApp, a pipeline
                that lived in someone&rsquo;s head.
              </p>
              <p className="plan-body">
                Advising people to fix that only goes so far. Trailhead does both:
                the commercial work, and the software that keeps it running once
                the work is done.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- What it runs: three facings, one per track ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">TRACKS</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">3 facings</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">What the company runs</h2>
            <div className="facings mt-8 md:grid-cols-3">
              {tracks.map((track) => (
                <Link
                  key={track.name}
                  href={buildMarketingHref(track.href, isLocalhost)}
                  className="facing group flex flex-col bg-[var(--plan)] transition-colors hover:bg-[var(--card)]"
                >
                  <p className="plan-data text-[var(--ink-3)]">{track.code}</p>
                  <h3 className="plan-h3 mt-3">{track.name}</h3>
                  <p className="plan-body mt-3 flex-1 plan-body-sm">
                    {track.line}
                  </p>
                  <p className="plan-label mt-6 inline-flex items-center gap-2 border-t border-[var(--hair)] pt-3 text-[var(--ink)]">
                    Visit
                    <PlanIcon
                      name="right"
                      size={13}
                      className="text-[var(--flash)] transition-transform group-hover:translate-x-0.5"
                    />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Career, summarised ---- */}
      <Reveal className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">CAREER</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">2013–26</p>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="plan-h2 rack-target">Where the experience comes from</h2>
              <Link
                href={buildMarketingHref('/consulting#track-record', isLocalhost)}
                className="plan-label inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]"
              >
                Full track record
                <PlanIcon name="right" size={13} />
              </Link>
            </div>
            <ol className="mt-8 border-t border-[var(--ink)]">
              {timeline.map((entry) => (
                <li
                  key={entry.company}
                  className="grid gap-x-8 gap-y-1 border-b border-[var(--hair)] py-4 md:grid-cols-[7.5rem_minmax(0,14rem)_minmax(0,1fr)] md:items-baseline"
                >
                  <span className="plan-data text-[var(--ink-2)]">
                    {entry.period}
                  </span>
                  <span className="plan-h3">{entry.company}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="plan-body plan-body-sm">{entry.role}</span>
                    {entry.current ? (
                      <span className="key-state key-live">Current</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>

      {/* ---- How it works, plus the registration ticket ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">TERMS</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">On record</p>
          </div>
          <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">
              <h2 className="plan-h2 rack-target">How the business works</h2>
              <div className="facings mt-8">
                {principles.map((item) => (
                  <div key={item.code} className="facing bg-[var(--plan)]">
                    <p className="plan-data text-[var(--ink-3)]">{item.code}</p>
                    <h3 className="plan-h3 mt-3">{item.title}</h3>
                    <p className="plan-body mt-3 plan-body-sm">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* The checkable facts, on a ticket, with the primary source. */}
            <div className="lg:pt-2">
              <div className="ticket">
                <p className="plan-label text-[var(--ink)]">On public record</p>
                <dl className="ticket-rule space-y-2">
                  {registration.map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <dt className="plan-data text-[var(--ink-3)]">{label}</dt>
                      <dd className="plan-data text-right text-[var(--ink)]">
                        {value.toUpperCase()}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="ticket-rule">
                  <a
                    href={COMPANIES_HOUSE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="plan-label inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]"
                  >
                    Check it on Companies House
                    <PlanIcon name="right" size={13} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Close ---- */}
      <Reveal className="rail">
        <div className="bay py-14 md:py-20">
          <div className="bay-code">
            <p className="plan-note text-[var(--ink-3)]">End of bay</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target max-w-[20ch]">
              Talk to the person who would do the work.
            </h2>
            <p className="plan-lede mt-6">
              Whether it is a market you are trying to get into or a process
              that has outgrown its spreadsheet, the first conversation costs
              nothing and ends with a written scope.
            </p>
            <div className="ticket mt-9 max-w-md">
              <p className="plan-data text-[var(--ink-3)]">
                NO FEE FOR THE FIRST CONVERSATION
              </p>
              <div className="ticket-rule">
                <Link
                  href={buildMarketingHref('/contact', isLocalhost)}
                  className="flash"
                >
                  Start a conversation
                  <PlanIcon name="right" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
