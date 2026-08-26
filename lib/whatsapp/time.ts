// Wall-clock → UTC conversion for a named IANA timezone, without a date library.
// Exports carry local time with no offset; we convert exactly once, on import,
// from a timezone the caller states. `new Date(string)` must never guess.

const dtfCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    dtfCache.set(timeZone, dtf)
  }
  return dtf
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function offsetAt(instant: Date, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - instant.getTime()
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz)
    return true
  } catch {
    return false
  }
}

/**
 * Convert a local wall-clock string 'YYYY-MM-DDTHH:mm:ss' in `timeZone` to a UTC
 * ISO string. Two-pass so DST transitions resolve correctly.
 */
export function localToUtcIso(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!m) throw new Error(`Invalid local timestamp: ${local}`)
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? '0'))
  const off1 = offsetAt(new Date(guess), timeZone)
  let utc = guess - off1
  const off2 = offsetAt(new Date(utc), timeZone)
  if (off2 !== off1) utc = guess - off2
  return new Date(utc).toISOString()
}

/** Truncate an ISO instant to the minute, in UTC: 'YYYY-MM-DDTHH:mm'. */
export function isoToMinute(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO datetime: ${iso}`)
  return d.toISOString().slice(0, 16)
}
