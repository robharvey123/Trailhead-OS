import type { Metadata } from 'next'
import { headers } from 'next/headers'
import LegalPageShell from '@/components/marketing/LegalPageShell'
import { isLocalDevelopmentHost } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export default async function PrivacyPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <LegalPageShell isLocalhost={isLocalhost}>
      <h1 className="text-4xl font-bold tracking-[-0.04em] text-[var(--marketing-text)] md:text-5xl">
        Privacy Policy
      </h1>

      <p className="mt-6">
        <strong className="font-semibold text-[var(--marketing-text)]">
          Last updated: March 2026
        </strong>
      </p>

      <p className="mt-6">
        Trailhead Holdings Ltd (&quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;) is committed to protecting your personal data. This
        policy explains how we collect, use, and protect information when you
        use our website at trailheadholdings.uk, submit enquiries, or engage
        with our services.
      </p>

      <p className="mt-6">
        <strong className="font-semibold text-[var(--marketing-text)]">
          Data controller:
        </strong>
        <br />
        Trailhead Holdings Ltd
        <br />
        Brentwood, Essex, United Kingdom
        <br />
        info@trailheadholdings.uk
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        1. What data we collect
      </h2>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.1 Website contact form
      </h3>
      <p className="mt-4">
        When you submit our contact form we collect your name, email address,
        company name (optional), and message. We use this to respond to your
        enquiry. This data is sent to us via Resend and stored securely.
      </p>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.2 Discovery form (project enquiries)
      </h3>
      <p className="mt-4">
        When you complete our project discovery form we collect your business
        name, contact name, email address, phone number, and information about
        your project requirements. We use this to prepare a proposal or quote
        for your project. This data is stored in our secure database and
        accessible only to Trailhead Holdings Ltd.
      </p>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.3 Client and account data
      </h3>
      <p className="mt-4">
        If you become a client we store your name, company name, email address,
        phone number, address, and records of our commercial relationship
        including quotes, invoices, and project notes. This is necessary to
        fulfil our contract with you.
      </p>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.4 Payment data
      </h3>
      <p className="mt-4">
        We use Stripe to process payments. When you pay an invoice online, your
        payment details are entered directly into Stripe&apos;s secure platform
        &mdash; we never see or store your card details. Stripe is PCI DSS
        compliant. You can read Stripe&apos;s privacy policy at{' '}
        <a href="https://stripe.com/gb/privacy" target="_blank" rel="noreferrer">
          stripe.com/gb/privacy
        </a>
        .
      </p>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.5 Google Calendar
      </h3>
      <p className="mt-4">
        If we connect our Google account to manage calendar scheduling,
        event data may be processed through the Google Calendar API. We do not
        share your calendar data with any third parties beyond what is required
        to provide this functionality. You can read Google&apos;s privacy policy at{' '}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noreferrer"
        >
          policies.google.com/privacy
        </a>
        .
      </p>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.6 Cookies and analytics
      </h3>
      <p className="mt-4">
        Our website uses only essential cookies required for it to function. We
        do not use advertising cookies or third-party tracking. We do not use
        Google Analytics or any other analytics platform that tracks individual
        users across sites.
      </p>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.7 Push notifications
      </h3>
      <p className="mt-4">
        If you opt in to push notifications on our platform, we store your
        browser&apos;s push subscription endpoint to send you notifications. You
        can revoke this permission at any time in your browser settings.
      </p>

      <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
        1.8 Blog
      </h3>
      <p className="mt-4">
        Our blog is publicly accessible. We do not require registration to read
        it and we do not track individual readers.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        2. Legal basis for processing
      </h2>
      <p className="mt-4">
        We process your personal data under the following legal bases under UK
        GDPR:
      </p>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Contract
          </strong>
          : processing necessary to fulfil a contract with you or take steps
          before entering one (client data, invoicing, quotes)
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Legitimate interests
          </strong>
          : processing necessary for our legitimate business interests where
          these are not overridden by your rights (responding to enquiries,
          project scoping)
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Consent
          </strong>
          : where you have given clear consent (push notifications)
        </li>
      </ul>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        3. How we use your data
      </h2>
      <p className="mt-4">We use your data only for the purposes it was collected for:</p>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>Responding to enquiries and preparing proposals</li>
        <li>Delivering agreed services and managing our commercial relationship</li>
        <li>Processing payments for services rendered</li>
        <li>Communicating with you about your project or account</li>
        <li>Sending notifications you have opted into</li>
      </ul>
      <p className="mt-4">
        We do not sell your data. We do not use your data for advertising. We
        do not share your data with third parties except where necessary to
        deliver our services (Stripe for payments, Resend for email delivery,
        Supabase for secure data storage) or where required by law.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        4. Data retention
      </h2>
      <p className="mt-4">
        We retain your data for as long as necessary to fulfil the purpose it
        was collected for, and as required by law:
      </p>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>Enquiry data: 2 years from the date of submission</li>
        <li>
          Client and account data: 7 years from the end of our commercial
          relationship (required for UK tax and accounting purposes)
        </li>
        <li>Invoice and payment records: 7 years (legal requirement)</li>
        <li>Contact form submissions: 1 year</li>
        <li>Push notification subscriptions: until you revoke permission</li>
      </ul>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        5. Your rights
      </h2>
      <p className="mt-4">Under UK GDPR you have the right to:</p>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Access
          </strong>{' '}
          the personal data we hold about you
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Rectification
          </strong>{' '}
          of inaccurate data
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Erasure
          </strong>{' '}
          (&quot;right to be forgotten&quot;) where there is no legitimate
          reason for us to continue processing
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Restriction
          </strong>{' '}
          of processing in certain circumstances
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Data portability
          </strong>{' '}
          &mdash; receive your data in a machine-readable format
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Object
          </strong>{' '}
          to processing based on legitimate interests
        </li>
        <li>
          <strong className="font-semibold text-[var(--marketing-text)]">
            Withdraw consent
          </strong>{' '}
          at any time where consent is the legal basis
        </li>
      </ul>
      <p className="mt-4">
        To exercise any of these rights, contact us at{' '}
        info@trailheadholdings.uk. We will respond within 30 days.
      </p>
      <p className="mt-4">
        You also have the right to lodge a complaint with the Information
        Commissioner&apos;s Office (ICO) at{' '}
        <a href="https://ico.org.uk" target="_blank" rel="noreferrer">
          ico.org.uk
        </a>
        .
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        6. Data security
      </h2>
      <p className="mt-4">
        We take reasonable technical and organisational measures to protect
        your personal data including:
      </p>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>Encrypted connections (HTTPS) across all our services</li>
        <li>Database-level security with row-level access controls</li>
        <li>Access to personal data restricted to authorised personnel only</li>
        <li>
          Third-party processors selected for their security standards (Stripe
          PCI DSS, Supabase SOC 2)
        </li>
      </ul>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        7. International transfers
      </h2>
      <p className="mt-4">
        Our data is stored on servers in the European Economic Area via
        Supabase. Where data is transferred outside the EEA (for example via
        Stripe or Resend), we ensure appropriate safeguards are in place in
        accordance with UK GDPR requirements.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        8. Third-party processors
      </h2>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[640px] w-full border-collapse text-left text-sm leading-6">
          <thead>
            <tr className="border-b border-[var(--marketing-border)] text-[var(--marketing-text)]">
              <th className="px-0 py-3 font-semibold">Processor</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
              <th className="px-4 py-3 font-semibold">Privacy policy</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--marketing-border)] align-top">
              <td className="px-0 py-4 font-medium text-[var(--marketing-text)]">
                Supabase
              </td>
              <td className="px-4 py-4">Secure database hosting</td>
              <td className="px-4 py-4">
                <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
                  supabase.com/privacy
                </a>
              </td>
            </tr>
            <tr className="border-b border-[var(--marketing-border)] align-top">
              <td className="px-0 py-4 font-medium text-[var(--marketing-text)]">
                Stripe
              </td>
              <td className="px-4 py-4">Payment processing</td>
              <td className="px-4 py-4">
                <a href="https://stripe.com/gb/privacy" target="_blank" rel="noreferrer">
                  stripe.com/gb/privacy
                </a>
              </td>
            </tr>
            <tr className="border-b border-[var(--marketing-border)] align-top">
              <td className="px-0 py-4 font-medium text-[var(--marketing-text)]">
                Resend
              </td>
              <td className="px-4 py-4">Email delivery</td>
              <td className="px-4 py-4">
                <a
                  href="https://resend.com/legal/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  resend.com/legal/privacy-policy
                </a>
              </td>
            </tr>
            <tr className="border-b border-[var(--marketing-border)] align-top">
              <td className="px-0 py-4 font-medium text-[var(--marketing-text)]">
                Google
              </td>
              <td className="px-4 py-4">Google Calendar API</td>
              <td className="px-4 py-4">
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  policies.google.com/privacy
                </a>
              </td>
            </tr>
            <tr className="align-top">
              <td className="px-0 py-4 font-medium text-[var(--marketing-text)]">
                Vercel / Netlify
              </td>
              <td className="px-4 py-4">Website hosting</td>
              <td className="px-4 py-4">
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  vercel.com/legal/privacy-policy
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        9. Changes to this policy
      </h2>
      <p className="mt-4">
        We may update this policy from time to time. The &quot;last updated&quot;
        date at the top of this page will reflect any changes. We will notify
        active clients of significant changes by email.
      </p>

      <h2 className="mt-12 text-2xl font-bold tracking-[-0.03em] text-[var(--marketing-text)]">
        10. Contact
      </h2>
      <p className="mt-4">For any privacy-related queries or to exercise your rights:</p>
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
