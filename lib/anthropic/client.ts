import Anthropic from '@anthropic-ai/sdk'

// Remember to add ANTHROPIC_API_KEY to Vercel environment
// variables if not already there.
// Vercel: Project settings -> Environment Variables -> Add
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Model constants - update these when models change.
// NOTE (Claude 5 family): thinking is ON by default on Opus 5 / Sonnet 5 and
// counts against max_tokens, so call sites need headroom beyond the expected
// answer; sampling params (temperature/top_p/top_k) are rejected with a 400.
export const ANTHROPIC_MODELS = {
  // Use Opus for complex reasoning, structured JSON generation,
  // project planning, quote generation - high stakes outputs
  OPUS: 'claude-opus-5',

  // Use Sonnet for conversational tasks, summaries, briefings,
  // simpler structured outputs - good balance of quality and cost
  SONNET: 'claude-sonnet-5',

  // Use Haiku for simple classification, short extractions,
  // high-volume low-stakes tasks
  HAIKU: 'claude-haiku-4-5-20251001',
} as const
