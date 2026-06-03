'use client'

import { useRef, useState } from 'react'
import sanitizeHtml from 'sanitize-html'

// Strict allowlist: no <script>/<style>/<iframe>/<object>, no on* handlers
// (not in allowedAttributes → stripped), no javascript: URLs (not in schemes).
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  allowedAttributes: {
    '*': ['style', 'class', 'align', 'dir', 'width', 'height'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
  disallowedTagsMode: 'discard',
}

/**
 * Renders untrusted email HTML safely. Two layers of defence:
 *  1. sanitize-html strips scripts / event handlers / dangerous URLs.
 *  2. A sandboxed iframe (NO allow-scripts) so even if something slips the
 *     allowlist, it cannot execute. allow-same-origin only so we can size it.
 */
export default function SafeEmailHtml({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(220)
  const clean = sanitizeHtml(html, OPTIONS)
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:14px/1.5 system-ui,-apple-system,sans-serif;color:#0f172a;word-break:break-word}img{max-width:100%;height:auto}a{color:#2563eb}</style></head><body>${clean}</body></html>`

  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      style={{ width: '100%', border: 'none', height }}
      onLoad={() => {
        try {
          const doc = ref.current?.contentDocument
          if (doc?.body) setHeight(Math.min(1400, doc.body.scrollHeight + 16))
        } catch {
          /* cross-origin guard — keep default height */
        }
      }}
    />
  )
}
