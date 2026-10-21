import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CtpsLookupResult } from './datasoap'

const lookupTps = vi.fn<(phone: string) => Promise<CtpsLookupResult>>()
let configured = true

vi.mock('./datasoap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./datasoap')>()
  return { ...actual, isConfigured: () => configured, lookupTps: (phone: string) => lookupTps(phone) }
})

const { screenContacts } = await import('./screen')

type Contact = { id: string; phone: string | null; ctps_registered: boolean | null; ctps_checked_at: string | null }

/** Just enough of the supabase-js query builder for screen.ts. */
function fakeDb(contacts: Contact[], opts: { auditFails?: boolean } = {}) {
  const audit: Array<Record<string, unknown>> = []
  const client = {
    from(table: string) {
      if (table === 'ctps_checks') {
        return {
          insert: async (rows: Array<Record<string, unknown>>) => {
            if (opts.auditFails) return { error: { message: 'boom' } }
            audit.push(...rows)
            return { error: null }
          },
        }
      }
      return {
        select: () => ({
          in: async (_col: string, ids: string[]) => ({
            data: contacts.filter((c) => ids.includes(c.id)).map(({ id, phone }) => ({ id, phone })),
            error: null,
          }),
        }),
        update: (patch: Partial<Contact>) => {
          const filters: Record<string, unknown> = {}
          const builder = {
            eq(col: string, value: unknown) {
              filters[col] = value
              return builder
            },
            async select() {
              const hit = contacts.filter((c) => Object.entries(filters).every(([k, v]) => c[k as keyof Contact] === v))
              hit.forEach((c) => Object.assign(c, patch))
              return { data: hit.map((c) => ({ id: c.id })), error: null }
            },
          }
          return builder
        },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, audit }
}

const clear = (n: string): CtpsLookupResult => ({ ok: true, phoneNormalised: n, tps: false, ctps: false, creditsUsed: 1 })

describe('screenContacts', () => {
  beforeEach(() => {
    lookupTps.mockReset()
    configured = true
  })

  it('does nothing when Data Soap is not configured', async () => {
    configured = false
    const { client, audit } = fakeDb([{ id: 'a', phone: '07700900123', ctps_registered: null, ctps_checked_at: null }])
    const s = await screenContacts(client, ['a'], 'cron')
    expect(s.stoppedReason).toBe('not_configured')
    expect(lookupTps).not.toHaveBeenCalled()
    expect(audit).toHaveLength(0)
  })

  it('bills a shared number once and applies it to every contact', async () => {
    const contacts: Contact[] = [
      { id: 'a', phone: '07700 900123', ctps_registered: null, ctps_checked_at: null },
      { id: 'b', phone: '+447700900123', ctps_registered: null, ctps_checked_at: null },
      { id: 'c', phone: '01245 123456', ctps_registered: null, ctps_checked_at: null },
      { id: 'd', phone: null, ctps_registered: null, ctps_checked_at: null },
      { id: 'e', phone: '+1 212 555 0100', ctps_registered: null, ctps_checked_at: null },
    ]
    lookupTps.mockImplementation(async (p) => (p.startsWith('012') ? { ...clear('441245123456'), ctps: true } : clear('447700900123')))
    const { client, audit } = fakeDb(contacts)
    const s = await screenContacts(client, ['a', 'b', 'c', 'd', 'e'], 'cron')
    expect(lookupTps).toHaveBeenCalledTimes(2)
    expect(s).toMatchObject({ attempted: 3, clear: 2, registered: 1, failed: 0, skipped: 2, creditsUsed: 2, stoppedReason: null })
    expect(contacts.find((c) => c.id === 'b')).toMatchObject({ ctps_registered: false })
    expect(contacts.find((c) => c.id === 'c')).toMatchObject({ ctps_registered: true })
    expect(audit.map((r) => r.credits_used).sort()).toEqual([0, 1, 1])
  })

  it('leaves the contact unscreened on failure and stops on -98', async () => {
    const contacts: Contact[] = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`, phone: `0770090${String(i).padStart(4, '0')}`, ctps_registered: null, ctps_checked_at: null,
    }))
    lookupTps.mockResolvedValue({ ok: false, phoneNormalised: 'x', code: -98, message: 'insufficient credit', retryable: false })
    const { client, audit } = fakeDb(contacts)
    const s = await screenContacts(client, contacts.map((c) => c.id), 'cron')
    expect(s.stoppedReason).toBe('insufficient_credit')
    // The 5 in-flight lookups fail; nothing new starts after the -98.
    expect(lookupTps).toHaveBeenCalledTimes(5)
    expect(s).toMatchObject({ attempted: 5, failed: 5, skipped: 7, clear: 0 })
    expect(contacts.every((c) => c.ctps_checked_at === null)).toBe(true)
    expect(audit).toHaveLength(5)
    expect(audit[0]).toMatchObject({ error_code: -98, tps: null })
  })

  it('does not mark a contact screened when the audit row cannot be written', async () => {
    const contacts: Contact[] = [{ id: 'a', phone: '07700900123', ctps_registered: null, ctps_checked_at: null }]
    lookupTps.mockResolvedValue(clear('447700900123'))
    const { client } = fakeDb(contacts, { auditFails: true })
    const s = await screenContacts(client, ['a'], 'mcp')
    expect(s).toMatchObject({ failed: 1, clear: 0 })
    expect(contacts[0].ctps_checked_at).toBeNull()
  })

  it('does not write a result onto a phone that changed mid-run', async () => {
    const contacts: Contact[] = [{ id: 'a', phone: '07700900123', ctps_registered: null, ctps_checked_at: null }]
    lookupTps.mockImplementation(async () => {
      contacts[0].phone = '07700900999'
      return clear('447700900123')
    })
    const { client } = fakeDb(contacts)
    const s = await screenContacts(client, ['a'], 'cron')
    expect(s).toMatchObject({ failed: 1, clear: 0 })
    expect(contacts[0].ctps_checked_at).toBeNull()
  })
})
