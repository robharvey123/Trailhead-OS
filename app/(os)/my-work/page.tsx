import { redirect } from 'next/navigation'

// The "My work" engagement_tasks views are now canonical at /tasks (brief 16).
// Task detail still lives at /my-work/[id], linked from the kanban board.
export default function MyWorkPage() {
  redirect('/tasks')
}
