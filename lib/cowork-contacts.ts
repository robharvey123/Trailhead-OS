import {
  CONTACT_SELECT,
  CoworkApiError,
  formatContact,
  getContactById,
  getWorkstreamBySlug,
  noRecognisedFieldsError,
  optionalLinkedId,
  optionalString,
  parseBooleanBody,
  parseContactStatus,
  parseTags,
  requiredString,
} from '@/lib/cowork-api'
import { createCoworkAccount } from '@/lib/cowork-accounts'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { normaliseUkPhone } from '@/lib/ctps/datasoap'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Shared contact write logic for the Cowork REST API (/api/cowork/crm) and the
 * MCP server — same contract as lib/cowork-projects.ts. Field rules follow the UI
 * route /api/contacts/[id]: blank text → null, tags trimmed, do_not_* booleans.
 */

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const CONTACT_PATCH_FIELDS = [
  'name',
  'company',
  'email',
  'phone',
  'role',
  'status',
  'notes',
  'account_id',
  'workstream',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'country',
  'channel',
  'website',
  'tags',
  'do_not_email',
  'do_not_call',
]

const TEXT_FIELDS = [
  'company',
  'email',
  'phone',
  'role',
  'notes',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'country',
  'channel',
  'website',
]

/** Parse every supplied contact field into its column; absent fields are skipped. */
async function parseContactFields(body: Record<string, unknown>) {
  const fields: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = optionalString(body.name)
    if (!name) throw new CoworkApiError('name is required', 400)
    fields.name = name
  }
  for (const key of TEXT_FIELDS) {
    if (body[key] !== undefined) fields[key] = optionalString(body[key])
  }
  if (body.status !== undefined) fields.status = parseContactStatus(body.status)
  if (body.account_id !== undefined) {
    fields.account_id = await optionalLinkedId(body.account_id, 'account_id', 'accounts')
  }
  if (body.workstream !== undefined) {
    const slug = optionalString(body.workstream)
    fields.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
  }
  if (body.tags !== undefined) fields.tags = parseTags(body.tags) ?? []
  for (const key of ['do_not_email', 'do_not_call']) {
    if (body[key] === undefined) continue
    const flag = parseBooleanBody(body[key], key)
    if (flag === undefined) throw new CoworkApiError(`${key} must be a boolean`, 400)
    fields[key] = flag
  }

  return fields
}

