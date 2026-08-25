/**
 * Positional click-through-rate curve (Growth module).
 *
 * THIS IS A MODEL, NOT A MEASUREMENT. It is a standard industry-shaped organic
 * CTR curve used only to estimate the upside of moving a query from one
 * position to another. Every UI surface that shows a figure derived from it
 * must say "estimated" and point at this curve as the assumption.
 */

/** Expected organic CTR by position (1-indexed). Beyond 10 falls below 1%. */
export const CTR_BY_POSITION: Record<number, number> = {
  1: 0.28,
  2: 0.15,
  3: 0.11,
  4: 0.08,
  5: 0.06,
  6: 0.045,
  7: 0.035,
  8: 0.03,
  9: 0.025,
  10: 0.02,
}

export function ctrForPosition(position: number | null): number {
  if (position === null || !Number.isFinite(position) || position < 1) return 0
  const rounded = Math.round(position)
  if (rounded <= 10) return CTR_BY_POSITION[rounded]
  if (rounded <= 20) return 0.008
  if (rounded <= 30) return 0.004
  return 0.002
}

/**
 * Estimated additional clicks per month if a query at `position` with
 * `impressions` over `windowDays` moved to `targetPosition`. Impressions are
 * normalised to a 30-day month. Returns 0 when the move is not an improvement.
 */
export function estimatedMonthlyUpside(
  impressions: number,
  position: number | null,
  windowDays: number,
  targetPosition = 3
): number {
  if (position === null || position <= targetPosition || impressions <= 0 || windowDays <= 0) return 0
  const monthly = (impressions / windowDays) * 30
  const gain = ctrForPosition(targetPosition) - ctrForPosition(position)
  return Math.max(0, Math.round(monthly * gain))
}

/** Estimated monthly organic clicks at a position — used by the paid handoff model. */
export function estimatedMonthlyClicks(impressions: number, position: number, windowDays: number): number {
  if (impressions <= 0 || windowDays <= 0) return 0
  return Math.round((impressions / windowDays) * 30 * ctrForPosition(position))
}

export const CTR_MODEL_LABEL =
  'Estimated from a standard positional CTR curve (28% at position 1 falling to 2% at 10, under 1% beyond) — a model, not a measurement.'
