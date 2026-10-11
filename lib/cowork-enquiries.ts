import {
  CoworkApiError,
  ENQUIRY_SELECT,
  formatEnquiry,
  noRecognisedFieldsError,
  optionalLinkedId,
  optionalString,
  parseEnquiryStatus,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { rpcScalar } from '@/lib/cowork-engagements'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Enquiry triage for the Cowork REST API and the MCP server — same contract as
 * lib/cowork-projects.ts. Deliberately narrow: status, internal notes and the
 * converted-contact link. The submitted answers stay as the client sent them.
 */

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const ENQUIRY_PATCH_FIELDS = ['status', 'internal_notes', 'converted_contact_id']

/** GET /api/cowork/enquiries/[id]. */
export async function getCoworkEnquiry(id: string) {
  const { data, error } = await supabaseService.from('enquiries').select(ENQUIRY_SELECT).eq('id', id).maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load enquiry', 500)
  if (!data) throw new CoworkApiError('Enquiry not found', 404)
  return formatEnquiry(data as never)
}

/**
 * PATCH /api/cowork/enquiries/[id] and the MCP `update_enquiry` tool. Writing
 * internal_notes stamps internal_notes_updated_at and the author, as the
 * enquiry page's autosave does (the author is the OS owner — the token has no
 * user of its own).
 */
export async function updateCoworkEnquiry(id: string, body: Record<string, unknown>) {
  const existing = await getCoworkEnquiry(id) // 404 if missing
  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !body.status) {
      throw new CoworkApiError('status must be a string', 400)
    }
    patch.status = parseEnquiryStatus(body.status)
  }
  if (body.internal_notes !== undefined) {
    patch.internal_notes = optionalString(body.internal_notes)
    patch.internal_notes_updated_at = new Date().toISOString()
    patch.internal_notes_author_id = await rpcScalar('owner_user_id').catch(() => null)
  }
  if (body.converted_contact_id !== undefined) {
    patch.converted_contact_id = await optionalLinkedId(body.converted_contact_id, 'converted_contact_id', 'contacts')
  }

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) throw noRecognisedFieldsError(body, ENQUIRY_PATCH_FIELDS)
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('enquiries')
    .update(patch)
    .eq('id', id)
    .select(ENQUIRY_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update enquiry', 500)

  const enquiry = formatEnquiry(data as never)
  const changed = Object.keys(body).filter((key) => ENQUIRY_PATCH_FIELDS.includes(key))
  void recordCoworkWrite({
    action: 'update',
    entity: 'enquiry',
    entityId: enquiry.id,
    entityLabel: enquiry.biz_name,
    summary:
      patch.status !== undefined && patch.status !== existing.status
        ? `Moved enquiry from ${enquiry.biz_name} to ${enquiry.status} (was ${existing.status})${changed.length > 1 ? `; also ${changed.filter((k) => k !== 'status').join(', ')}` : ''}`
        : `Updated enquiry from ${enquiry.biz_name} (${changed.join(', ')})`,
    before: Object.fromEntries(changed.map((key) => [key, existing[key as keyof typeof existing] ?? null])),
    payload: body,
  })
  return enquiry
}
