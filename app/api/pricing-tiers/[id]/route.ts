import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import {
  getPricingTierById,
  updatePricingTier,
} from '@/lib/db/pricing-tiers'

const FORBIDDEN_PATCH_FIELDS = new Set(['slug', 'name', 'sort_order'])

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    const pricingTier = await getPricingTierById(id, auth.supabase)

    if (!pricingTier) {
      return NextResponse.json({ error: 'Pricing tier not found' }, { status: 404 })
    }

    return NextResponse.json({ pricing_tier: pricingTier })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pricing tier' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))

  for (const key of FORBIDDEN_PATCH_FIELDS) {
    if (body[key] !== undefined) {
      return NextResponse.json(
        { error: `${key} cannot be updated` },
        { status: 400 }
      )
    }
  }

  const patch: Record<string, string | number | boolean | null> = {}

  if (body.description !== undefined) {
    patch.description = sanitizeText(body.description)
  }

  for (const key of [
    'hourly_rate',
    'day_rate',
    'monthly_retainer',
    'hosting_maintenance',
    'fixed_fee_margin',
  ] as const) {
    if (body[key] !== undefined) {
      const numeric = sanitizeNumber(body[key])
      if (numeric === null) {
        return NextResponse.json(
          { error: `${key} must be numeric` },
          { status: 400 }
        )
      }
      patch[key] = numeric
    }
  }

  if (body.is_default !== undefined) {
    if (typeof body.is_default !== 'boolean') {
      return NextResponse.json(
        { error: 'is_default must be a boolean' },
        { status: 400 }
      )
    }
    patch.is_default = body.is_default
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid changes supplied' }, { status: 400 })
  }

  const { id } = await params

  try {
    const existing = await getPricingTierById(id, auth.supabase)
    if (!existing) {
      return NextResponse.json({ error: 'Pricing tier not found' }, { status: 404 })
    }

    const pricingTier = await updatePricingTier(id, patch, auth.supabase)
    return NextResponse.json({ pricing_tier: pricingTier })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update pricing tier' },
      { status: 500 }
    )
  }
}
