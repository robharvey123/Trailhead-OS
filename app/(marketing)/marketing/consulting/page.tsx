import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { ProfessionalServiceJsonLd } from '@/components/JsonLd'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { absoluteUrl, buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Trailhead Commercial: NGP & FMCG Consulting',
  description:
    'Commercial strategy, market entry and route-to-market for nicotine, reduced-risk and FMCG brands. Thirteen years operating in the category, six markets, one exit.',
  path: '/consulting',
  // This page owns the consulting keyword pool; the homepage carries brand
  // terms only and /studio owns the software pool.
  keywords: [
    'nicotine pouch consultant',
    'NGP market entry',
    'FMCG route to market UK',
    'distributor strategy UK EU',
    'interim commercial director FMCG',
  ],
})

const stats = [
  ['13+', 'Years in NGP & FMCG'],
  ['6', 'International markets operated in'],
  ['£5M+', 'Revenue built from scratch'],
  ['1', 'Successful founder exit'],
]

const services = [
  {
    title: 'Market entry',
    description:
      'Taking a brand into a market it has never sold in. Regulatory lay of the land, distributor shortlist, pricing that survives the value chain, and the first orders on the board. UK, EU, DACH, Sweden.',
  },
  {
    title: 'Route to market',
    description:
      'Deciding which doors are worth knocking on and in what order. Channel strategy across D2C, retail and wholesale, and the commercial terms that make each one work rather than just look busy.',
  },
  {
    title: 'Pricing and portfolio',
    description:
      'Pricing architecture from factory gate to shelf, margin modelling for every party in the chain, and SKU rationalisation for ranges that grew faster than they were planned.',
  },
  {
    title: 'Interim commercial leadership',
    description:
      'Running the commercial function directly while you hire, or while the business is too early to justify a permanent director. Sales, distribution and the numbers that follow them.',
  },
]

// Live client engagements under Trailhead Commercial, kept separate from the
// employment history below. Everything in trackRecord is a role Rob held; a
// page made only of those reads as a CV rather than a consultancy, and a buyer
// cannot tell whether this is a going concern. One live engagement answers it.
//
// Mandate and scope only. Commercial terms, target account names and anything
// still under negotiation stay off a public page.
const currentWork = [
  {
    client: 'Qola',
    mandate: 'UK and EU commercial',
    period: 'Aug 2026 to date',
    summary:
      'Nicotine pouch brand entering the UK and EU. Route to market across distribution and retail, pricing architecture that holds through the value chain, and the named account work that turns a listing conversation into a first order. Initial term runs to November 2026.',
  },
]

const trackRecord = [
  {
    period: '2024–26',
    company: 'Dholakia Tobacco',
    role: 'Head of Sales and Business Development',
    summary:
      'RUSH and PAZ nicotine pouches. UK and EU expansion across DACH, Sweden, Italy, and South Africa.',
  },
  {
    period: '2023–24',
    company: 'RoarLabs',
    role: 'Chief Executive Officer',
    summary:
      'Built a reduced-risk nicotine brand from the ground up. Full UK launch delivered in six months.',
  },
  {
    period: '2022–23',
    company: 'Flonq',
    role: 'Head of Sales UK',
    summary:
      'UK market entry for e-cigarettes from zero. Retail and distribution coverage built within twelve months.',
  },
  {
    period: '2020–22',
    company: 'V&YOU',
    role: 'Head of Sales and Marketing',
    summary: '£1M+ annual revenue. National UK distribution secured through Unitas.',
  },
  {
    period: '2014–20',
    company: 'EOS Leisure',
    role: 'Founder and CCO',
    summary:
      "One of the UK's leading vaping and CBD companies. £1,500 start-up to £5M+ turnover. £4M raised. Successful exit in 2019.",
  },
]

const categories = [
  'Nicotine Pouches',
  'Vaping',
  'Caffeine Pouches',
  'CBD',
  'Reduced-Risk',
  'FMCG',
  'D2C',
  'UK and Europe',
]

// The shape of pricing, not a rate card. A brand owner deciding whether to
// start a conversation needs to know how the money works before they will.
const engagementShapes = [
  {
    title: 'Scoped project',
    shape: 'Fixed price, agreed in writing before work starts',
    description:
      'A defined piece of work with a defined end: a market entry plan, a distributor search, a pricing review. You see the price and the deliverable before you commit to either.',
  },
  {
    title: 'Interim leadership',
    shape: 'Monthly retainer against an agreed day commitment',
    description:
      'Running the commercial function while you hire, or while the business is too early to justify a permanent director. Reviewed quarterly, and built to make itself redundant.',
  },
  {
    title: 'Advisory',
    shape: 'Short and fixed-fee',
    description:
      'A second pair of eyes on a deal, a distributor negotiation or a market you are weighing up. Days rather than months, priced as such.',
  },
]

const faqs = [
  {
    question: 'Who actually does the work?',
    answer:
      'Rob Harvey. There is no account manager and no junior team. The person who scopes the work is the person who does it, which is the main reason the client list is short.',
  },
  {
    question: 'How do engagements usually start?',
    answer:
      'A conversation, then a written scope with a fixed price before anything is committed. Most start as a defined piece of work (a market entry plan, a pricing review), and some continue as an ongoing interim role.',
  },
  {
    question: 'Do you work outside nicotine and FMCG?',
    answer:
      'Sometimes, but the deep experience is in nicotine, reduced-risk and adjacent FMCG. If a brief sits outside that, we will say so rather than learn on your budget.',
  },
  {
    question: 'Is this related to the software side of the business?',
    answer:
      'They are separate lines of work with the same operator behind them. Occasionally they meet: a client needs an internal tool the market does not sell. When that happens we can build it. Neither is a route into selling the other.',
  },
]

