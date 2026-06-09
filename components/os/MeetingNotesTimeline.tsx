import type { MatchConfidence } from '@/lib/meetings/match'
import type { MeetingNoteWithRelations } from '@/lib/db/meeting-notes'
import MeetingNoteRematch from './MeetingNoteRematch'

// Server component: renders ingested Google Meet / Gemini notes as a timeline.
// Summary is shown expanded; the (sensitive, long) transcript is collapsed in a
// native <details>. Low-confidence / ambiguous matches surface a Re-match control.

const CONFIDENCE_STYLE: Record<MatchConfidence, { label: string; cls: string }> = {
  high: { label: 'Matched', cls: 'border-[var(--lime)]/40 text-[var(--lime)]' },
  medium: { label: 'Review match', cls: 'border-amber-400/40 text-amber-300' },
  low: { label: 'Low confidence', cls: 'border-rose-400/40 text-rose-300' },
  none: { label: 'Unmatched', cls: 'border-rose-400/40 text-rose-300' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function MeetingNotesTimeline({ notes }: { notes: MeetingNoteWithRelations[] }) {
  return (
    <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Meeting notes</h2>
        <p className="text-sm text-[var(--muted)]">Google Meet transcripts and AI summaries from calls.</p>
      </div>

      {notes.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
          No meeting notes yet. They appear automatically after a Meet with notes enabled.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {notes.map((note) => {
            const badge = CONFIDENCE_STYLE[note.match_confidence]
            const s = note.summary
            return (
              <div key={note.id} className="rounded-3xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)]">Meet</span>
                    <p className="text-xs text-[var(--muted)]">{fmtDate(note.occurred_at)}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
                  </div>
                  {note.needs_review ? <MeetingNoteRematch noteId={note.id} /> : null}
                </div>

                {s ? (
                  <div className="mt-3 space-y-3">
                    {s.summary ? (
                      <p className="whitespace-pre-wrap text-sm text-[var(--muted)]">{s.summary}</p>
                    ) : null}
                    {s.decisions.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-white">Decisions</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                          {s.decisions.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {s.nextSteps.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-white">Next steps</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                          {s.nextSteps.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--muted)]">No AI summary was available for this meeting.</p>
                )}

                {note.transcript ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-[var(--muted)] transition hover:text-white">
                      Transcript
                    </summary>
                    <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">
                      {note.transcript}
                    </pre>
                  </details>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
