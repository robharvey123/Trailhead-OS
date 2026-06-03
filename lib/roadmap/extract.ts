import mammoth from 'mammoth'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { RoadmapExtractionSchema, type RoadmapExtraction } from './schema'

export const MAX_INPUT_CHARS = 40_000

// mammoth's bundled types omit convertToMarkdown, though it exists at runtime.
const mammothMd = mammoth as unknown as {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>
}

export async function docxToMarkdown(buf: Buffer): Promise<string> {
  const { value } = await mammothMd.convertToMarkdown({ buffer: buf })
  return value
}

/** .md files are used as-is; .docx is converted. Returns the markdown to feed the LLM. */
export async function fileToMarkdown(filename: string, buf: Buffer): Promise<string> {
  if (filename.toLowerCase().endsWith('.docx')) return docxToMarkdown(buf)
  return buf.toString('utf8')
}

// Grounded in the real roadmap (sprints M1–M7 with Goal + Deliverables + Exit
// criteria; a Definition of Done; an "Immediate next actions" table).
const SYSTEM_PROMPT = `You extract structured task lists from roadmap and planning documents.

Rules:
- Each top-level sprint, phase, milestone, or workstream becomes a "milestone" (e.g. "Sprint M1", "Phase 2", "Immediate next actions").
- Each concrete, actionable deliverable or commitment inside it becomes a "task". The bullet items under a "Deliverables" heading, and the rows of an actions/next-steps table, are tasks.
- A section's goal/overview prose becomes the milestone "summary"; do not turn descriptive prose into tasks.
- Task titles are imperative and concise: "Set up Supabase project", not "Supabase project needs to be set up". If a deliverable bundles many items (e.g. a forms library of 15-20 templates), keep it as ONE task and put the list in the description — do not silently drop it.
- Priority from language: "critical", "must", "blocker", "P0", "no slack", "critical path" → urgent; "should", "important", "required" → high; default → normal; "stretch", "nice to have", "illustrative" → low.
- If a section names a month or an explicit date, set suggested_due_date to the LAST day of that month in ISO YYYY-MM-DD. If a table row has a Due column (e.g. "M1 wk 1"), leave suggested_due_date empty (it's relative, not a calendar date) but keep it in the description.
- Add the milestone name as a label on every task (e.g. "Sprint M1"). Add other obvious tag labels from context: "regulatory", "security", "integration", "payments", "infrastructure", etc.
- DO NOT extract these as tasks: "Exit criteria", "Definition of Done", decision gates, risk-register rows, constraints, north-star metrics, or any assertion about a desired future state. Skip them entirely.
- Return STRICT JSON matching the schema. No commentary, no markdown fences.

Schema:
{
  "project_title": "string (optional)",
  "overview": "string (optional)",
  "milestones": [
    { "name": "string", "summary": "string (optional)",
      "tasks": [ { "title": "string", "description": "string (optional)", "priority": "low|normal|high|urgent", "suggested_due_date": "YYYY-MM-DD (optional)", "labels": ["string"] } ] }
  ]
}`

/** Pull the largest plausible JSON object out of a model response (handles ```json fences + preamble). */
export function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in model output')
  return candidate.slice(start, end + 1)
}

export class RoadmapTooLargeError extends Error {}

/**
 * docx/md markdown → validated RoadmapExtraction via Claude Haiku. Retries up to
 * 3x with a firmer "JSON only" nudge on parse/validation failure.
 */
export async function extractRoadmap(markdown: string): Promise<RoadmapExtraction> {
  if (markdown.length > MAX_INPUT_CHARS) {
    throw new RoadmapTooLargeError(
      `Document is too large (${markdown.length} chars > ${MAX_INPUT_CHARS}). Split it into sections and import separately.`
    )
  }

  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const nudge = attempt === 0 ? '' : '\n\nReturn ONLY the JSON object, no other text, no markdown fences.'
    const res = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.HAIKU,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Roadmap document:\n\n${markdown}\n\nReturn the JSON only.${nudge}` }],
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    try {
      return RoadmapExtractionSchema.parse(JSON.parse(extractJsonBlock(text)))
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(
    `Could not parse a valid roadmap from the model after 3 attempts: ${lastErr instanceof Error ? lastErr.message : 'unknown error'}`
  )
}
