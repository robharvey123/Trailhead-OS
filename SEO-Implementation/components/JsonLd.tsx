// components/JsonLd.tsx
// Server components that emit application/ld+json script tags.
// OrganizationJsonLd and WebSiteJsonLd are sitewide (mount in app/layout.tsx).
// BlogPostingJsonLd is per-article (mount inside [slug]/page.tsx).

import { SITE_URL, SITE_DEFAULTS } from "@/lib/seo";

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_DEFAULTS.legalName,
    alternateName: SITE_DEFAULTS.name,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`, // make sure /public/logo.png exists, ideally 512x512
    founder: { "@type": "Person", name: SITE_DEFAULTS.founder },
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE_DEFAULTS.addressLocality,
      addressRegion: SITE_DEFAULTS.addressRegion,
      addressCountry: SITE_DEFAULTS.addressCountry,
    },
    sameAs: SITE_DEFAULTS.sameAs,
  };
  return <JsonLd data={data} />;
}

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_DEFAULTS.name,
    url: SITE_URL,
    inLanguage: "en-GB",
    publisher: { "@type": "Organization", name: SITE_DEFAULTS.legalName },
  };
  return <JsonLd data={data} />;
}

type BlogPostingProps = {
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
};

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
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: image ? [image] : [`${SITE_URL}/opengraph-image.png`],
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: { "@type": "Person", name: authorName },
    publisher: {
      "@type": "Organization",
      name: SITE_DEFAULTS.legalName,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    inLanguage: "en-GB",
  };
  return <JsonLd data={data} />;
}
