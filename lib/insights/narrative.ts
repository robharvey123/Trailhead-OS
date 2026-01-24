import OpenAI from 'openai'
import type { InsightsData } from './data'

export type InsightsNarrative = {
  title: string
  summary: string
  highlights: string[]
  risks: string[]
  actions: string[]
}

const buildPayload = (
  data: InsightsData,
  includeFinancials: boolean
) => {
  const monthlySummary = data.monthlySummary.map((row) => ({
    month: row.month,
    sellIn: row.sellIn,
    promo: row.promo,
    totalShipped: row.totalShipped,
    sellOut: row.sellOut,
    channelStock: row.channelStock,
    sellThrough: row.sellThrough,
    revenue: includeFinancials ? row.revenue : undefined,
  }))

  const latestMonth = data.monthlySummary.at(-1)?.month ?? null
  const latestSellOutMonth =
    [...data.monthlySummary]
      .reverse()
      .find((row) => row.sellOut > 0)?.month ?? null

  const totals = {
    sellIn: data.totals.sellIn,
    promo: data.totals.promo,
    totalShipped: data.totals.totalShipped,
    sellOut: data.totals.sellOut,
    channelStock: data.totals.channelStock,
    sellThrough: data.totals.sellThrough,
    revenue: includeFinancials ? data.totals.revenue : undefined,
    cogs: includeFinancials ? data.totals.cogs : undefined,
    grossProfit: includeFinancials ? data.totals.grossProfit : undefined,
    promoCost: includeFinancials ? data.totals.promoCost : undefined,
    netContribution: includeFinancials ? data.totals.netContribution : undefined,
  }

  return {
    period: {
      brand: data.brand,
      start: data.start || null,
      end: data.end || null,
    },
    reportingNotes: {
      sellOutLagDays: 15,
      guidance:
        'Sell-out reports are typically received mid-next-month, so the latest month may be incomplete.',
      latestMonth,
      latestSellOutMonth,
    },
    currencySymbol: data.currencySymbol,
    totals,
    monthlySummary,
    topCustomers: data.customerInbound.slice(0, 12),
    topCompanies: data.companySummary.slice(0, 12),
    platformData: data.platformData,
    regionData: data.regionData,
    includeFinancials,
  }
}

export const generateInsightsNarrative = async ({
  data,
  reportType,
  includeFinancials,
}: {
  data: InsightsData
  reportType: 'exec' | 'detailed'
  includeFinancials: boolean
}): Promise<InsightsNarrative> => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const openai = new OpenAI({ apiKey })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1'

  const payload = buildPayload(data, includeFinancials)

  const instructions = `
You are an analytics strategist preparing a monthly S&OP report.
Return JSON only with keys: title, summary, highlights, risks, actions.
Summary should be a short paragraph. Highlights, risks, actions should be bullet lists of strings.
For exec reports, keep it tight (summary 3-4 sentences, 3-5 bullets each list).
For detailed reports, provide deeper insight (summary 6-8 sentences, 5-7 bullets each list).
If financials are excluded, do not mention revenue, COGS, profit, or contribution.
Always mention inbound vs outbound performance and channel stock.
Sell-out reporting can lag by ~2-4 weeks; if the latest month shows low/zero sell-out,
call out that it may be incomplete and avoid negative conclusions based solely on that month.
Promo stock is valued at zero; do not treat promo units as a cost line item.
`

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: instructions.trim() },
      {
        role: 'user',
        content: JSON.stringify({
          reportType,
          data: payload,
        }),
      },
    ],
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(content) as InsightsNarrative

  return {
    title: parsed.title || 'Monthly S&OP summary',
    summary: parsed.summary || '',
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  }
}
