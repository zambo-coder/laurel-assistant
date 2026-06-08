import { createClient } from '@/lib/supabase/server'
import ProjectsClient from './ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: tasks }, { data: focusAreas }, { data: goals }] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('project_id, status'),
    supabase.from('focus_areas').select('id,title').eq('status', 'active').order('title'),
    supabase.from('goals').select('id,title').eq('status', 'active').order('title'),
  ])

  // Compute per-project task counts
  const tasksByProject: Record<string, { total: number; done: number }> = {}
  for (const t of tasks ?? []) {
    if (!t.project_id) continue
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = { total: 0, done: 0 }
    tasksByProject[t.project_id].total++
    if (t.status === 'done') tasksByProject[t.project_id].done++
  }

  return (
    <ProjectsClient
      initialProjects={projects ?? []}
      taskCounts={tasksByProject}
      focusAreas={focusAreas ?? []}
      goals={goals ?? []}
    />
  )
}
