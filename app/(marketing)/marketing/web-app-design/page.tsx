import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Website & App Design and Development',
  description:
    'Trailhead designs and builds websites, web apps and mobile-first products for UK businesses. See the work: Engineer OS, BrightFire, Trailhead OS, MVP Cricket.',
  path: '/web-app-design',
  keywords: [
    'website design UK',
    'bespoke app development UK',
    'web app development Essex',
    'custom software development for SMEs',
    'progressive web app developer UK',
    'SaaS product development UK',
  ],
})

const stats = [
  ['5', 'Products designed and shipped'],
  ['3', 'Live in production today'],
  ['1', 'Client build productised into SaaS'],
  ['0', 'Agencies or offshore teams involved'],
]

const capabilities = [
  {
    title: 'Marketing websites',
    description:
      'Fast, accessible, search-ready sites that load in under a second and read well on a phone. Built on modern frameworks rather than a page builder, so the site stays quick and the content stays yours.',
    points: ['Next.js or static build', 'SEO and schema built in', 'CMS where you need one', 'Analytics and conversion tracking'],
  },
  {
    title: 'Web apps and internal tools',
    description:
      'The system your business actually runs on. Job tracking, client portals, dashboards, approval flows, anything that currently lives across a spreadsheet, an inbox and a WhatsApp group.',
    points: ['Role-based access', 'Real-time data', 'Reporting and exports', 'Audit trails'],
  },
  {
    title: 'Mobile-first PWAs',
    description:
      'Installable apps that work on a bad 4G signal and sync when the van is back in range. No app store review cycle, no separate iOS and Android codebase to maintain.',
    points: ['Offline-first architecture', 'Installs to the home screen', 'Camera and signature capture', 'Push notifications'],
  },
  {
    title: 'SaaS products',
    description:
      'End to end: positioning, pricing model, onboarding, billing, and the product itself. We have taken our own products from blank page to paying customers, so this is not theory.',
    points: ['Multi-tenant from day one', 'Stripe billing and trials', 'Self-serve onboarding', 'Usage analytics'],
  },
  {
    title: 'Design systems and UI',
    description:
      'A consistent visual language across every screen, defined in code rather than a static file. New features look like they belong without a designer redrawing them each time.',
    points: ['Component library', 'Design tokens', 'Light and dark themes', 'Accessible by default'],
  },
  {
    title: 'Integrations and automation',
    description:
      'Software is only useful when it talks to the rest of your stack. We wire products into the tools you already pay for, and automate the handoffs that currently cost someone an afternoon.',
    points: ['Stripe, Xero, QuickBooks', 'Gmail and Google Calendar', 'Webhooks and public APIs', 'Scheduled jobs and alerts'],
  },
]

const process = [
  {
    step: '01',
    title: 'Discovery',
    description:
      'A structured conversation about how the work moves through your business today, where it sticks, and what a fix is actually worth. You leave with a written scope whether or not you hire us.',
  },
  {
    step: '02',
    title: 'Design',
    description:
      'Screens and flows before code. You see and react to the real thing early, when changes are cheap, rather than signing off a wireframe and hoping.',
  },
  {
    step: '03',
    title: 'Build',
    description:
      'Shipped in working slices, not one big reveal at the end. You get a live URL from the first week and watch it fill in, so nothing is a surprise at handover.',
  },
  {
    step: '04',
    title: 'Launch',
    description:
      'Deployment, domains, email, analytics, and your data migrated in. We do the setup rather than handing you a checklist.',
  },
  {
    step: '05',
    title: 'Iterate',
    description:
      'Software is never finished. Ongoing support and a steady release rhythm, or a clean handover with documentation if you would rather take it in-house.',
  },
]

type Project = {
  name: string
  sector: string
  status: 'Live' | 'In build'
  headline: string
  problem: string
  built: string[]
  stack: string[]
  outcome: string
  href?: string
  hrefLabel?: string
  internal?: boolean
}

