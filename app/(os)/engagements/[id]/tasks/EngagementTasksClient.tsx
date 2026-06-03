'use client'

import { useState } from 'react'
import Board from '@/components/kanban/Board'
import TaskForm from '@/components/tasks/TaskForm'
import type { EngagementTaskWithRelations } from '@/lib/types'

type Named = { id: string; name: string }

export default function EngagementTasksClient({
  engagementId,
  initialTasks,
  people,
}: {
  engagementId: string
  initialTasks: EngagementTaskWithRelations[]
  people: Named[]
}) {
  const [showForm, setShowForm] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New task</button>
      </div>
      <Board initialTasks={initialTasks} />
      {showForm ? <TaskForm people={people} engagements={[]} fixedEngagementId={engagementId} onClose={() => setShowForm(false)} /> : null}
    </div>
  )
}
