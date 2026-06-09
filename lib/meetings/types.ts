// Source-agnostic meeting shape. The Google Meet fetcher (lib/google/meet.ts)
// produces this, but a future Granola (or any) source can produce the same shape
// and feed the identical matcher + persistence pipeline. Keep this file free of
// any provider-specific imports.

export type MeetingSource = 'google-meet' | 'granola'

/** Structured meeting summary (persisted as the `summary` jsonb column). */
export interface MeetingSummary {
  /** One-paragraph overview. */
  summary: string
  decisions: string[]
  nextSteps: string[]
  /** Long-form detail / anything that didn't fit the buckets above. */
  details: string
}

/** Normalised meeting artifact, independent of where it came from. */
export interface NormalisedMeeting {
  source: MeetingSource
  /** calendar_events.id this meeting is anchored on. */
  eventId: string
  /** ISO timestamp the meeting ended (used as occurred_at). */
  occurredAt: string
  /** Full transcript text, or null if none exists / wasn't accessible. */
  transcript: string | null
  /** Structured summary, or null if no "take notes for me" Doc was found. */
  summary: MeetingSummary | null
  /** Lowercased attendee emails from the calendar event. */
  attendees: string[]
}