export default async function ConsultingPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <ProfessionalServiceJsonLd
        name="Trailhead Commercial"
        description="NGP and FMCG commercial consulting: market entry, route to market, pricing and interim commercial leadership for nicotine and reduced-risk brands."
        url={absoluteUrl('/consulting')}
        serviceTypes={[
          'Market entry strategy',
          'Route to market and channel strategy',
          'Pricing and portfolio architecture',
          'Interim commercial leadership',
        ]}
      />
      <section className="scroll-mt-24 px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--marketing-accent)]">
              Trailhead Commercial
            </p>
            <h1 className="mt-5 text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
              You have a brand. It needs to sell somewhere it isn&rsquo;t selling
              yet.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Maybe that is a new market, a distributor who has gone quiet, or
              pricing that leaves nothing for anyone in the middle. Most advice
              in this category comes from people who have read about it. This
              comes from thirteen years of doing it &mdash; six markets, a brand
              taken from £1,500 to a £5M exit, and the distribution deals that
              made each of them work.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={buildMarketingHref('/contact?track=commercial', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full bg-[var(--marketing-accent)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--marketing-accent-strong)]"
              >
                Start a conversation
              </Link>
              <Link
                href={buildMarketingHref('/studio', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-[var(--marketing-accent-border)] hover:bg-[var(--marketing-accent-soft)]"
              >
                Looking for software instead?
              </Link>
            </div>
          </div>

          <dl className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-5 py-6"
              >
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block text-3xl font-bold tracking-[-0.03em]">{value}</span>
                  <span className="mt-2 block text-sm text-slate-600">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Reveal>
        <section
          id="services"
          className="scroll-mt-24 border-t border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-16 md:px-8 md:py-20"
        >
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              What we are usually brought in to do
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {services.map((service) => (
                <div
                  key={service.title}
                  className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7"
                >
                  <h3 className="text-xl font-bold tracking-[-0.02em]">{service.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{service.description}</p>
                </div>
              ))}
            </div>

            <div id="sectors" className="mt-10 flex scroll-mt-24 flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[var(--marketing-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section
          id="current-work"
          className="scroll-mt-24 border-t border-[var(--marketing-border)] px-6 py-16 md:px-8 md:py-20"
        >
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Current work
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              Live engagements, running now. Work in progress rather than a case
              study: results get published when there are results to publish.
            </p>

            <ul className="mt-10 space-y-4">
              {currentWork.map((entry) => (
                <li
                  key={entry.client}
                  className="rounded-[2rem] border border-[var(--marketing-accent-border)] bg-[var(--marketing-accent-soft)] p-6 md:p-7"
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-6">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-bold tracking-[-0.02em]">
                          {entry.client}
                        </h3>
                        <span className="rounded-full bg-[var(--marketing-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                          Live
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[var(--marketing-accent)]">
                        {entry.mandate}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-500">
                      {entry.period}
                    </p>
                  </div>
                  <p className="mt-4 leading-7 text-slate-600">{entry.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="track-record" className="scroll-mt-24 px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">Track record</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              The operating history behind the consultancy. Roles held, not
              clients billed. Every one is a real company with a real trading
              history, so look them up. That is rather the point of listing them.
            </p>

            <ol className="mt-10 space-y-4">
              {trackRecord.map((entry) => (
                <li
                  key={entry.company}
                  className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-6 md:p-7"
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-6">
                    <div>
                      <h3 className="text-xl font-bold tracking-[-0.02em]">{entry.company}</h3>
                      <p className="mt-1 text-sm font-semibold text-[var(--marketing-accent)]">{entry.role}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-500">{entry.period}</p>
                  </div>
                  <p className="mt-4 leading-7 text-slate-600">{entry.summary}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="border-t border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              How engagements are priced
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              Numbers depend on the brief, but the shape never changes: you see
              the price in writing before anything is committed, and nothing
              bills by the hour.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {engagementShapes.map((shape) => (
                <div
                  key={shape.title}
                  className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7"
                >
                  <h3 className="text-xl font-bold tracking-[-0.02em]">{shape.title}</h3>
                  <p className="mt-2 text-sm font-semibold text-[var(--marketing-accent)]">
                    {shape.shape}
                  </p>
                  <p className="mt-3 leading-7 text-slate-600">{shape.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Questions we get asked
            </h2>
            <div className="mt-8 space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-2xl border border-[var(--marketing-border)] bg-white px-6 py-5"
                >
                  <summary className="cursor-pointer list-none text-lg font-semibold tracking-[-0.01em] marker:content-none">
                    {faq.question}
                  </summary>
                  <p className="mt-3 leading-7 text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px] rounded-[2rem] bg-slate-950 px-8 py-14 text-white md:px-14">
            <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Tell us what the commercial problem actually is.
            </h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">
              Most engagements start with a business that knows its numbers are
              not where they should be but cannot yet name the reason. That is
              the conversation we are good at. You leave it with a written scope
              and a fixed price, whether or not you go ahead with us.
            </p>
            <Link
              href={buildMarketingHref('/contact?track=commercial', isLocalhost)}
              className="mt-9 inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Start a conversation
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  )
}
