import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
import PlateSlot from '@/components/marketing/PlateSlot'
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
    code: 'CAP-01',
    title: 'Marketing websites',
    description:
      'Fast, accessible, search-ready sites that load in under a second and read well on a phone. Built on modern frameworks rather than a page builder, so the site stays quick and the content stays yours.',
    points: [
      'Next.js or static build',
      'SEO and schema built in',
      'CMS where you need one',
      'Analytics and conversion tracking',
    ],
  },
  {
    code: 'CAP-02',
    title: 'Web apps and internal tools',
    description:
      'The system your business actually runs on. Job tracking, client portals, dashboards, approval flows, anything that currently lives across a spreadsheet, an inbox and a WhatsApp group.',
    points: ['Role-based access', 'Real-time data', 'Reporting and exports', 'Audit trails'],
  },
  {
    code: 'CAP-03',
    title: 'Mobile-first PWAs',
    description:
      'Installable apps that work on a bad 4G signal and sync when the van is back in range. No app store review cycle, no separate iOS and Android codebase to maintain.',
    points: [
      'Offline-first architecture',
      'Installs to the home screen',
      'Camera and signature capture',
      'Push notifications',
    ],
  },
  {
    code: 'CAP-04',
    title: 'SaaS products',
    description:
      'End to end: positioning, pricing model, onboarding, billing, and the product itself. We have taken our own products from blank page to paying customers, so this is not theory.',
    points: [
      'Multi-tenant from day one',
      'Stripe billing and trials',
      'Self-serve onboarding',
      'Usage analytics',
    ],
  },
  {
    code: 'CAP-05',
    title: 'Design systems and UI',
    description:
      'A consistent visual language across every screen, defined in code rather than a static file. New features look like they belong without a designer redrawing them each time.',
    points: ['Component library', 'Design tokens', 'Light and dark themes', 'Accessible by default'],
  },
  {
    code: 'CAP-06',
    title: 'Integrations and automation',
    description:
      'Software is only useful when it talks to the rest of your stack. We wire products into the tools you already pay for, and automate the handoffs that currently cost someone an afternoon.',
    points: [
      'Stripe, Xero, QuickBooks',
      'Gmail and Google Calendar',
      'Webhooks and public APIs',
      'Scheduled jobs and alerts',
    ],
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
  code: string
  name: string
  sector: string
  status: 'Live' | 'In build'
  headline: string
  problem: string
  built: string[]
  stack: string[]
  outcome: string
  /** Real build screenshot. See .impeccable/ASSETS.md; omitted until supplied. */
  screenshot?: string
  screenshotAlt?: string
  screenshotWidth?: number
  screenshotHeight?: number
  /** Printed under the plate where the capture needs a fact stating about it. */
  screenshotNote?: string
  href?: string
  hrefLabel?: string
  internal?: boolean
}

