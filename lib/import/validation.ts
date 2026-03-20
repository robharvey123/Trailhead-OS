import { z } from 'zod'

export const ImportPayloadSchema = z.object({
  workspaceId: z.string().uuid(),
  mode: z.enum(['append', 'replace', 'update']),
  rows: z.array(z.record(z.string(), z.unknown())),
  rowOffset: z.number().int().optional(),
})

export type ImportPayload = {
  workspaceId: string
  mode: 'append' | 'replace' | 'update'
  rows: Record<string, unknown>[]
  rowOffset?: number
}

export type ImportRejectedRow = {
  row: number
  reason: string
}

export type ValidatedRow<T> = {
  row: number
  data: T
}

export type SellInInsert = {
  workspace_id: string
  customer: string
  country: string | null
  brand: string
  product: string
  date: string
  qty_cans: number
  unit_price: number | null
  total: number | null
  promo_cans: number
  currency: string
}

export type SellOutInsert = {
  workspace_id: string
  company: string
  brand: string
  product: string
  month: string
  units: number
  platform: string | null
  region: string | null
  currency: string
}

const excelEpoch = new Date(Date.UTC(1899, 11, 30))

const normalizeText = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).trim()

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const normalized = normalizeText(value).replace(/,/g, '')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const parseInteger = (value: unknown, defaultValue?: number) => {
  const parsed = parseNumber(value)

  if (parsed === null) {
    return defaultValue ?? null
  }

  return Math.round(parsed)
}

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)

const pad2 = (value: number) => String(value).padStart(2, '0')

const normalizeYear = (year: number) => (year < 100 ? 2000 + year : year)

const buildIsoDate = (year: number, month: number, day: number) => {
  const safeYear = normalizeYear(year)
  const date = new Date(Date.UTC(safeYear, month - 1, day))

  if (
    date.getUTCFullYear() !== safeYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return `${safeYear}-${pad2(month)}-${pad2(day)}`
}

const monthMap: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const parseDateText = (text: string) => {
  const normalized = text.trim().replace(/,/g, ' ')
  const lower = normalized.toLowerCase()

  if (/^\d{8}$/.test(lower)) {
    const year = Number(lower.slice(0, 4))
    const month = Number(lower.slice(4, 6))
    const day = Number(lower.slice(6, 8))
    return buildIsoDate(year, month, day)
  }

  if (/^\d{6}$/.test(lower)) {
    const year = Number(lower.slice(0, 4))
    const month = Number(lower.slice(4, 6))
    return buildIsoDate(year, month, 1)
  }

  let match = lower.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/)
  if (match) {
    const [, year, month, day] = match
    return buildIsoDate(Number(year), Number(month), Number(day))
  }

  match = lower.match(/^(\d{4})[\/.-](\d{1,2})$/)
  if (match) {
    const [, year, month] = match
    return buildIsoDate(Number(year), Number(month), 1)
  }

  match = lower.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/)
  if (match) {
    const [, part1, part2, year] = match
    const first = Number(part1)
    const second = Number(part2)
    const yearNum = Number(year)
    const dayFirst = first > 12 || (first <= 12 && second <= 12)
    const day = dayFirst ? first : second
    const month = dayFirst ? second : first
    return buildIsoDate(yearNum, month, day)
  }

  match = lower.match(/^(\d{1,2})[\s-]([a-z]{3,})[\s-](\d{2,4})$/)
  if (match) {
    const [, day, monthName, year] = match
    const month = monthMap[monthName]
    if (month) {
      return buildIsoDate(Number(year), month, Number(day))
    }
  }

  match = lower.match(/^([a-z]{3,})[\s-](\d{1,2})[\s-](\d{2,4})$/)
  if (match) {
    const [, monthName, day, year] = match
    const month = monthMap[monthName]
    if (month) {
      return buildIsoDate(Number(year), month, Number(day))
    }
  }

  match = lower.match(/^([a-z]{3,})[\s-](\d{2,4})$/)
  if (match) {
    const [, monthName, year] = match
    const month = monthMap[monthName]
    if (month) {
      return buildIsoDate(Number(year), month, 1)
    }
  }

  return null
}

const parseDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(excelEpoch.getTime() + value * 86400000)
    return toIsoDate(date)
  }

  const text = normalizeText(value)
  if (!text) {
    return null
  }

  return parseDateText(text)
}

const parseMonth = (value: unknown) => {
  const date = parseDate(value)
  if (!date) {
    return null
  }

  return `${date.slice(0, 7)}-01`
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseImportPayload = (
  body: unknown
): { success: true; data: ImportPayload } | { success: false; error: string } => {
  if (!isRecord(body)) {
    return { success: false, error: 'Invalid payload.' }
  }

  const workspaceId =
    typeof body.workspaceId === 'string' ? body.workspaceId.trim() : ''
  if (!uuidRegex.test(workspaceId)) {
    return { success: false, error: 'Invalid workspace id.' }
  }

  const mode = body.mode
  if (mode !== 'append' && mode !== 'replace' && mode !== 'update') {
    return { success: false, error: 'Invalid import mode.' }
  }

  if (!Array.isArray(body.rows) || !body.rows.every(isRecord)) {
    return { success: false, error: 'Invalid rows payload.' }
  }

  let rowOffset: number | undefined
  if (body.rowOffset !== undefined && body.rowOffset !== null) {
    const parsed =
      typeof body.rowOffset === 'string'
        ? Number(body.rowOffset)
        : typeof body.rowOffset === 'number'
          ? body.rowOffset
          : Number.NaN

    if (!Number.isInteger(parsed)) {
      return { success: false, error: 'Invalid row offset.' }
    }

    rowOffset = parsed
  }

  return {
    success: true,
    data: {
      workspaceId,
      mode,
      rows: body.rows as Record<string, unknown>[],
      rowOffset,
    },
  }
}

export const validateSellInRows = (
  rows: Record<string, unknown>[],
  workspaceId: string,
  rowOffset = 1,
  baseCurrency = 'GBP'
) => {
  const validRows: ValidatedRow<SellInInsert>[] = []
  const rejected: ImportRejectedRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = rowOffset + index
    const customer = normalizeText(row.customer)
    const brand = normalizeText(row.brand)
    const product = normalizeText(row.product)
    const date = parseDate(row.date)
    const qtyCans = parseInteger(row.qty_cans)

    if (!customer) {
      rejected.push({ row: rowNumber, reason: 'Missing customer.' })
      return
    }

    if (!brand) {
      rejected.push({ row: rowNumber, reason: 'Missing brand.' })
      return
    }

    if (!product) {
      rejected.push({ row: rowNumber, reason: 'Missing product.' })
      return
    }

    if (!date) {
      rejected.push({ row: rowNumber, reason: 'Invalid date.' })
      return
    }

    if (qtyCans === null) {
      rejected.push({ row: rowNumber, reason: 'Invalid qty_cans.' })
      return
    }

    const promoCans = parseInteger(row.promo_cans, 0) ?? 0
    const unitPrice = parseNumber(row.unit_price)
    let total = parseNumber(row.total)

    if (total === null && unitPrice !== null) {
      total = unitPrice * qtyCans
    }

    validRows.push({
      row: rowNumber,
      data: {
        workspace_id: workspaceId,
        customer,
        country: normalizeText(row.country) || null,
        brand,
        product,
        date,
        qty_cans: qtyCans,
        unit_price: unitPrice,
        total,
        promo_cans: promoCans,
        currency: normalizeText(row.currency).toUpperCase() || baseCurrency,
      },
    })
  })

  return { validRows, rejected }
}

