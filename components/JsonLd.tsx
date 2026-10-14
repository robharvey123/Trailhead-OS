// components/JsonLd.tsx
// Server components that emit application/ld+json script tags.
//
// SiteGraphJsonLd is sitewide (mounted in app/layout.tsx) and defines the three
// core entities once: the Organization, its founder and the WebSite, each with
// a stable @id from ENTITY_IDS. Every per-page block below refers to those
// entities by @id instead of repeating an anonymous stub, so search engines
// join them into one graph.

import { SITE_URL, SITE_DEFAULTS, ENTITY_IDS, absoluteUrl } from '@/lib/seo'

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

const organizationRef = { '@id': ENTITY_IDS.organization }
const founderRef = { '@id': ENTITY_IDS.founder }

const areaServed = [
  { '@type': 'Country', name: 'United Kingdom' },
  { '@type': 'Place', name: 'Europe' },
]

export function SiteGraphJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ENTITY_IDS.organization,
        name: SITE_DEFAULTS.legalName,
        alternateName: SITE_DEFAULTS.name,
        legalName: SITE_DEFAULTS.legalName,
        description: SITE_DEFAULTS.description,
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
        // The company, not Rob's career: trading since November 2025. The
        // 'since 2013' copy elsewhere is Rob's time in NGP.
        foundingDate: '2025-11',
        founder: founderRef,
        identifier: {
          '@type': 'PropertyValue',
          propertyID: 'Companies House company number',
          value: SITE_DEFAULTS.companyNumber,
        },
        email: SITE_DEFAULTS.email,
        telephone: SITE_DEFAULTS.telephone,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'sales',
          email: SITE_DEFAULTS.email,
          telephone: SITE_DEFAULTS.telephone,
          areaServed: 'GB',
          availableLanguage: 'en',
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: SITE_DEFAULTS.addressLocality,
          addressRegion: SITE_DEFAULTS.addressRegion,
          addressCountry: SITE_DEFAULTS.addressCountry,
        },
        areaServed,
        sameAs: SITE_DEFAULTS.companySameAs,
      },
      {
        '@type': 'Person',
        '@id': ENTITY_IDS.founder,
        name: SITE_DEFAULTS.founder,
        jobTitle: 'Founder and Director',
        url: absoluteUrl('/about'),
        image: `${SITE_URL}/rob-harvey.webp`,
        worksFor: organizationRef,
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
      {
        '@type': 'WebSite',
        '@id': ENTITY_IDS.website,
        name: SITE_DEFAULTS.name,
        url: SITE_URL,
        inLanguage: 'en-GB',
        publisher: organizationRef,
      },
    ],
  }
  return <JsonLd data={data} />
}

/** Home is always the first crumb; pass the rest in order. */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[]
}) {
  const crumbs = [{ name: 'Home', path: '/' }, ...items]
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.path === '/' ? SITE_URL : absoluteUrl(crumb.path),
    })),
  }
  return <JsonLd data={data} />
}

// The /about page: an AboutPage whose subject is the founder. The Person and
// Organization themselves are defined once in SiteGraphJsonLd.
export function AboutPageJsonLd({ url }: { url: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${url}#webpage`,
    url,
    name: `About ${SITE_DEFAULTS.name}`,
    isPartOf: { '@id': ENTITY_IDS.website },
    about: organizationRef,
    mainEntity: founderRef,
  }
  return <JsonLd data={data} />
}

type ProfessionalServiceProps = {
  name: string
  description: string
  url: string
  serviceTypes: string[]
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
  const id = `${url}#service`
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': id,
    name,
    description,
    url,
    image: `${SITE_URL}/logo.png`,
    email: SITE_DEFAULTS.email,
    telephone: SITE_DEFAULTS.telephone,
    parentOrganization: organizationRef,
    founder: founderRef,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE_DEFAULTS.addressLocality,
      addressRegion: SITE_DEFAULTS.addressRegion,
      addressCountry: SITE_DEFAULTS.addressCountry,
    },
    areaServed,
    makesOffer: serviceTypes.map((serviceType) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: serviceType,
        serviceType,
        provider: { '@id': id },
        areaServed,
      },
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
  /** Set on the product's own page on this domain. */
  mainEntityOfPage?: string
}

export function SoftwareApplicationJsonLd({
  name,
  description,
  url,
  applicationCategory,
  price,
  mainEntityOfPage,
}: SoftwareApplicationProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    // Keyed to the product URL so /labs and the product page describe the
    // same entity.
    '@id': `${url}#app`,
    name,
    description,
    url,
    applicationCategory,
    operatingSystem: 'Web',
    publisher: organizationRef,
    ...(mainEntityOfPage ? { mainEntityOfPage } : {}),
    ...(price
      ? {
          offers: {
            '@type': 'Offer',
            price: price.amount,
            priceCurrency: price.currency,
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: price.amount,
              priceCurrency: price.currency,
              unitText: price.unitText,
            },
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
}

export function BlogPostingJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
}: BlogPostingProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    headline: title,
    description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': ENTITY_IDS.website },
    // '/opengraph-image' is the route the site-wide card is served from; the
    // old '/opengraph-image.png' default was a 404.
    image: image ? [image] : [`${SITE_URL}/opengraph-image`],
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: founderRef,
    publisher: organizationRef,
    inLanguage: 'en-GB',
  }
  return <JsonLd data={data} />
}
