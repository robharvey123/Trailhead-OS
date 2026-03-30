import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import ContactDetailsCard from '@/components/marketing/ContactDetailsCard'
import ContactForm from '@/components/marketing/ContactForm'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact',
}

export default async function ContactPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <Reveal className="px-6 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-[1100px]">
        <Link
          href={buildMarketingHref('/', isLocalhost)}
          className="inline-flex items-center text-sm font-semibold text-sky-600 transition hover:text-sky-700"
        >
          ← Back to home
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.75fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
              Get in touch
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-[var(--marketing-text)] md:text-5xl">
              Let&apos;s talk
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Whether you&apos;re looking for commercial consultancy, a
              development partner, or just want to find out more &mdash;
              we&apos;d love to hear from you.
            </p>
            <div className="mt-10">
              <ContactForm />
            </div>
          </div>

          <ContactDetailsCard includeLegalNote isLocalhost={isLocalhost} />
        </div>
      </div>
    </Reveal>
  )
}
