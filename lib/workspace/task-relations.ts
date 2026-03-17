type DependencyPreview = {
  id: string
  title: string
  status: string
  scheduled_date: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadTaskDependencyMaps(supabase: any, workspaceId: string, taskIds: string[]) {
  const uniqueTaskIds = Array.from(new Set(taskIds.map((id) => String(id || '').trim()).filter(Boolean)))

  if (uniqueTaskIds.length === 0) {
    return {
      blockedByByTask: new Map<string, DependencyPreview[]>(),
      blockingByTask: new Map<string, DependencyPreview[]>(),
      error: null,
    }
  }

  const inList = uniqueTaskIds.join(',')
  const dependenciesRes = await supabase
    .from('workspace_task_dependencies')
    .select('task_id, depends_on_task_id')
    .eq('workspace_id', workspaceId)
    .or(`task_id.in.(${inList}),depends_on_task_id.in.(${inList})`)

  if (dependenciesRes.error) {
    return {
      blockedByByTask: new Map<string, DependencyPreview[]>(),
      blockingByTask: new Map<string, DependencyPreview[]>(),
      error: dependenciesRes.error,
    }
  }

  const dependencyRows = dependenciesRes.data || []
  const relatedTaskIds = Array.from(
    new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dependencyRows.flatMap((row: any) => [String(row.task_id || ''), String(row.depends_on_task_id || '')]).filter(Boolean)
    )
  )

  const taskPreviewRes = relatedTaskIds.length
    ? await supabase
        .from('workspace_tasks')
        .select('id, title, status, scheduled_date')
        .eq('workspace_id', workspaceId)
        .in('id', relatedTaskIds)
    : { data: [], error: null }

  if (taskPreviewRes.error) {
    return {
      blockedByByTask: new Map<string, DependencyPreview[]>(),
      blockingByTask: new Map<string, DependencyPreview[]>(),
      error: taskPreviewRes.error,
    }
  }

  const previewByTaskId = new Map<string, DependencyPreview>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (taskPreviewRes.data || []).map((task: any) => [
      task.id,
      { id: task.id, title: task.title, status: task.status, scheduled_date: task.scheduled_date } as DependencyPreview,
    ])
  )

  const blockedByByTask = new Map<string, DependencyPreview[]>()
  const blockingByTask = new Map<string, DependencyPreview[]>()

  for (const row of dependencyRows) {
    const taskId = String(row.task_id || '')
    const dependsOnTaskId = String(row.depends_on_task_id || '')
    const blocker = previewByTaskId.get(dependsOnTaskId)
    const blocked = previewByTaskId.get(taskId)

    if (blocker) {
      blockedByByTask.set(taskId, [...(blockedByByTask.get(taskId) || []), blocker])
    }
    if (blocked) {
      blockingByTask.set(dependsOnTaskId, [...(blockingByTask.get(dependsOnTaskId) || []), blocked])
    }
  }

  return { blockedByByTask, blockingByTask, error: null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertTaskActivity(
  supabase: any,
  args: {
    workspaceId: string
    taskId: string
    actorProfileId?: string | null
    action: string
    details?: Record<string, unknown>
  }
) {
  const { workspaceId, taskId, actorProfileId = null, action, details = {} } = args

  return supabase.from('workspace_task_activity').insert({
    workspace_id: workspaceId,
    task_id: taskId,
    actor_profile_id: actorProfileId,
    action,
    details,
  })
}