/** POST /api/cowork/crm. Unsupplied columns keep their DB defaults (country 'UK'). */
export async function createCoworkContact(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')
  const fields = await parseContactFields(body)

  const { data, error } = await supabaseService
    .from('contacts')
    .insert({ ...fields, name, status: fields.status ?? parseContactStatus(undefined) })
    .select(CONTACT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create contact', 500)

  const contact = formatContact(data as never)
  void recordCoworkWrite({
    action: 'create',
    entity: 'contact',
    entityId: contact.id,
    entityLabel: contact.name,
    summary: `Created contact "${contact.name}"${contact.company ? ` at ${contact.company}` : ''}`,
    payload: body,
  })
  return contact
}

/** Escape LIKE wildcards so an ilike match is an exact case-insensitive match. */
function likeExact(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Compare phones as UK numbers when they are, else as bare digits. */
function phoneKey(phone: string | null | undefined) {
  if (!phone?.trim()) return null
  return normaliseUkPhone(phone) ?? (phone.replace(/\D/g, '') || null)
}

/**
 * The live (unmerged) contact a new prospect would duplicate: same email
 * (case-insensitive), or same company (case-insensitive) and same phone.
 */
async function findDuplicateContact(email: string | null, company: string | null, phone: string | null) {
  if (email) {
    const { data, error } = await supabaseService
      .from('contacts')
      .select('id, email')
      .is('merged_into', null)
      .ilike('email', likeExact(email))
    if (error) throw new CoworkApiError(error.message || 'Failed to check for duplicates', 500)
    const hit = ((data ?? []) as Array<{ id: string; email: string | null }>).find(
      (c) => c.email?.trim().toLowerCase() === email.toLowerCase(),
    )
    if (hit) return hit.id
  }
  const key = phoneKey(phone)
  if (company && key) {
    const { data, error } = await supabaseService
      .from('contacts')
      .select('id, company, phone')
      .is('merged_into', null)
      .ilike('company', likeExact(company))
    if (error) throw new CoworkApiError(error.message || 'Failed to check for duplicates', 500)
    const hit = ((data ?? []) as Array<{ id: string; company: string | null; phone: string | null }>).find(
      (c) => c.company?.trim().toLowerCase() === company.toLowerCase() && phoneKey(c.phone) === key,
    )
    if (hit) return hit.id
  }
  return null
}

/**
 * MCP `create_contact`: a sales prospect (outreach and the call queue run on
 * contacts). Duplicate-safe: an email match, or a company + phone match,
 * returns the existing contact with `existing: true` and creates nothing.
 * Column set matches /api/contacts/import. `account_name` finds or creates the
 * account (case-insensitive, via createCoworkAccount). CTPS screening is the
 * caller's job (it needs the new id).
 */
export async function createProspectContact(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')
  const email = optionalString(body.email)
  const company = optionalString(body.company)
  const phone = optionalString(body.phone)

  const duplicateId = await findDuplicateContact(email, company, phone)
  if (duplicateId) return { existing: true as const, contact: formatContact(await getContactById(duplicateId)) }

  const workstreamSlug = optionalString(body.workstream)
  const workstreamId = workstreamSlug ? (await getWorkstreamBySlug(workstreamSlug)).id : null

  let accountId: string | null = null
  const accountName = optionalString(body.account_name)
  if (accountName) {
    const { account } = await createCoworkAccount({ name: accountName, status: 'prospect', workstream: workstreamSlug })
    accountId = account.id
  }

  const country = optionalString(body.country)
  const { data, error } = await supabaseService
    .from('contacts')
    .insert({
      name,
      company,
      email,
      email_greeting: optionalString(body.email_greeting),
      phone,
      role: optionalString(body.role),
      city: optionalString(body.city),
      postcode: optionalString(body.postcode),
      ...(country ? { country } : {}), // else the column default ('UK')
      channel: optionalString(body.channel),
      website: optionalString(body.website),
      sub_trade: optionalString(body.sub_trade),
      size_signal: optionalString(body.size_signal),
      ctps_registered: null,
      ctps_checked_at: null,
      status: parseContactStatus(body.status),
      notes: optionalString(body.notes),
      tags: parseTags(body.tags) ?? [],
      account_id: accountId,
      workstream_id: workstreamId,
    })
    .select(CONTACT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create contact', 500)

  const contact = formatContact(data as never)
  void recordCoworkWrite({
    action: 'create',
    entity: 'contact',
    entityId: contact.id,
    entityLabel: contact.name,
    summary: `Created prospect "${contact.name}"${contact.company ? ` at ${contact.company}` : ''}`,
    payload: body,
  })
  return { existing: false as const, contact }
}

/** PATCH /api/cowork/crm/[id] and the MCP `update_contact` tool. */
export async function updateCoworkContact(id: string, body: Record<string, unknown>) {
  await getContactById(id) // 404 if missing
  const patch = await parseContactFields(body)

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) throw noRecognisedFieldsError(body, CONTACT_PATCH_FIELDS)
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select(CONTACT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update contact', 500)

  const contact = formatContact(data as never)
  void recordCoworkWrite({
    action: 'update',
    entity: 'contact',
    entityId: contact.id,
    entityLabel: contact.name,
    summary: `Updated contact "${contact.name}" (${Object.keys(patch).join(', ')})`,
    payload: body,
  })
  return contact
}

/**
 * DELETE /api/cowork/crm/[id]. A SOFT archive (status → archived), never a row
 * delete: contacts are referenced by tasks, invoices, enquiries and email logs.
 */
export async function archiveCoworkContact(id: string) {
  const existing = await getContactById(id) // 404 if missing

  const { error } = await supabaseService.from('contacts').update({ status: 'archived' }).eq('id', id)
  if (error) throw new CoworkApiError(error.message || 'Failed to archive contact', 500)

  void recordCoworkWrite({
    action: 'delete',
    entity: 'contact',
    entityId: id,
    entityLabel: existing.name,
    summary: `Archived contact "${existing.name}"${existing.company ? ` at ${existing.company}` : ''} (was ${existing.status})`,
    before: { status: existing.status },
    payload: formatContact(existing),
  })
  return { archived: true }
}
