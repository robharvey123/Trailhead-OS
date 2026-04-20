/**
 * Import CRM master contacts from Trailhead_CRM_Master.xlsx
 *
 * Usage:
 *   npx tsx scripts/import-crm-master.ts
 *   npx tsx scripts/import-crm-master.ts --file /path/to/file.xlsx
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { resolve } from 'path'
import { readFileSync } from 'fs'
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

// Load env from .env.local
function loadEnv(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // .env.local may not exist
  }
}

loadEnv(resolve(process.cwd(), '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const SKIP_SHEETS = new Set(['Summary', 'Index', 'All Contacts'])

// Column header mappings (case-insensitive, trimmed)
const HEADER_MAP: Record<string, string> = {
  'business name': 'business_name',
  'website': 'website',
  'phone': 'phone',
  'email / contact': 'email_contact',
  'email': 'email_contact',
  'email/contact': 'email_contact',
  'hq / address': 'hq_address',
  'hq/address': 'hq_address',
  'hq address': 'hq_address',
  'address': 'hq_address',
  'key contact name': 'contact_name',
  'key contact': 'contact_name',
  'contact name': 'contact_name',
  'role / title': 'role_title',
  'role/title': 'role_title',
  'role': 'role_title',
  'title': 'role_title',
  'notes': 'notes',
  'channel': 'channel',
  'status': 'status',
  'last contacted': 'last_contacted',
  'next action': 'next_action',
  'source': 'source',
}

const VALID_STATUSES = new Set([
  'prospect', 'contacted', 'active', 'listed', 'declined', 'on_hold',
  'inactive', 'archived',
])

function normaliseStatus(raw: string | undefined): string {
  if (!raw) return 'prospect'
  const lower = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return VALID_STATUSES.has(lower) ? lower : 'prospect'
}

function cellText(cell: ExcelJS.Cell): string {
  const val = cell.value
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number') return String(val)
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'object' && 'text' in val) return String((val as { text: string }).text).trim()
  if (typeof val === 'object' && 'result' in val) return String((val as { result: unknown }).result ?? '').trim()
  return String(val).trim()
}

interface RowData {
  business_name?: string
  website?: string
  phone?: string
  email_contact?: string
  hq_address?: string
  contact_name?: string
  role_title?: string
  notes?: string
  channel?: string
  status?: string
  last_contacted?: string
  next_action?: string
  source?: string
}

async function main() {
  // Parse --file argument
  const fileArgIdx = process.argv.indexOf('--file')
  const filePath = fileArgIdx !== -1 && process.argv[fileArgIdx + 1]
    ? resolve(process.argv[fileArgIdx + 1])
    : resolve(process.cwd(), 'data', 'Trailhead_CRM_Master.xlsx')

  console.log(`Reading: ${filePath}\n`)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const summary: Array<{ channel: string; added: number; updated: number; skipped: number }> = []

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name.trim()
    if (SKIP_SHEETS.has(sheetName)) {
      console.log(`Skipping sheet: ${sheetName}`)
      continue
    }

    console.log(`\nProcessing sheet: ${sheetName}`)

    // Row 1 = headers
    const headerRow = worksheet.getRow(1)
    const colMap = new Map<number, string>()

    headerRow.eachCell((cell, colNumber) => {
      const headerText = cellText(cell).toLowerCase().trim()
      const mapped = HEADER_MAP[headerText]
      if (mapped) {
        colMap.set(colNumber, mapped)
      }
    })

    if (!colMap.size) {
      console.log(`  No recognised headers — skipping`)
      continue
    }

    let added = 0
    let updated = 0
    let skipped = 0

    // Data from row 2 onwards
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum)
      const data: RowData = {}

      colMap.forEach((field, colNumber) => {
        const val = cellText(row.getCell(colNumber))
        if (val) {
          ;(data as Record<string, string>)[field] = val
        }
      })

      // Use sheet name as channel if not explicitly set in row
      if (!data.channel) {
        data.channel = sheetName
      }

      const businessName = data.business_name?.trim()
      if (!businessName) {
        skipped++
        continue
      }

      // Check for existing account by name (case-insensitive)
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .ilike('name', businessName)
        .limit(1)
        .maybeSingle()

      const accountPayload = {
        name: businessName,
        website: data.website || null,
        email_contact: data.email_contact || null,
        hq_address: data.hq_address || null,
        channel: data.channel || null,
        source: data.source || null,
        status: normaliseStatus(data.status),
        notes: data.notes || null,
      }

      let accountId: string

      if (existing) {
        // Update existing account
        const { data: updatedAccount, error } = await supabase
          .from('accounts')
          .update(accountPayload)
          .eq('id', existing.id)
          .select('id')
          .single()

        if (error) {
          console.error(`  Error updating "${businessName}": ${error.message}`)
          skipped++
          continue
        }

        accountId = updatedAccount.id
        updated++
      } else {
        // Insert new account
        const { data: newAccount, error } = await supabase
          .from('accounts')
          .insert(accountPayload)
          .select('id')
          .single()

        if (error) {
          console.error(`  Error inserting "${businessName}": ${error.message}`)
          skipped++
          continue
        }

        accountId = newAccount.id
        added++
      }

      // Upsert contact if Key Contact Name present
      const contactName = data.contact_name?.trim()
      if (contactName) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('account_id', accountId)
          .ilike('name', contactName)
          .limit(1)
          .maybeSingle()

        const contactPayload = {
          account_id: accountId,
          name: contactName,
          role: data.role_title || null,
          email: data.email_contact || null,
          phone: data.phone || null,
          status: 'lead' as const,
        }

        if (existingContact) {
          await supabase
            .from('contacts')
            .update(contactPayload)
            .eq('id', existingContact.id)
        } else {
          await supabase.from('contacts').insert(contactPayload)
        }
      }
    }

    summary.push({ channel: sheetName, added, updated, skipped })
    console.log(`  Added: ${added}, Updated: ${updated}, Skipped: ${skipped}`)
  }

  console.log('\n--- Import Summary ---')
  console.log('Channel                          | Added | Updated | Skipped')
  console.log('-'.repeat(65))
  let totalAdded = 0
  let totalUpdated = 0
  let totalSkipped = 0
  for (const row of summary) {
    console.log(
      `${row.channel.padEnd(33)}| ${String(row.added).padEnd(6)}| ${String(row.updated).padEnd(8)}| ${row.skipped}`
    )
    totalAdded += row.added
    totalUpdated += row.updated
    totalSkipped += row.skipped
  }
  console.log('-'.repeat(65))
  console.log(
    `${'TOTAL'.padEnd(33)}| ${String(totalAdded).padEnd(6)}| ${String(totalUpdated).padEnd(8)}| ${totalSkipped}`
  )
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