const projects: Project[] = [
  {
    name: 'Engineer OS',
    sector: 'Field service software',
    status: 'Live',
    headline: 'A job management platform for UK field service teams.',
    problem:
      'Small field service firms run on a mix of WhatsApp groups, Word templates and a filing cabinet. The work is rarely the hard part. Proving it happened, on time, to whoever is asking, is what costs them. Existing platforms were built for fleets ten times their size and priced accordingly.',
    built: [
      'Mobile-first PWA that installs to an engineer’s home screen and works with no signal, syncing when the van is back in range',
      'Configurable digital forms with photo capture and drawn signatures that generate a branded PDF certificate automatically',
      'Asset and site records, so every unit carries its own service history and an audit is one click rather than an afternoon',
      'Certificate expiry tracking that surfaces renewals as a reminder rather than a surprise',
      'Quoting and invoicing with Xero and QuickBooks sync, plus dashboards for utilisation, SLA performance and job profitability',
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind', 'Supabase', 'Stripe', 'Vercel'],
    outcome:
      'Live and selling at engineeros.uk on per-engineer pricing from £15 a month, with a 14-day trial and same-day setup. A typical ten-engineer team is onboarded inside a week, customer data imported and forms rebuilt as part of the setup.',
    href: 'https://engineeros.uk',
    hrefLabel: 'Visit engineeros.uk',
  },
  {
    name: 'BrightFire',
    sector: 'Fire & security contractor',
    status: 'Live',
    headline: 'The bespoke build that became a product.',
    problem:
      'Bright Fire Services, a fire and security contractor in Harlow, was tracking jobs across a WhatsApp group, a Word template and a shared drive. Certificates were retyped in the office from paper brought back off site. When a client’s insurer asked them to prove every alarm on a site had been serviced on time, assembling the evidence took most of a day.',
    built: [
      'Job scheduling and dispatch from a calendar view, with live schedule updates pushed to engineers through the day',
      'Digital job sheets replacing paper forms, completed on a phone at the panel with photos and signature attached',
      'Offline-first sync so records survive a basement with no signal',
      'Full customer and site history, accessible in the field rather than from a filing cabinet',
    ],
    stack: ['PWA', 'Next.js', 'TypeScript', 'Supabase', 'Offline sync'],
    outcome:
      'Paperwork now lands in the office before the engineer has left the car park. The build worked well enough that we productised it into Engineer OS and took it to market — the clearest proof we know how to design software for a trade rather than for a demo.',
    href: '/bright-fire',
    hrefLabel: 'See the BrightFire page',
    internal: true,
  },
  {
    name: 'Trailhead OS',
    sector: 'Business operating system',
    status: 'Live',
    headline: 'The system that runs this business, built from scratch.',
    problem:
      'Running a consultancy and a software studio across five workstreams meant a project tool, a separate CRM, a spreadsheet for invoices, an inbox for everything else, and no single view of any of it. Off-the-shelf platforms each solved a third of the problem and none of them talked to the others.',
    built: [
      'Project boards with drag-and-drop kanban, Gantt timelines, dependencies and milestones across five workstreams',
      'Full CRM — accounts, contacts, enquiries, deals and a public discovery form feeding straight into the pipeline',
      'Quoting and invoicing with PDF export, Stripe payment links, automatic reconciliation on payment and recurring subscriptions',
      'Two-way Google Calendar sync, Gmail threads linked to CRM contacts, and an iCal feed for Apple Calendar',
      'AI scope and quote generation that reads a submitted discovery form and returns a priced scope with a complexity breakdown',
      'Web push notifications, shareable client report links with token expiry, and a bearer-token API for programmatic access',
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind', 'Supabase', 'Stripe', 'Claude API', 'Vercel'],
    outcome:
      'In production at app.trailheadholdings.uk and used every working day. It replaced four subscriptions and is the reference build we point clients at when they ask whether we can handle something with real operational depth.',
  },
  {
    name: 'MVP Cricket',
    sector: 'Sports SaaS',
    status: 'Live',
    headline: 'A SaaS platform for grassroots cricket clubs.',
    problem:
      'Grassroots clubs want to recognise player contribution and keep members engaged across a season, but the admin sits with one volunteer and a spreadsheet. Scoring gets done late, or not at all, and the thing that would keep players checking in never quite happens.',
    built: [
      'Automated MVP scoring engine built around how clubs actually recognise contributions, not just runs and wickets',
      'Live Play-Cricket integration pulling fixtures and results in without extra admin',
      'Player and club leaderboards with live standings and weekly snapshots',
      'Multi-club support for leagues and groups running more than one team',
    ],
    stack: ['Next.js', 'TypeScript', 'Supabase', 'Stripe', 'Play-Cricket API'],
    outcome:
      'Live at mvpcricket.app on tiered subscription pricing from £19 a month, with a custom tier for multi-club operators. A worked example of taking a product from idea to billing customers without outside investment.',
    href: 'https://mvpcricket.app',
    hrefLabel: 'Visit mvpcricket.app',
  },
  {
    name: 'Yasin & Co Solicitors',
    sector: 'Legal services',
    status: 'In build',
    headline: 'A full rebuild for a London law firm.',
    problem:
      'A ten-practice-area solicitors firm in Forest Gate running on an ageing WordPress build. The site looked reasonable on the surface but the code underneath was slow, hard to change and holding back search performance. Every content update meant a developer.',
    built: [
      'Full technical and content audit delivered as a written report before any commercial conversation',
      'Rebuild on a modern framework for speed, Core Web Vitals and structured data across all ten practice areas',
      'Service pages restructured around what clients actually search for, with enquiry capture on every one',
      'A second site aimed at overseas clients scoped as an optional phase',
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind', 'CMS', 'Vercel'],
    outcome:
      'Audit delivered and scope agreed across three costed options. Currently in build — we will publish the before-and-after numbers when it ships.',
  },
]

const concepts = [
  {
    name: 'Dental practice',
    accent: 'bg-[linear-gradient(180deg,#F0F9FF_0%,#DBEAFE_100%)]',
    description:
      'Private practice site built around one job: getting a nervous first-time patient to book. Treatment pages priced openly, finance options up front, and a booking flow that never asks for more than a name and a number.',
    features: ['Online booking', 'Transparent pricing', 'Before-and-after gallery', 'Finance calculator'],
  },
  {
    name: 'Independent restaurant',
    accent: 'bg-[linear-gradient(180deg,#FFFBEB_0%,#FFEDD5_100%)]',
    description:
      'Menu-led design where the food does the selling. Reservations, a live-editable menu the owner updates from their phone, and a private-hire enquiry form that captures covers and date in one step.',
    features: ['Table reservations', 'Self-managed menu', 'Private hire enquiries', 'Google reviews feed'],
  },
  {
    name: 'Landscaping and grounds',
    accent: 'bg-[linear-gradient(180deg,#ECFDF5_0%,#DCFCE7_100%)]',
    description:
      'A trades site that qualifies before it converts. Project gallery by job type, a quote request that asks the three questions worth asking, and service-area pages that rank for the towns the business actually covers.',
    features: ['Project gallery', 'Qualified quote form', 'Service-area pages', 'Seasonal offers'],
  },
]

const faqs = [
  {
    q: 'What does a project cost?',
    a: 'A marketing website and a multi-tenant SaaS platform are not the same conversation, so we do not publish a single number. What we do give you, free and in writing, is a scoped proposal with a fixed price against it after the discovery call. No hourly estimates that drift.',
  },
  {
    q: 'How long does it take?',
    a: 'A website is typically weeks. A web app or MVP is typically months, but you get a live URL in the first week and watch it fill in from there. We ship in working slices rather than disappearing for a quarter and returning with a reveal.',
  },
  {
    q: 'Who actually does the work?',
    a: 'We do. There is no agency layer, no account manager between you and the person writing the code, and nothing is sent offshore. That is why the project list is short and the work is deep.',
  },
  {
    q: 'Do we own the code?',
    a: 'Yes. On bespoke builds you own the codebase outright and we hand over the repository, the infrastructure and the documentation. You are never locked in to us to keep the thing running.',
  },
  {
    q: 'Can you work with our existing site or system?',
    a: 'Often the right answer is to fix rather than replace, and we will say so if it is. Our first step is usually an audit of what you have, delivered in writing, so the decision is made on evidence rather than a sales pitch.',
  },
  {
    q: 'What happens after launch?',
    a: 'Your choice. Ongoing support and a regular release rhythm, or a clean handover with documentation if you would rather take it in-house or to another developer.',
  },
]

export default async function WebAppDesignPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const contactHref = buildMarketingHref('/#contact', isLocalhost)

  return (
    <div>
      {/* Hero */}
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
              Website &amp; App Design
            </p>
            <h1 className="mt-5 text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
              Websites and apps designed to do a job, not just look good.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              We design and build digital products for businesses that have
              outgrown off-the-shelf software. Marketing sites, internal tools,
              client portals, mobile-first apps, and full SaaS platforms. Every
              one of them built in-house, from the first discovery conversation
              through to deployment and beyond.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={contactHref}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Start a project
              </Link>
              <Link
                href="#work"
                className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
              >
                See the work
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--marketing-border)] bg-[linear-gradient(180deg,#F8FAFC_0%,#EFF6FF_100%)] p-6">
            <div className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-[0_20px_60px_-40px_rgba(14,165,233,0.45)]">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 truncate rounded-full bg-white px-3 py-1 text-[11px] text-slate-400">
                  engineeros.uk
                </span>
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Today
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                  Live jobs
                </h2>
                <div className="mt-5 grid gap-3">
                  {[
                    ['Fire alarm service', 'Harlow', 'Complete'],
                    ['EICR, unit 4', 'Basildon', 'On site'],
                    ['F-Gas check', 'Brentwood', 'Scheduled'],
                  ].map(([job, place, status]) => (
                    <div
                      key={job}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {job}
                        </p>
                        <p className="text-xs text-slate-500">{place}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === 'Complete'
                            ? 'bg-emerald-50 text-emerald-700'
                            : status === 'On site'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <Reveal className="border-y border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-12 md:px-8">
        <div className="mx-auto grid max-w-[1100px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label}>
              <p className="text-4xl font-bold tracking-[-0.04em] text-sky-600">
                {value}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Capabilities */}
      <Reveal className="px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            What we build
          </p>
          <h2 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Six things, done properly, rather than everything done thinly.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => (
              <article
                key={item.title}
                className="flex flex-col rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
              >
                <h3 className="text-xl font-bold tracking-[-0.03em]">
                  {item.title}
                </h3>
                <p className="mt-4 flex-1 text-[0.95rem] leading-7 text-slate-600">
                  {item.description}
                </p>
                <ul className="mt-6 grid gap-2 border-t border-slate-100 pt-5">
                  {item.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2 text-sm text-slate-500"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="mt-0.5 h-4 w-4 shrink-0 text-sky-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Work */}
      <Reveal
        id="work"
        className="scroll-mt-24 bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24"
      >
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            Selected work
          </p>
          <h2 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Five products. Every one designed, built and shipped by us.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            The detail below is the whole point. Anyone can show a screenshot,
            so here is the problem each business came with, what we actually
            built, what it runs on, and where it got to.
          </p>

          <div className="mt-12 grid gap-8">
            {projects.map((project) => (
              <article
                key={project.name}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)] md:p-10"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                    {project.sector}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      project.status === 'Live'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <h3 className="mt-5 text-3xl font-bold tracking-[-0.04em]">
                  {project.name}
                </h3>
                <p className="mt-2 text-lg font-medium text-slate-500">
                  {project.headline}
                </p>

                <div className="mt-8 grid gap-8 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      The problem
                    </p>
                    <p className="mt-3 text-[0.95rem] leading-7 text-slate-600">
                      {project.problem}
                    </p>

                    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      {project.status === 'In build' ? 'Where it is up to' : 'Outcome'}
                    </p>
                    <p className="mt-3 text-[0.95rem] leading-7 text-slate-600">
                      {project.outcome}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      {project.status === 'In build'
                        ? 'What we are building'
                        : 'What we built'}
                    </p>
                    <ul className="mt-3 grid gap-3">
                      {project.built.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2.5 text-[0.95rem] leading-7 text-slate-600"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            className="mt-2 h-3.5 w-3.5 shrink-0 text-sky-500"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path d="M4 10.5l4 4 8-9" />
                          </svg>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-slate-100 pt-6">
                  <div className="flex flex-wrap gap-2">
                    {project.stack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full border border-[var(--marketing-border)] px-3 py-1 text-xs font-medium text-slate-500"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                  {project.href ? (
                    <Link
                      href={
                        project.internal
                          ? buildMarketingHref(project.href, isLocalhost)
                          : project.href
                      }
                      target={project.internal ? undefined : '_blank'}
                      rel={project.internal ? undefined : 'noreferrer'}
                      className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 transition hover:text-sky-700"
                    >
                      {project.hrefLabel}
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M4 10h12M11 5l5 5-5 5" />
                      </svg>
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Concept builds */}
      <Reveal className="px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            Concept builds
          </p>
          <h2 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            What we would build for your sector.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            These are our own concepts rather than client projects, built to
            show how we approach a brief in sectors we work in often. Each one
            starts from the single job the site has to do, then designs
            backwards from it.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {concepts.map((concept) => (
              <article
                key={concept.name}
                className="overflow-hidden rounded-[2rem] border border-[var(--marketing-border)] bg-white shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
              >
                <div
                  className={`${concept.accent} px-6 pt-6`}
                  aria-hidden="true"
                >
                  <div className="rounded-t-2xl border border-b-0 border-white/70 bg-white/80 p-4 backdrop-blur">
                    <div className="h-2 w-16 rounded-full bg-slate-300" />
                    <div className="mt-3 h-2 w-24 rounded-full bg-slate-200" />
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="h-8 rounded-lg bg-slate-100" />
                      <div className="h-8 rounded-lg bg-slate-100" />
                      <div className="h-8 rounded-lg bg-slate-100" />
                    </div>
                    <div className="mt-3 h-6 w-20 rounded-full bg-slate-800/85" />
                  </div>
                </div>

                <div className="p-8">
                  <h3 className="text-xl font-bold tracking-[-0.03em]">
                    {concept.name}
                  </h3>
                  <p className="mt-4 text-[0.95rem] leading-7 text-slate-600">
                    {concept.description}
                  </p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {concept.features.map((feature) => (
                      <li
                        key={feature}
                        className="rounded-full bg-[var(--marketing-surface)] px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Concept work shown for illustration. Not commissioned client
            projects.
          </p>
        </div>
      </Reveal>

      {/* Process */}
      <Reveal className="bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            How we work
          </p>
          <h2 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            You see it working from week one.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {process.map((phase) => (
              <article
                key={phase.step}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-6"
              >
                <p className="text-sm font-bold tracking-[0.2em] text-sky-500">
                  {phase.step}
                </p>
                <h3 className="mt-4 text-lg font-bold tracking-[-0.02em]">
                  {phase.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {phase.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      {/* FAQ */}
      <Reveal className="px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
              Questions
            </p>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
              The things people ask first.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              If yours is not here, ask it directly. You will get a straight
              answer rather than a brochure.
            </p>
            <Link
              href={contactHref}
              className="mt-8 inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
            >
              Ask us
            </Link>
          </div>

          <div className="grid gap-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-[1.5rem] border border-[var(--marketing-border)] bg-white p-6 open:shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold tracking-[-0.01em]">
                  {faq.q}
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 shrink-0 text-sky-500 transition group-open:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </summary>
                <p className="mt-4 text-[0.95rem] leading-7 text-slate-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Reveal>

      {/* CTA */}
      <Reveal className="bg-slate-950 px-6 py-20 text-white md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px] text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
            Start a project
          </p>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Tell us what is not working.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            Most projects start with a business that knows something is costing
            them time but cannot yet name the fix. That is the conversation we
            are good at. You leave it with a written scope and a fixed price,
            whether or not you go ahead with us.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={contactHref}
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              Start a project
            </Link>
            <a
              href="mailto:info@trailheadholdings.uk"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-sky-400 hover:bg-slate-900"
            >
              info@trailheadholdings.uk
            </a>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
