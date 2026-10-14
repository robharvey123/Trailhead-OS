// components/JsonLd.tsx
// Server components that emit application/ld+json script tags.
// OrganizationJsonLd and WebSiteJsonLd are sitewide (mounted in app/layout.tsx).
// BlogPostingJsonLd is per-article (mounted inside [slug]/page.tsx).

import { SITE_URL, SITE_DEFAULTS } from '@/lib/seo'

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_DEFAULTS.legalName,
    alternateName: SITE_DEFAULTS.name,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    founder: { '@type': 'Person', name: SITE_DEFAULTS.founder },
    // The company, not Rob's career: trading since November 2025. The
    // 'since 2013' copy elsewhere is Rob's time in NGP.
    foundingDate: '2025-11',
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE_DEFAULTS.addressLocality,
      addressRegion: SITE_DEFAULTS.addressRegion,
      addressCountry: SITE_DEFAULTS.addressCountry,
    },
    sameAs: SITE_DEFAULTS.sameAs,
  }
  return <JsonLd data={data} />
}

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_DEFAULTS.name,
    url: SITE_URL,
    inLanguage: 'en-GB',
    publisher: { '@type': 'Organization', name: SITE_DEFAULTS.legalName },
  }
  return <JsonLd data={data} />
}

type ProfessionalServiceProps = {
  name: string
  description: string
  url: string
  serviceTypes: string[]
}

// The /about page: an AboutPage whose subject is the founder, tied to the same
// Organization node the sitewide markup describes. Gives search engines one
// place that says who Rob is and how he relates to the company.
export function AboutPageJsonLd({ url }: { url: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url,
    name: `About ${SITE_DEFAULTS.name}`,
    about: {
      '@type': 'Organization',
      name: SITE_DEFAULTS.legalName,
      url: SITE_URL,
      foundingDate: '2025-11',
    },
    mainEntity: {
      '@type': 'Person',
      name: SITE_DEFAULTS.founder,
      jobTitle: 'Founder and Director',
      image: `${SITE_URL}/rob-harvey.webp`,
      worksFor: { '@type': 'Organization', name: SITE_DEFAULTS.legalName, url: SITE_URL },
      knowsAbout: [
        'Next generation nicotine products',
        'FMCG route to market',
        'Market entry',
        'Distributor strategy',
        'Pricing architecture',
        'Bespoke software development',
      ],
      sameAs: SITE_DEFAULTS.sameAs,
    },
  }
  return <JsonLd data={data} />
}

// Per-track service markup: /consulting and /studio are separate offers with
// separate buyers, so each carries its own ProfessionalService node under the
// Trailhead Holdings parent Organization.
export function ProfessionalServiceJsonLd({
  name,
  description,
  url,
  serviceTypes,
}: ProfessionalServiceProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name,
    description,
    url,
    parentOrganization: {
      '@type': 'Organization',
      name: SITE_DEFAULTS.legalName,
      url: SITE_URL,
    },
    founder: { '@type': 'Person', name: SITE_DEFAULTS.founder },
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE_DEFAULTS.addressLocality,
      addressRegion: SITE_DEFAULTS.addressRegion,
      addressCountry: SITE_DEFAULTS.addressCountry,
    },
    makesOffer: serviceTypes.map((serviceType) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', serviceType },
    })),
  }
  return <JsonLd data={data} />
}

type SoftwareApplicationProps = {
  name: string
  description: string
  /** The product's own domain when it has one: canonical home, not this site. */
  url: string
  applicationCategory: string
  price?: { amount: string; currency: string; unitText: string }
}

export function SoftwareApplicationJsonLd({
  name,
  description,
  url,
  applicationCategory,
  price,
}: SoftwareApplicationProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory,
    operatingSystem: 'Web',
    publisher: {
      '@type': 'Organization',
      name: SITE_DEFAULTS.legalName,
      url: SITE_URL,
    },
    ...(price
      ? {
          offers: {
            '@type': 'Offer',
            price: price.amount,
            priceCurrency: price.currency,
            description: price.unitText,
          },
        }
      : {}),
  }
  return <JsonLd data={data} />
}

type BlogPostingProps = {
  title: string
  description: string
  url: string
  image?: string
  datePublished: string
  dateModified?: string
  authorName?: string
}

export function BlogPostingJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName = SITE_DEFAULTS.founder,
}: BlogPostingProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: image ? [image] : [`${SITE_URL}/opengraph-image.png`],
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: { '@type': 'Person', name: authorName },
    publisher: {
      '@type': 'Organization',
      name: SITE_DEFAULTS.legalName,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    inLanguage: 'en-GB',
  }
  return <JsonLd data={data} />
}
