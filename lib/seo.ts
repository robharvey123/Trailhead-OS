// lib/seo.ts
// Central SEO config. Edit SITE_URL and DEFAULTS, then use helpers in page metadata exports.

export const SITE_URL = 'https://www.trailheadholdings.uk'

export const SITE_DEFAULTS = {
  name: 'Trailhead Holdings',
  legalName: 'Trailhead Holdings Ltd',
  tagline: 'Commercial strategy. Digital products. Built to last.',
  description:
    'Trailhead Holdings Ltd. Commercial strategy and product development for NGP, FMCG and SaaS founders. UK-based consultancy and software studio.',
  twitterHandle: '@trailheadhq', // change or remove if you do not have a handle
  defaultLocale: 'en_GB',
  founder: 'Rob Harvey',
  addressLocality: 'Brentwood',
  addressRegion: 'Essex',
  addressCountry: 'GB',
  sameAs: [
    'https://www.linkedin.com/in/rob-harvey-a80977165/',
    // add company LinkedIn / X / Companies House profile URLs here
  ],
}

export function absoluteUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`
  return `${SITE_URL}${path}`
}

type BuildMetaInput = {
  title: string
  description: string
  path: string
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  authors?: string[]
  keywords?: string[]
  noindex?: boolean
}

export function buildMetadata(input: BuildMetaInput) {
  const {
    title,
    description,
    path,
    image,
    type = 'website',
    publishedTime,
    modifiedTime,
    authors,
    keywords,
    noindex = false,
  } = input

  const url = absoluteUrl(path)
  const ogImage = image
    ? image.startsWith('http')
      ? image
      : absoluteUrl(image)
    : absoluteUrl('/opengraph-image.png')

  const fullTitle = `${title} | ${SITE_DEFAULTS.name}`

  return {
    title: fullTitle,
    description,
    keywords,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          'max-image-preview': 'large' as const,
          'max-snippet': -1,
        },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_DEFAULTS.name,
      locale: SITE_DEFAULTS.defaultLocale,
      type,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
      ...(type === 'article' && modifiedTime ? { modifiedTime } : {}),
      ...(type === 'article' && authors ? { authors } : {}),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: fullTitle,
      description,
      images: [ogImage],
      ...(SITE_DEFAULTS.twitterHandle
        ? { creator: SITE_DEFAULTS.twitterHandle }
        : {}),
    },
  }
}
