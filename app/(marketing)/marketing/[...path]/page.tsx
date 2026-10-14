import { notFound } from 'next/navigation'

// Catches every marketing path no page claims: unknown top-level paths (rewritten
// here by middleware) and unknown sub-paths such as /consulting/foo. It only
// exists to throw notFound(), so the visitor gets the marketing 404, not the OS one.
export default function MissingMarketingPage() {
  notFound()
}
