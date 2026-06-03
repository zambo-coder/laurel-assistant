import { createClient } from '@/lib/supabase/server'
import TasksClient from './TasksClient'

export default async function TasksPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: projects }, { data: brand }, { data: focusAreas }] = await Promise.all([
    supabase.from('tasks').select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('brand_profile').select('task_categories').single(),
    supabase.from('focus_areas').select('id,title,status').eq('status', 'active').order('title'),
  ])

  return (
    <TasksClient
      initialTasks={tasks ?? []}
      initialProjects={projects ?? []}
      initialCategories={brand?.task_categories ?? []}
      initialFocusAreas={focusAreas ?? []}
    />
  )
}
