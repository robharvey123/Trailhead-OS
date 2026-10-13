import Script from 'next/script'

/**
 * GA4 tag for the marketing host only. Rendered from app/(marketing)/layout.tsx
 * so the OS (app.trailheadholdings.uk) never loads it. Enhanced measurement in
 * GA4 fires page_view on history changes, so client-side navigations are
 * tracked without a router listener.
 */
export default function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { anonymize_ip: true });`}
      </Script>
    </>
  )
}
