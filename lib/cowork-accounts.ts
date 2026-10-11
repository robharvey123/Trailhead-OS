import {
  ACCOUNT_SELECT,
  CoworkApiError,
  accountCounts,
  findAccountByExactName,
  formatAccount,
  getAccountById,
  getWorkstreamBySlug,
  noRecognisedFieldsError,
  optionalNumber,
  optionalString,
  parseAccountStatus,
  parseBooleanBody,
  parseTags,
  requiredString,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { ACCOUNT_SIZE_OPTIONS } from '@/lib/crm/account-options'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Shared account write logic for the Cowork REST API and the MCP server — same
 * contract as lib/cowork-projects.ts: helpers throw `CoworkApiError`, routes map
 * it via `jsonError`, MCP wraps thrown errors. Field rules follow the UI route
 * /api/accounts/[id] (blank text → null), except that a malformed value is a 400
 * here rather than being silently nulled.
 *
 * The reference-guarded DELETE stays in its route; it has no MCP twin.
 */

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const ACCOUNT_PATCH_FIELDS = [
  'name',
  'website',
  'industry',
  'status',
  'channel',
  'source',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'country',
  'notes',
  'tags',
  'default_hourly_rate',
  'hq_address',
  'workstream',
  'size',
  'email_contact',
  'vat_number',
  'company_number',
  'billing_email',
  'payment_terms_days',
  'po_required',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ACCOUNT_SIZES = new Set<string>(ACCOUNT_SIZE_OPTIONS)

function optionalEmail(value: unknown, field: string) {
  const email = optionalString(value)
  if (email && !EMAIL_RE.test(email)) {
    throw new CoworkApiError(`${field} must be a valid email address`, 400)
  }
  return email
}

/** Parse every supplied account field into its column; absent fields are skipped. */
async function parseAccountFields(body: Record<string, unknown>) {
  const fields: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = optionalString(body.name)
    if (!name) throw new CoworkApiError('name must be a non-empty string', 400)
    fields.name = name
  }
  if (body.status !== undefined) fields.status = parseAccountStatus(body.status)

  for (const key of [
    'website',
    'industry',
    'channel',
    'source',
    'address_line1',
    'address_line2',
    'city',
    'postcode',
    'country',
    'notes',
    'hq_address',
    'vat_number',
    'company_number',
  ]) {
    if (body[key] !== undefined) fields[key] = optionalString(body[key])
  }

  if (body.tags !== undefined) fields.tags = parseTags(body.tags) ?? []
  if (body.default_hourly_rate !== undefined) {
    fields.default_hourly_rate = optionalNumber(body.default_hourly_rate, 'default_hourly_rate')
  }
  if (body.workstream !== undefined) {
    const slug = optionalString(body.workstream)
    fields.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
  }
  if (body.size !== undefined) {
    const size = optionalString(body.size)
    if (size && !ACCOUNT_SIZES.has(size)) {
      throw new CoworkApiError(`size must be one of ${ACCOUNT_SIZE_OPTIONS.join(', ')}`, 400)
    }
    fields.size = size
  }
  if (body.email_contact !== undefined) fields.email_contact = optionalEmail(body.email_contact, 'email_contact')
  if (body.billing_email !== undefined) fields.billing_email = optionalEmail(body.billing_email, 'billing_email')
  if (body.payment_terms_days !== undefined) {
    const days = optionalNumber(body.payment_terms_days, 'payment_terms_days')
    if (days !== null && !Number.isInteger(days)) {
      throw new CoworkApiError('payment_terms_days must be a non-negative integer', 400)
    }
    fields.payment_terms_days = days
  }
  if (body.po_required !== undefined) {
    const required = parseBooleanBody(body.po_required, 'po_required')
    if (required === undefined) throw new CoworkApiError('po_required must be a boolean', 400)
    fields.po_required = required
  }

  return fields
}

async function withCounts(row: unknown) {
  const id = (row as { id: string }).id
  const { contacts, openTasks } = await accountCounts([id])
  return formatAccount(row as never, { contacts: contacts.get(id) ?? 0, open_tasks: openTasks.get(id) ?? 0 })
}

/**
 * POST /api/cowork/accounts and the MCP `create_account` tool. A case-insensitive
 * duplicate name creates nothing and returns the existing row with
 * `existing: true` (the route turns that into a 409).
 */
export async function createCoworkAccount(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')

  const duplicate = await findAccountByExactName(name)
  if (duplicate) return { existing: true as const, account: await withCounts(duplicate) }

  const fields = await parseAccountFields(body)
  const { data, error } = await supabaseService
    .from('accounts')
    .insert({
      website: null,
      industry: null,
      channel: null,
      source: null,
      address_line1: null,
      address_line2: null,
      city: null,
      postcode: null,
      country: null,
      notes: null,
      default_hourly_rate: null,
      hq_address: null,
      workstream_id: null,
      ...fields,
      name,
      status: fields.status ?? parseAccountStatus(undefined),
      tags: fields.tags ?? [],
    })
    .select(ACCOUNT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create account', 500)

  const account = formatAccount(data as never, { contacts: 0, open_tasks: 0 })
  void recordCoworkWrite({
    action: 'create',
    entity: 'account',
    entityId: account.id,
    entityLabel: account.name,
    summary: `Created account "${account.name}"${account.status ? ` (${account.status})` : ''}`,
    payload: body,
  })
  return { existing: false as const, account }
}

/**
 * PATCH /api/cowork/accounts/[id] and the MCP `update_account` tool. Renaming
 * onto another account's name is the same 409 as a duplicate create.
 */
export async function updateCoworkAccount(id: string, body: Record<string, unknown>) {
  await getAccountById(id) // 404 if missing
  const patch = await parseAccountFields(body)

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) throw noRecognisedFieldsError(body, ACCOUNT_PATCH_FIELDS)
    throw new CoworkApiError('No changes supplied', 400)
  }

  if (typeof patch.name === 'string') {
    const clash = await findAccountByExactName(patch.name)
    if (clash && clash.id !== id) {
      throw new CoworkApiError(`An account named "${clash.name}" already exists`, 409, {
        account: { id: clash.id, name: clash.name },
      })
    }
  }

  const { data, error } = await supabaseService
    .from('accounts')
    .update(patch)
    .eq('id', id)
    .select(ACCOUNT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update account', 500)

  const account = await withCounts(data)
  void recordCoworkWrite({
    action: 'update',
    entity: 'account',
    entityId: account.id,
    entityLabel: account.name,
    summary: `Updated account "${account.name}" (${Object.keys(patch).join(', ')})`,
    payload: body,
  })
  return account
}
