import type { Metadata } from 'next'
import { headers } from 'next/headers'
import LegalPageShell from '@/components/marketing/LegalPageShell'
import { isLocalDevelopmentHost } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export default async function TermsPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <LegalPageShell isLocalhost={isLocalhost}>
      <h1 className="text-4xl font-bold tracking-[-0.04em] text-[var(--marketing-text)] md:text-5xl">
        Terms of Service
      </h1>

      <p className="mt-6">
        <strong className="font-semibold text-[var(--marketing-text)]">
          Last updated: March 2026
        </strong>
      </p>

      <p className="mt-6">
        These terms govern your use of the Trailhead Holdings Ltd website and
        services. By using our website or engaging our services you agree to
        these terms.
      </p>

      <p className="mt-6">
        <strong className="font-semibold text-[var(--marketing-text)]">
          Trailhead Holdings Ltd
        </strong>
        <br />
        Brentwood, Essex, United Kingdom
        <br />
        info@trailheadholdings.uk
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        1. Services
      </h2>
      <p className="mt-4">
        Trailhead Holdings Ltd provides commercial consultancy, bespoke
        software development, and digital product services. Specific terms for
        each engagement are agreed in writing (via quote or contract) before
        work commences. In the event of any conflict between these general
        terms and a specific written agreement, the written agreement takes
        precedence.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        2. Quotes and proposals
      </h2>
      <p className="mt-4">
        2.1 Quotes are valid for 30 days from the issue date unless otherwise
        stated on the quote document.
      </p>
      <p className="mt-4">
        2.2 A quote is not a binding contract until both parties have confirmed
        acceptance in writing (email is sufficient).
      </p>
      <p className="mt-4">
        2.3 Quotes prepared with AI assistance are clearly marked as such. All
        AI-generated estimates are reviewed by Rob Harvey before issue. We take
        reasonable care to ensure accuracy but estimates are based on
        information provided at the time of enquiry. Scope changes may
        affect the final price.
      </p>
      <p className="mt-4">
        2.4 We reserve the right to decline any enquiry or project without
        giving a reason.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        3. Payment terms
      </h2>
      <p className="mt-4">
        3.1 Unless otherwise agreed in writing, our standard payment terms are:
      </p>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>50% deposit due on project commencement</li>
        <li>50% due on completion</li>
      </ul>
      <p className="mt-4">
        3.2 Invoices are due within 14 days of issue unless otherwise stated.
      </p>
      <p className="mt-4">
        3.3 Late payment interest may be charged at 8% above the Bank of
        England base rate in accordance with the Late Payment of Commercial
        Debts (Interest) Act 1998.
      </p>
      <p className="mt-4">
        3.4 Work may be paused or withheld where invoices remain unpaid beyond
        their due date.
      </p>
      <p className="mt-4">
        3.5 Payments processed via Stripe are subject to Stripe&apos;s terms of
        service (
        <a href="https://stripe.com/gb/legal" target="_blank" rel="noreferrer">
          stripe.com/gb/legal
        </a>
        ).
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        4. Intellectual property
      </h2>
      <p className="mt-4">
        4.1 Upon receipt of full payment, all intellectual property rights in
        bespoke work created for you transfer to you, unless otherwise agreed
        in writing.
      </p>
      <p className="mt-4">
        4.2 We retain the right to use general knowledge, skills, and
        techniques acquired during an engagement in future projects.
      </p>
      <p className="mt-4">
        4.3 We may reference your business as a client for promotional purposes
        (e.g. on our website or in proposals) unless you request otherwise in
        writing.
      </p>
      <p className="mt-4">
        4.4 Any third-party components, libraries, or frameworks used in your
        project remain subject to their own licences. We will identify any
        significant third-party licences at the time of delivery.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        5. Confidentiality
      </h2>
      <p className="mt-4">
        5.1 We treat all client information as confidential. We will not
        disclose your business information, project details, or any data you
        share with us to third parties without your consent, except where
        required by law or where necessary to deliver the agreed services (e.g.
        hosting providers, payment processors).
      </p>
      <p className="mt-4">
        5.2 We ask that you treat our proposals, pricing, and methodologies as
        confidential.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        6. Liability
      </h2>
      <p className="mt-4">
        6.1 We provide our services with reasonable skill and care in
        accordance with the Consumer Rights Act 2015 and relevant professional
        standards.
      </p>
      <p className="mt-4">
        6.2 Our total liability to you in connection with any engagement shall
        not exceed the total fees paid by you to us for that specific
        engagement.
      </p>
      <p className="mt-4">6.3 We are not liable for:</p>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>Loss of profit, revenue, data, or goodwill</li>
        <li>Indirect or consequential losses</li>
        <li>
          Losses arising from your failure to provide accurate or complete
          information
        </li>
        <li>Third-party service outages (hosting, payment processors, APIs)</li>
        <li>Losses arising from circumstances beyond our reasonable control</li>
      </ul>
      <p className="mt-4">
        6.4 Nothing in these terms limits liability for death or personal
        injury caused by negligence, fraud, or any other liability that cannot
        be excluded by law.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        7. Warranties and representations
      </h2>
      <p className="mt-4">
        7.1 We warrant that work delivered will materially conform to the
        agreed specification at the time of delivery.
      </p>
      <p className="mt-4">
        7.2 We do not warrant that software will be entirely free of bugs or
        will meet every requirement not explicitly stated in the agreed
        specification.
      </p>
      <p className="mt-4">
        7.3 You warrant that you have the right to use any content, trademarks,
        or data you provide to us for use in your project.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        8. Project conduct
      </h2>
      <p className="mt-4">
        8.1 Both parties agree to act in good faith and communicate promptly
        and clearly throughout the engagement.
      </p>
      <p className="mt-4">
        8.2 You agree to provide timely feedback and approvals when requested.
        Delays caused by late client responses may affect the agreed timeline.
      </p>
      <p className="mt-4">
        8.3 Scope changes requested after a quote has been accepted may result
        in additional charges. We will notify you before undertaking any
        out-of-scope work.
      </p>
      <p className="mt-4">
        8.4 We reserve the right to terminate an engagement with 14 days notice
        if working conditions become unreasonable. In such cases we will
        invoice for work completed to date and refund any unearned deposit.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        9. Website use
      </h2>
      <p className="mt-4">
        9.1 The content on trailheadholdings.uk is provided for information
        purposes only and does not constitute professional advice.
      </p>
      <p className="mt-4">
        9.2 We make reasonable efforts to keep the website accurate and up to
        date but make no guarantee of accuracy or completeness.
      </p>
      <p className="mt-4">
        9.3 You may not use our website in any way that causes damage,
        disruption, or impairs availability for other users.
      </p>
      <p className="mt-4">
        9.4 Links to third-party websites are provided for convenience only. We
        are not responsible for the content or practices of linked sites.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        10. Governing law
      </h2>
      <p className="mt-4">
        These terms are governed by the laws of England and Wales. Any disputes
        shall be subject to the exclusive jurisdiction of the courts of England
        and Wales.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        11. Changes to these terms
      </h2>
      <p className="mt-4">
        We may update these terms from time to time. The current version is
        always available at trailheadholdings.uk/terms. Continued use of our
        services after changes constitutes acceptance of the updated terms.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        12. Contact
      </h2>
      <p className="mt-6">
        <strong className="font-semibold text-[var(--marketing-text)]">
          Trailhead Holdings Ltd
        </strong>
        <br />
        Brentwood, Essex, United Kingdom
        <br />
        info@trailheadholdings.uk
      </p>
    </LegalPageShell>
  )
}
