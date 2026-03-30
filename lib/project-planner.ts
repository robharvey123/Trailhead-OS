import { addDays } from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

type PlanProjectInput = {
  projectId: string
  projectName: string
  workstreamId: string
  pricingTierId: string | null
  startDate: string
  brief: string
}

type PlannedPhase = {
  name: string
  description: string
  start_date: string
  end_date: string
  sort_order: number
}

type PlannedMilestone = {
  name: string
  description: string
  date: string
}

type PlannedTask = {
  title: string
  description: string
  priority: 'medium' | 'high'
  start_date: string
  due_date: string
  phaseIndex: number
}

function planDurations(pricingTierId: string | null) {
  if (!pricingTierId) {
    return [5, 10, 5]
  }

  return [7, 14, 7]
}

function briefSummary(brief: string) {
  const trimmed = brief.trim()
  if (trimmed.length <= 220) {
    return trimmed
  }

  return `${trimmed.slice(0, 217)}...`
}

export async function planProjectFromBrief(input: PlanProjectInput) {
  const durations = planDurations(input.pricingTierId)
  const discoveryEnd = addDays(input.startDate, durations[0])
  const buildStart = discoveryEnd
  const buildEnd = addDays(buildStart, durations[1])
  const launchStart = buildEnd
  const launchEnd = addDays(launchStart, durations[2])
  const summary = briefSummary(input.brief)

  const phases: PlannedPhase[] = [
    {
      name: 'Discovery',
      description: `Clarify scope, success measures, and delivery approach. ${summary}`,
      start_date: input.startDate,
      end_date: discoveryEnd,
      sort_order: 0,
    },
    {
      name: 'Build',
      description: `Produce the core deliverables for ${input.projectName}.`,
      start_date: buildStart,
      end_date: buildEnd,
      sort_order: 1,
    },
    {
      name: 'Launch',
      description: 'QA, handover, feedback, and launch tasks.',
      start_date: launchStart,
      end_date: launchEnd,
      sort_order: 2,
    },
  ]

  const milestones: PlannedMilestone[] = [
    {
      name: 'Kickoff confirmed',
      description: 'Project kickoff, priorities confirmed, and initial delivery plan agreed.',
      date: input.startDate,
    },
    {
      name: 'Core delivery ready',
      description: 'Main build work is complete and ready for review.',
      date: buildEnd,
    },
    {
      name: 'Launch complete',
      description: 'Launch and handover complete.',
      date: launchEnd,
    },
  ]

  const tasks: PlannedTask[] = [
    {
      title: 'Review brief and lock scope',
      description: summary,
      priority: 'high',
      start_date: input.startDate,
      due_date: addDays(input.startDate, 2),
      phaseIndex: 0,
    },
    {
      title: 'Define milestones and delivery plan',
      description: 'Set milestones, dependencies, and stakeholder checkpoints.',
      priority: 'medium',
      start_date: addDays(input.startDate, 1),
      due_date: discoveryEnd,
      phaseIndex: 0,
    },
    {
      title: 'Build core deliverables',
      description: `Create the main delivery for ${input.projectName}.`,
      priority: 'high',
      start_date: buildStart,
      due_date: addDays(buildStart, Math.max(3, Math.floor(durations[1] / 2))),
      phaseIndex: 1,
    },
    {
      title: 'Internal review and revisions',
      description: 'Run review, QA the output, and apply revisions before handover.',
      priority: 'medium',
      start_date: addDays(buildStart, Math.max(2, Math.floor(durations[1] / 2))),
      due_date: buildEnd,
      phaseIndex: 1,
    },
    {
      title: 'Launch, handover, and follow-ups',
      description: 'Complete launch checklist, handover materials, and final follow-up.',
      priority: 'high',
      start_date: launchStart,
      due_date: launchEnd,
      phaseIndex: 2,
    },
  ]

  const { data: backlogColumn, error: columnError } = await supabaseService
    .from('board_columns')
    .select('id')
    .eq('workstream_id', input.workstreamId)
    .eq('label', 'Backlog')
    .maybeSingle()

  if (columnError) {
    throw new Error(columnError.message || 'Failed to resolve project backlog column')
  }

  const { data: insertedPhases, error: phaseError } = await supabaseService
    .from('project_phases')
    .insert(
      phases.map((phase) => ({
        project_id: input.projectId,
        ...phase,
      }))
    )
    .select('id, sort_order')

  if (phaseError) {
    throw new Error(phaseError.message || 'Failed to create project phases')
  }

  const phaseIds = new Map(
    (insertedPhases ?? []).map((phase) => [Number(phase.sort_order), String(phase.id)])
  )

  const { data: insertedMilestones, error: milestoneError } = await supabaseService
    .from('project_milestones')
    .insert(
      milestones.map((milestone) => ({
        project_id: input.projectId,
        ...milestone,
      }))
    )
    .select('id')

  if (milestoneError) {
    throw new Error(milestoneError.message || 'Failed to create project milestones')
  }

  const { data: insertedTasks, error: taskError } = await supabaseService
    .from('tasks')
    .insert(
      tasks.map((task, index) => ({
        workstream_id: input.workstreamId,
        project_id: input.projectId,
        phase_id: phaseIds.get(task.phaseIndex) ?? null,
        column_id: backlogColumn?.id ?? null,
        title: task.title,
        description: `${task.description}\n\nPhase: ${phaseIds.get(task.phaseIndex) ? phases[task.phaseIndex].name : 'Project'}`,
        priority: task.priority,
        start_date: task.start_date,
        due_date: task.due_date,
        sort_order: index,
      }))
    )
    .select('id')

  if (taskError) {
    throw new Error(taskError.message || 'Failed to create project tasks')
  }

  const { error: projectError } = await supabaseService
    .from('projects')
    .update({
      ai_planned: true,
      estimated_end_date: launchEnd,
    })
    .eq('id', input.projectId)

  if (projectError) {
    throw new Error(projectError.message || 'Failed to update project planning status')
  }

  return {
    tasks_created: insertedTasks?.length ?? 0,
    milestones_created: insertedMilestones?.length ?? 0,
    phases_created: insertedPhases?.length ?? 0,
    estimated_end_date: launchEnd,
  }
}
