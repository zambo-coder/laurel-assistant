import { createClient } from '@/lib/supabase/server'
import { Project, ContentCalendar } from '@/types'
import ProjectsClient from './ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: tasks }, { data: focusAreas }, { data: goals }] = await Promise.all([
    supabase.from('projects').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
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

  // Collect calendar months to fetch: from content projects + current ± 1 month
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const thisMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`
  const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const nextMonth = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`

  const monthsFromProjects = (projects ?? [])
    .filter((p: Project) => p.type === 'content' && p.calendar_month_year)
    .map((p: Project) => p.calendar_month_year as string)

  const monthsToFetch = [...new Set([...monthsFromProjects, prevMonth, thisMonth, nextMonth])]

  const { data: calendarsRaw } = await supabase
    .from('content_calendar')
    .select('month_year, days')
    .in('month_year', monthsToFetch)

  const calendars = (calendarsRaw ?? []) as Pick<ContentCalendar, 'month_year' | 'days'>[]

  return (
    <ProjectsClient
      initialProjects={projects ?? []}
      taskCounts={tasksByProject}
      focusAreas={focusAreas ?? []}
      goals={goals ?? []}
      calendars={calendars}
    />
  )
}
