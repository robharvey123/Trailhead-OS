import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { ProfessionalServiceJsonLd } from '@/components/JsonLd'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { absoluteUrl, buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Trailhead Studio: Bespoke Software & Web Apps',
  description:
    'Trailhead Studio designs and builds bespoke software for UK businesses: internal tools, offline field apps, client portals and full web apps, all built in-house.',
  path: '/studio',
  // This page owns the software keyword pool; /consulting owns the consulting
  // pool and the homepage carries brand terms only.
  keywords: [
    'bespoke software development Essex',
    'internal tools development UK',
    'offline field service app',
    'PWA development UK',
    'Brentwood web design',
  ],
})

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

// Client work only. The in-house products used to pad this list, which made
// them read as side projects and made the portfolio read as borrowed proof.
// They live at /labs now. Thinner and honest converts better than padded.
const projects: Project[] = [
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
      'Paperwork now lands in the office before the engineer has left the car park. The build worked well enough that Trailhead Labs productised it into Engineer OS and took it to market. That is the clearest proof we know how to design software for a trade rather than for a demo.',
    href: 'https://engineeros.uk',
    hrefLabel: 'Now sold as Engineer OS',
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
      'Audit delivered and scope agreed across three costed options. Currently in build, and we will publish the before-and-after numbers when it ships.',
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

export default async function StudioPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const contactHref = buildMarketingHref('/contact?track=studio', isLocalhost)

  return (
    <div>
      <ProfessionalServiceJsonLd
        name="Trailhead Studio"
        description="Bespoke software for UK businesses: internal tools, offline-capable field apps, client portals, marketing sites and full web app builds, designed and built in-house."
        url={absoluteUrl('/studio')}
        serviceTypes={[
          'Bespoke web application development',
          'Internal tools development',
          'Offline-first field app development',
          'Marketing website design and build',
        ]}
      />
      {/* Hero */}
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
              Trailhead Studio
            </p>
            <h1 className="mt-5 text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
              Websites and apps designed to do a job, not just look good.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              We design and build digital products for businesses that have
              outgrown off-the-shelf software. Marketing sites, internal tools,
              client portals, mobile-first apps, and full web platforms. Every
              one of them built in-house, from the first discovery conversation
              through to deployment and beyond.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={contactHref}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Scope a build
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
                  Bright Fire Services: job board
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

      {/* Capabilities */}
      <Reveal id="services" className="scroll-mt-24 px-6 py-20 md:px-8 md:py-24">
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
            Client work
          </p>
          <h2 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            A short list, on purpose.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            The detail below is the whole point. Anyone can show a screenshot,
            so here is the problem each business came with, what we actually
            built, what it runs on, and where it got to. The products we build
            and sell ourselves live at Trailhead Labs.
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
      <Reveal id="process" className="scroll-mt-24 bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24">
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
