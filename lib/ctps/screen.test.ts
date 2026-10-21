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

type Contact = {
  id: string
  phone: string | null
  ctps_registered: boolean | null
  ctps_checked_at: string | null
  tags?: string[]
  status?: string
  merged_into?: string | null
}

/** A sales-list prospect unless overridden. */
const c = (id: string, phone: string | null, extra: Partial<Contact> = {}): Contact => ({
  id, phone, ctps_registered: null, ctps_checked_at: null, tags: ['Engineer OS - plumbers'], status: 'lead', merged_into: null, ...extra,
})

/** Just enough of the supabase-js query builder for screen.ts. */
function fakeDb(contacts: Contact[], opts: { auditFails?: boolean } = {}) {
  const audit: Array<Record<string, unknown>> = []
  const client = {
    from(table: string) {
      if (table === 'sales_scope_tag_prefixes') {
        return { select: () => ({ order: async () => ({ data: [{ prefix: 'Engineer OS' }, { prefix: 'MVP Cricket' }], error: null }) }) }
      }
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
            data: contacts
              .filter((row) => ids.includes(row.id))
              .map(({ id, phone, tags, status, merged_into }) => ({ id, phone, tags, status, merged_into })),
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
    const { client, audit } = fakeDb([c('a', '07700900123')])
    const s = await screenContacts(client, ['a'], 'cron')
    expect(s.stoppedReason).toBe('not_configured')
    expect(lookupTps).not.toHaveBeenCalled()
    expect(audit).toHaveLength(0)
  })

  it('bills a shared number once and applies it to every contact', async () => {
    const contacts: Contact[] = [
      c('a', '07700 900123'),
      c('b', '+447700900123'),
      c('c', '01245 123456'),
      c('d', null),
      c('e', '+1 212 555 0100'),
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
    const contacts: Contact[] = Array.from({ length: 12 }, (_, i) => c(`c${i}`, `0770090${String(i).padStart(4, '0')}`))
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
    const contacts: Contact[] = [c('a', '07700900123')]
    lookupTps.mockResolvedValue(clear('447700900123'))
    const { client } = fakeDb(contacts, { auditFails: true })
    const s = await screenContacts(client, ['a'], 'mcp')
    expect(s).toMatchObject({ failed: 1, clear: 0 })
    expect(contacts[0].ctps_checked_at).toBeNull()
  })

  it('never looks up consulting, archived or merged contacts', async () => {
    const contacts: Contact[] = [
      c('sales', '07700900123'),
      c('cricket', '07700900124', { tags: ['mvp cricket clubs'] }),
      c('consulting', '07700900125', { tags: ['consulting'] }),
      c('untagged', '07700900126', { tags: [] }),
      c('archived', '07700900127', { status: 'archived' }),
      c('merged', '07700900128', { merged_into: 'sales' }),
    ]
    lookupTps.mockImplementation(async (p) => clear(p))
    const { client } = fakeDb(contacts)
    const s = await screenContacts(client, contacts.map((x) => x.id), 'import')
    expect(lookupTps).toHaveBeenCalledTimes(2)
    expect(s).toMatchObject({ attempted: 2, clear: 2, outOfScope: 4, skipped: 0 })
    expect(contacts.find((x) => x.id === 'consulting')?.ctps_checked_at).toBeNull()
  })

  it('does not write a result onto a phone that changed mid-run', async () => {
    const contacts: Contact[] = [c('a', '07700900123')]
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
