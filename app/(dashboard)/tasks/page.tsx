import { createClient } from '@/lib/supabase/server'
import TasksClient from './TasksClient'

export default async function TasksPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: projects }, { data: brand }] = await Promise.all([
    supabase.from('tasks').select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('brand_profile').select('task_categories').single(),
  ])

  return (
    <TasksClient
      initialTasks={tasks ?? []}
      initialProjects={projects ?? []}
      initialCategories={brand?.task_categories ?? []}
    />
  )
}