export const validateSellOutRows = (
  rows: Record<string, unknown>[],
  workspaceId: string,
  rowOffset = 1,
  baseCurrency = 'GBP'
) => {
  const validRows: ValidatedRow<SellOutInsert>[] = []
  const rejected: ImportRejectedRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = rowOffset + index
    const company = normalizeText(row.company)
    const brand = normalizeText(row.brand)
    const product = normalizeText(row.product)
    const month = parseMonth(row.month)
    const units = parseInteger(row.units)

    if (!company) {
      rejected.push({ row: rowNumber, reason: 'Missing company.' })
      return
    }

    if (!brand) {
      rejected.push({ row: rowNumber, reason: 'Missing brand.' })
      return
    }

    if (!product) {
      rejected.push({ row: rowNumber, reason: 'Missing product.' })
      return
    }

    if (!month) {
      rejected.push({ row: rowNumber, reason: 'Invalid month.' })
      return
    }

    if (units === null) {
      rejected.push({ row: rowNumber, reason: 'Invalid units.' })
      return
    }

    validRows.push({
      row: rowNumber,
      data: {
        workspace_id: workspaceId,
        company,
        brand,
        product,
        month,
        units,
        platform: normalizeText(row.platform) || null,
        region: normalizeText(row.region) || null,
        currency: normalizeText(row.currency).toUpperCase() || baseCurrency,
      },
    })
  })

  return { validRows, rejected }
}

// ============================================================
// CRM Account Import
// ============================================================

export type AccountInsert = {
  workspace_id: string
  name: string
  type: string
  industry: string | null
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  country: string | null
  brands: string[]
  created_by: string
}

const validAccountTypes = [
  'customer',
  'prospect',
  'partner',
  'vendor',
  'distributor',
  'retailer',
]

export const validateAccountRows = (
  rows: Record<string, unknown>[],
  workspaceId: string,
  userId: string,
  rowOffset = 1
) => {
  const validRows: ValidatedRow<AccountInsert>[] = []
  const rejected: ImportRejectedRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = rowOffset + index
    const name = normalizeText(row.name)

    if (!name) {
      rejected.push({ row: rowNumber, reason: 'Missing name.' })
      return
    }

    const rawType = normalizeText(row.type).toLowerCase()
    const type = validAccountTypes.includes(rawType) ? rawType : 'customer'

    const brandsRaw = normalizeText(row.brands)
    const brands = brandsRaw
      ? brandsRaw
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
      : []

    validRows.push({
      row: rowNumber,
      data: {
        workspace_id: workspaceId,
        name,
        type,
        industry: normalizeText(row.industry) || null,
        email: normalizeText(row.email) || null,
        phone: normalizeText(row.phone) || null,
        website: normalizeText(row.website) || null,
        city: normalizeText(row.city) || null,
        country: normalizeText(row.country) || null,
        brands,
        created_by: userId,
      },
    })
  })

  return { validRows, rejected }
}

// ============================================================
// CRM Contact Import
// ============================================================

export type ContactInsert = {
  workspace_id: string
  account_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  job_title: string | null
  brands: string[]
  created_by: string
}

export const validateContactRows = (
  rows: Record<string, unknown>[],
  workspaceId: string,
  userId: string,
  accountNameMap: Map<string, string>,
  rowOffset = 1
) => {
  const validRows: ValidatedRow<ContactInsert>[] = []
  const rejected: ImportRejectedRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = rowOffset + index
    const firstName = normalizeText(row.first_name)
    const lastName = normalizeText(row.last_name)

    if (!firstName) {
      rejected.push({ row: rowNumber, reason: 'Missing first_name.' })
      return
    }

    if (!lastName) {
      rejected.push({ row: rowNumber, reason: 'Missing last_name.' })
      return
    }

    const accountName = normalizeText(row.account_name)
    const accountId = accountName
      ? accountNameMap.get(accountName.toLowerCase()) || null
      : null

    const brandsRaw = normalizeText(row.brands)
    const brands = brandsRaw
      ? brandsRaw
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
      : []

    validRows.push({
      row: rowNumber,
      data: {
        workspace_id: workspaceId,
        account_id: accountId,
        first_name: firstName,
        last_name: lastName,
        email: normalizeText(row.email) || null,
        phone: normalizeText(row.phone) || null,
        job_title: normalizeText(row.job_title) || null,
        brands,
        created_by: userId,
      },
    })
  })

  return { validRows, rejected }
}
