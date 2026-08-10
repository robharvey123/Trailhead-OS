'use client'

import ReactMarkdown from 'react-markdown'

/**
 * Renders a Granola summary (markdown) in the dark OS theme. Uses explicit list/
 * heading classes so bullets and headings survive Tailwind's preflight reset.
 * Guards the empty-summary edge case Granola can return.
 */
export default function MeetingSummary({ markdown }: { markdown: string | null }) {
  if (!markdown || !markdown.trim()) {
    return <p className="text-sm text-[var(--muted)]">No summary was generated for this meeting.</p>
  }

  return (
    <div className="space-y-2 text-sm text-[var(--muted)]">
      <ReactMarkdown
        components={{
          h1: (props) => <h1 className="mt-4 text-xl font-semibold text-[color:var(--text)]" {...props} />,
          h2: (props) => <h2 className="mt-4 text-lg font-semibold text-[color:var(--text)]" {...props} />,
          h3: (props) => <h3 className="mt-3 text-base font-semibold text-[color:var(--text)]" {...props} />,
          p: (props) => <p className="mt-2 leading-relaxed" {...props} />,
          ul: (props) => <ul className="mt-2 list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="mt-2 list-decimal space-y-1 pl-5" {...props} />,
          strong: (props) => <strong className="font-semibold text-[color:var(--text)]" {...props} />,
          a: (props) => <a className="text-[var(--lime)] underline" {...props} />,
          code: (props) => <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
