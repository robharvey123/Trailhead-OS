import { z } from 'zod'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const RoadmapTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  // ISO YYYY-MM-DD if the doc gave a date/month; regex (not z.iso) to tolerate
  // minor LLM formatting and stay zod-version-agnostic.
  suggested_due_date: z.string().regex(ISO_DATE).optional(),
  labels: z.array(z.string()).default([]),
})

export const RoadmapMilestoneSchema = z.object({
  name: z.string().min(1),
  summary: z.string().optional(),
  tasks: z.array(RoadmapTaskSchema),
})

export const RoadmapExtractionSchema = z.object({
  project_title: z.string().optional(),
  overview: z.string().optional(),
  milestones: z.array(RoadmapMilestoneSchema),
})

export type RoadmapTask = z.infer<typeof RoadmapTaskSchema>
export type RoadmapMilestone = z.infer<typeof RoadmapMilestoneSchema>
export type RoadmapExtraction = z.infer<typeof RoadmapExtractionSchema>