// Client work only. The in-house products used to pad this list, which made
// them read as side projects and made the portfolio read as borrowed proof.
// They live at /labs now. Thinner and honest converts better than padded.
const projects: Project[] = [
  {
    code: 'JOB-01',
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
    screenshot: '/work/brightfire.webp',
    screenshotAlt:
      'The Engineer OS admin dashboard: job counts, outstanding invoices, certificate expiry and a recent jobs table',
    screenshotWidth: 1800,
    screenshotHeight: 923,
    screenshotNote: 'ENGINEER OS · DEMO DATA',
  },
  {
    code: 'JOB-02',
    name: "Wild 'n' Fresh",
    sector: 'Fine food supply',
    status: 'Live',
    headline: 'A trade supplier that reads like a market list, not a catalogue.',
    problem:
      "An independent, family-run fine food supplier selling into London kitchens: restaurants, hotels, private chefs, yachts and members' clubs. The buyers are chefs, they order against a cut-off, and they judge a supplier on whether the produce is right rather than on how a website looks. The site had to carry a daily-changing range and open a trade account without putting a form wall in front of a chef at 11am.",
    built: [
      'Five routes built around how a chef actually decides: produce, sourcing, delivery, who you are, and how to open an account',
      'A produce list that reads as a market list, named item by item, rather than a generic category grid',
      'The order cut-off and delivery window stated in the chrome on every page, because it is the fact that governs whether they can buy today',
      'Trade account enquiry routed straight to the office, with no account-manager layer in between',
    ],
    stack: ['Next.js', 'TypeScript', 'Vercel'],
    outcome:
      'Live at wildnfreshltd.com, carrying the full range and taking trade account enquiries.',
    href: 'https://www.wildnfreshltd.com',
    hrefLabel: 'Visit wildnfreshltd.com',
    screenshot: '/work/wild-n-fresh.webp',
    screenshotAlt:
      "The Wild 'n' Fresh homepage: a chef's hands slicing on the pass, over the line We buy the way we cooked",
    screenshotWidth: 1712,
    screenshotHeight: 1293,
  },
  {
    code: 'JOB-03',
    name: 'Brookweald Cricket Club',
    sector: 'Sports club',
    status: 'Live',
    headline: 'One site, four audiences, and volunteers who update it themselves.',
    problem:
      'A village club in Brentwood, three teams, on the same ground since 1949, with a clubhouse it lets out for weddings, wakes and functions. Four audiences with almost nothing in common: members checking a Saturday result on a phone at the ground, prospective players judging the standard, hire enquirers who do not care about cricket at all, and sponsors deciding whether to renew. Nobody on the committee is a developer, so any site that needed one to change a fixture or a photo would go stale by August.',
    built: [
      'Every piece of homepage content editable by committee volunteers behind a magic-link login, with built-in defaults so the site never renders empty if the content store is unreachable',
      'Clubhouse hire given equal billing with the cricket, and its own enquiry route, because it is what the club is actually selling the rest of the week',
      'A live MVP leaderboard pulled from the Trailhead Labs cricket platform over its public API, degrading to the rest of the page if that service is down',
      'Enquiries delivered by email through Resend, with an optional webhook and an optional forward into the club platform',
    ],
    stack: ['Next.js', 'TypeScript', 'Supabase', 'Resend', 'Vercel'],
    outcome:
      'Live at brookwealdcc.co.uk and maintained by the club rather than by us. The club is also where MVP Cricket was proven before it was sold to anyone: a full season of fixtures, selections, published team sheets and match-fee collection ran on it there, across 40+ members and £7,000+ in match fees collected. The site consumes that same platform\u2019s public leaderboard endpoint, so the build and the product meet on one page. Disclosure: Trailhead\u2019s operator sits on the club committee, so this is club work rather than an arm\u2019s-length commission.',
    href: 'https://brookwealdcc.co.uk',
    hrefLabel: 'Visit brookwealdcc.co.uk',
    screenshot: '/work/brookweald.webp',
    screenshotAlt:
      'The Brookweald CC homepage: the club badge beside the line Three teams. One badge, and the cricket and clubhouse split below',
    screenshotWidth: 1376,
    screenshotHeight: 1343,
  },
  {
    code: 'JOB-04',
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
    code: 'CON-01',
    name: 'Dental practice',
    description:
      'Private practice site built around one job: getting a nervous first-time patient to book. Treatment pages priced openly, finance options up front, and a booking flow that never asks for more than a name and a number.',
    features: ['Online booking', 'Transparent pricing', 'Before-and-after gallery', 'Finance calculator'],
  },
  {
    code: 'CON-02',
    name: 'Independent restaurant',
    description:
      'Menu-led design where the food does the selling. Reservations, a live-editable menu the owner updates from their phone, and a private-hire enquiry form that captures covers and date in one step.',
    features: ['Table reservations', 'Self-managed menu', 'Private hire enquiries', 'Google reviews feed'],
  },
  {
    code: 'CON-03',
    name: 'Landscaping and grounds',
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

/**
 * The job docket.
 *
 * This replaces the browser-chrome mockup the hero used to carry — three fake
 * traffic-light dots and a div pretending to be a screenshot. It is drawn in
 * this site's own grammar rather than imitating an interface, and it is keyed
 * ILLUSTRATIVE, because the job types are real Bright Fire work but the docket
 * itself is a drawing. A real Engineer OS screenshot replaces it when one is
 * supplied; nothing here pretends to be that screenshot in the meantime.
 */
function JobDocket() {
  const rows = [
    ['FA-4471', 'Fire alarm service', 'Harlow', 'COMPLETE'],
    ['EI-0912', 'EICR, unit 4', 'Basildon', 'ON SITE'],
    ['FG-2205', 'F-Gas check', 'Brentwood', 'SCHEDULED'],
  ]

  return (
    <figure className="ticket">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="plan-label text-[var(--ink)]">
          Bright Fire Services · job board
        </figcaption>
        <span className="key-state key-illustrative">Illustrative</span>
      </div>

      {/* The docket is a data table, so at narrow widths it scrolls inside its
          own frame rather than forcing the page to scroll sideways. */}
      <div className="ticket-rule -mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[19rem] border-collapse">
          <caption className="sr-only">
            An illustrative field-service job board, showing job reference,
            work type, town and status.
          </caption>
          <thead>
            <tr className="border-b border-[var(--hair)]">
              {['REF', 'WORK', 'TOWN', 'STATUS'].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="plan-data py-2 text-left font-normal text-[var(--ink-3)]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([ref, work, town, status]) => (
              <tr key={ref} className="border-b border-[var(--hair)] last:border-b-0">
                <td className="plan-data py-3 pr-3 whitespace-nowrap text-[var(--ink-3)]">
                  {ref}
                </td>
                <td className="py-3 pr-3 plan-body-xs font-medium whitespace-nowrap text-[var(--ink)]">
                  {work}
                </td>
                <td className="py-3 pr-3 plan-body-xs whitespace-nowrap text-[var(--ink-2)]">
                  {town}
                </td>
                <td className="plan-data py-3 text-right whitespace-nowrap text-[var(--ink)]">
                  {status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="plan-data mt-3 border-t border-[var(--hair)] pt-2.5 text-[var(--ink-3)]">
        SYNCS OFFLINE · SIGNATURE + PHOTO AT THE PANEL
      </p>
    </figure>
  )
}

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

      {/* ---- Hero: the claim, and the artifact that proves it, together ---- */}
      <section className="pt-10 pb-12 md:pt-16 md:pb-16">
        <div className="bay">
          <div className="bay-code hidden lg:block">
            <p className="plan-data text-[var(--ink-3)]">BAY 02</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Studio</p>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
            <div className="min-w-0">
              <h1 className="plan-display rack">
                Websites and apps designed to do a job, not just look good.
              </h1>
              <p className="plan-lede mt-7">
                We design and build digital products for businesses that have
                outgrown off-the-shelf software. Marketing sites, internal
                tools, client portals, mobile-first apps, and full web
                platforms. Every one of them built in-house, from the first
                discovery conversation through to deployment and beyond.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href={contactHref} className="flash justify-center">
                  Scope a build
                </Link>
                <Link href="#work" className="flash-ghost justify-center">
                  See the work
                </Link>
              </div>
            </div>

            <div className="lg:pt-2">
              <JobDocket />

              {/* What the docket is actually built on. Real stack, set as data,
                  so the right column carries fact rather than empty stock. */}
              <dl className="mt-5 border-t border-[var(--ink)]">
                {[
                  ['RUNS ON', 'Next.js · TypeScript · Supabase'],
                  ['DELIVERY', 'PWA, installs to the home screen'],
                  ['OFFLINE', 'Syncs when the van is back in range'],
                  ['OWNERSHIP', 'Client owns the repository'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--hair)] py-2.5"
                  >
                    <dt className="plan-data text-[var(--ink-3)]">{label}</dt>
                    <dd className="plan-body-xs text-[var(--ink-2)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Capabilities ---- */}
      <Reveal id="services" className="rail scroll-mt-24 bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">CAP</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">6 facings</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target max-w-[22ch]">
              Six things, done properly, rather than everything done thinly.
            </h2>

            <div className="facings mt-8 md:grid-cols-2 xl:grid-cols-3">
              {capabilities.map((item) => (
                <article key={item.title} className="facing flex flex-col bg-[var(--plan)]">
                  <p className="plan-data text-[var(--ink-3)]">{item.code}</p>
                  <h3 className="plan-h3 mt-3">{item.title}</h3>
                  <p className="plan-body mt-3 flex-1 plan-body-sm">
                    {item.description}
                  </p>
                  <ul className="mt-5 border-t border-[var(--hair)] pt-3">
                    {item.points.map((point) => (
                      <li
                        key={point}
                        className="plan-data py-1 text-[var(--ink-2)]"
                      >
                        {point.toUpperCase()}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Client work ---- */}
      <Reveal id="work" className="rail scroll-mt-24">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">JOBS</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">4 on record</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">A short list, on purpose.</h2>
            <p className="plan-body mt-4">
              The detail below is the whole point. Anyone can show a screenshot,
              so here is the problem each business came with, what we actually
              built, what it runs on, and where it got to. The products we build
              and sell ourselves live at Trailhead Labs.
            </p>

            <div className="mt-8 border-t border-[var(--ink)]">
              {projects.map((project) => (
                <article
                  key={project.name}
                  className="border-b border-[var(--hair)] py-8"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="plan-data text-[var(--ink-3)]">
                        {project.code}
                      </span>
                      <span
                        className={`key-state ${
                          project.status === 'Live' ? 'key-live' : 'key-build'
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>
                    <span className="plan-data text-[var(--ink-3)]">
                      {project.sector.toUpperCase()}
                    </span>
                  </div>

                  <h3
                    className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-bold"
                    style={{ fontStretch: '80%', letterSpacing: '-0.02em' }}
                  >
                    {project.name}
                  </h3>
                  <p className="plan-label mt-3 text-[var(--key-deep)]">
                    {project.headline}
                  </p>

                  <PlateSlot
                    src={project.screenshot}
                    alt={project.screenshotAlt ?? `${project.name}, the delivered build`}
                    caption={project.screenshotNote}
                    width={project.screenshotWidth ?? 1600}
                    height={project.screenshotHeight ?? 1000}
                    className="mt-7"
                  />

                  <div className="mt-7 grid gap-8 lg:grid-cols-2">
                    <div>
                      <p className="plan-data text-[var(--ink-3)]">
                        THE PROBLEM
                      </p>
                      <p className="plan-body mt-2.5 plan-body-sm">
                        {project.problem}
                      </p>

                      <p className="plan-data mt-7 text-[var(--ink-3)]">
                        {project.status === 'In build'
                          ? 'WHERE IT IS UP TO'
                          : 'OUTCOME'}
                      </p>
                      <p className="plan-body mt-2.5 plan-body-sm">
                        {project.outcome}
                      </p>
                    </div>

                    <div>
                      <p className="plan-data text-[var(--ink-3)]">
                        {project.status === 'In build'
                          ? 'WHAT WE ARE BUILDING'
                          : 'WHAT WE BUILT'}
                      </p>
                      <ul className="mt-2.5 border-t border-[var(--hair)]">
                        {project.built.map((point) => (
                          <li
                            key={point}
                            className="plan-body border-b border-[var(--hair)] py-2.5 plan-body-sm"
                          >
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <ul className="flex flex-wrap gap-2">
                      {project.stack.map((tech) => (
                        <li
                          key={tech}
                          className="plan-data border border-[var(--hair)] px-2 py-1.5 text-[var(--ink-2)]"
                        >
                          {tech.toUpperCase()}
                        </li>
                      ))}
                    </ul>
                    {project.href ? (
                      <Link
                        href={
                          project.internal
                            ? buildMarketingHref(project.href, isLocalhost)
                            : project.href
                        }
                        target={project.internal ? undefined : '_blank'}
                        rel={project.internal ? undefined : 'noreferrer'}
                        className="plan-label ml-auto inline-flex items-center gap-2 text-[var(--flash)] hover:underline"
                      >
                        {project.hrefLabel}
                        <PlanIcon name="external" size={13} />
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Concept builds ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">CON</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Not commissioned</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">
              What we would build for your sector.
            </h2>
            <p className="plan-body mt-4">
              These are our own concepts rather than client projects, built to
              show how we approach a brief in sectors we work in often. Each one
              starts from the single job the site has to do, then designs
              backwards from it.
            </p>

            <div className="facings mt-8 md:grid-cols-3">
              {concepts.map((concept) => (
                <article key={concept.name} className="facing flex flex-col bg-[var(--plan)]">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="plan-data text-[var(--ink-3)]">
                      {concept.code}
                    </p>
                    <span className="key-state key-illustrative">Concept</span>
                  </div>
                  <h3 className="plan-h3 mt-4">{concept.name}</h3>
                  <p className="plan-body mt-3 flex-1 plan-body-sm">
                    {concept.description}
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-1.5 border-t border-[var(--hair)] pt-4">
                    {concept.features.map((feature) => (
                      <li
                        key={feature}
                        className="plan-data border border-[var(--hair)] px-2 py-1.5 text-[var(--ink-2)]"
                      >
                        {feature.toUpperCase()}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Process: the sequence is the information ---- */}
      <Reveal id="process" className="rail scroll-mt-24">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">SEQ</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">01–05</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">You see it working from week one.</h2>

            <ol className="mt-8 border-t border-[var(--ink)]">
              {process.map((phase) => (
                <li
                  key={phase.step}
                  className="grid gap-x-8 gap-y-2 border-b border-[var(--hair)] py-5 md:grid-cols-[4rem_10rem_minmax(0,1fr)] md:items-baseline"
                >
                  <span className="plan-data text-[var(--key-deep)]">
                    {phase.step}
                  </span>
                  <h3 className="plan-h3">{phase.title}</h3>
                  <p className="plan-body plan-body-sm">
                    {phase.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>

      {/* ---- FAQ ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">FAQ</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Asked first</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">The things people ask first.</h2>
            <p className="plan-body mt-4">
              If yours is not here, ask it directly. You will get a straight
              answer rather than a brochure.
            </p>

            <div className="mt-8 border-t border-[var(--ink)]">
              {faqs.map((faq) => (
                <details key={faq.q} className="group border-b border-[var(--hair)]">
                  <summary className="plan-h3 flex max-w-3xl cursor-pointer list-none items-center justify-between gap-4 py-4 marker:content-none">
                    {faq.q}
                    <PlanIcon
                      name="cross"
                      size={15}
                      className="text-[var(--ink-2)] transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="plan-body pb-5 plan-body-sm">{faq.a}</p>
                </details>
              ))}
            </div>

            <Link href={contactHref} className="flash-ghost mt-8">
              Ask us
            </Link>
          </div>
        </div>
      </Reveal>

      {/* ---- Close ---- */}
      <Reveal className="rail brand-block">
        <div className="bay py-14 md:py-20">
          <div className="bay-code">
            <p className="plan-note opacity-70" style={{ color: 'var(--key-ink)' }}>
              End of bay
            </p>
          </div>
          <div className="min-w-0">
            <h2
              className="plan-h2 rack-target max-w-[18ch]"
              style={{ color: 'var(--key-ink)' }}
            >
              Tell us what is not working.
            </h2>
            <p className="plan-lede mt-6">
              Most projects start with a business that knows something is
              costing them time but cannot yet name the fix. That is the
              conversation we are good at. You leave it with a written scope and
              a fixed price, whether or not you go ahead with us.
            </p>
            <div className="ticket mt-9 max-w-md">
              <p className="plan-data text-[var(--ink-3)]">
                WRITTEN SCOPE · FIXED PRICE · NO HOURLY DRIFT
              </p>
              <div className="ticket-rule flex flex-col gap-2">
                <Link href={contactHref} className="flash">
                  Start a project
                  <PlanIcon name="right" />
                </Link>
                <a
                  href="mailto:info@trailheadholdings.uk"
                  className="flash-ghost justify-center"
                >
                  info@trailheadholdings.uk
                </a>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
