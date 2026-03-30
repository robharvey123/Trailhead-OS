import Anthropic from '@anthropic-ai/sdk'

// Remember to add ANTHROPIC_API_KEY to Netlify environment
// variables if not already there.
// Netlify: Site config -> Environment variables -> Add variable
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Model constants - update these when models change
export const ANTHROPIC_MODELS = {
  // Use Opus for complex reasoning, structured JSON generation,
  // project planning, quote generation - high stakes outputs
  OPUS: 'claude-opus-4-6',

  // Use Sonnet for conversational tasks, summaries, briefings,
  // simpler structured outputs - good balance of quality and cost
  SONNET: 'claude-sonnet-4-6',

  // Use Haiku for simple classification, short extractions,
  // high-volume low-stakes tasks
  HAIKU: 'claude-haiku-4-5-20251001',
} as const
