import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { upsertEngagement, addTier1Account } from '@/lib/db/engagements'
import { DEFAULT_WORKSTREAMS } from '@/lib/types'
import { NextResponse } from 'next/server'

const ENGAGEMENT_NAME = 'Qola - DRIVER GTM (via Wide Advocacy)'
const PERF_FEE = 4000

// name -> { channel, notes? }
const SEED_ACCOUNTS: Array<{ name: string; channel: string; notes?: string; role: 'end' | 'agency' | 'tier1' }> = [
  { name: 'Qola', channel: 'Client - End', role: 'end' },
  { name: 'Wide Advocacy', channel: 'Client - Agency', role: 'agency' },
  { name: 'Haypp Group UK', channel: 'Online Pouch Retailers UK & EU', role: 'tier1' },
  { name: 'Haypp Group DACH', channel: 'Online Pouch Retailers UK & EU', notes: 'DACH region', role: 'tier1' },
  { name: 'Nicokick', channel: 'Online Pouch Retailers UK & EU', role: 'tier1' },
  { name: 'Two Wombats', channel: 'Online Pouch Retailers UK & EU', role: 'tier1' },
  { name: 'Vape Superstore', channel: 'Online Vape Retailers UK & EU', role: 'tier1' },
  { name: 'MakeWebo', channel: 'Online Pouch Retailers UK & EU', role: 'tier1' },
  { name: 'Europouches', channel: 'Online Pouch Retailers UK & EU', role: 'tier1' },
  { name: 'Phoenix 2 Retail', channel: 'Online Pouch Retailers UK & EU', role: 'tier1' },
  { name: 'Vape Supplier Ltd', channel: 'Online Pouch Retailers UK & EU', role: 'tier1' },
]

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

export async function POST() {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    let created = 0
    let linked = 0
    const idByName = new Map<string, string>()

    // 1. Accounts (case-insensitive lookup; create only the missing).
    for (const a of SEED_ACCOUNTS) {
      const { data: existing } = await supabase.from('accounts').select('id').ilike('name', a.name).limit(1).maybeSingle()
      if (existing) {
        idByName.set(a.name, existing.id)
        linked++
        continue
      }
      const { data: inserted, error } = await supabase
        .from('accounts')
        .insert({ name: a.name, channel: a.channel, status: 'active', notes: a.notes ?? null })
        .select('id')
        .single()
      if (error) throw new Error(`account "${a.name}": ${error.message}`)
      idByName.set(a.name, inserted.id)
      created++
    }

    // 2. Engagement (upsert by name).
    const today = new Date()
    const end = new Date(today)
    end.setMonth(end.getMonth() + 3)

    const { data: existingEng } = await supabase.from('engagements').select('id').ilike('name', ENGAGEMENT_NAME).limit(1).maybeSingle()

    const engagement = await upsertEngagement(
      {
        id: existingEng?.id,
        name: ENGAGEMENT_NAME,
        code: 'QOLA-GTM',
        end_client_account_id: idByName.get('Qola')!,
        billed_via_account_id: idByName.get('Wide Advocacy')!,
        currency: 'GBP',
        retainer_amount_monthly: 8500,
        included_hours_monthly: 40,
        day_rate: 350,
        performance_fee_default: PERF_FEE,
        start_date: isoDate(today),
        end_date: isoDate(end),
        workstreams: [...DEFAULT_WORKSTREAMS],
        status: 'Active',
        approval_thresholds: {
          hours_overage_hours: 8,
          travel_amount_gbp: 250,
          slotting_fees_required: true,
          exhibition_required: true,
          third_party_costs_required: true,
        },
      },
      supabase
    )

    // 3. Tier-1 accounts + milestones (idempotent).
    const tier1 = SEED_ACCOUNTS.filter((a) => a.role === 'tier1')
    for (const a of tier1) {
      await addTier1Account(engagement.id, idByName.get(a.name)!, PERF_FEE, a.notes, supabase)
    }

    return NextResponse.json({
      engagement_id: engagement.id,
      created,
      linked,
      tier1: tier1.length,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Seed failed' }, { status: 500 })
  }
}
