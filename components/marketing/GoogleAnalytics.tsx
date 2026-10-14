import Script from 'next/script'

/**
 * GA4 tag for the marketing host only. Rendered from app/(marketing)/layout.tsx
 * so the OS (app.trailheadholdings.uk) never loads it. Enhanced measurement in
 * GA4 fires page_view on history changes, so client-side navigations are
 * tracked without a router listener.
 *
 * The 176KB library loads with lazyOnload, after the page has finished
 * loading, so it no longer competes with the fonts and CSS the first paint
 * needs on a slow phone connection. The inline snippet still runs straight
 * away and queues the page view in dataLayer, which gtag.js sends when it
 * arrives. The trade-off: a visitor who leaves within the first second or two
 * may not be counted.
 */
export default function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
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
