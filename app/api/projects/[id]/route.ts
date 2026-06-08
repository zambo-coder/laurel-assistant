import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const updates = await req.json()
  const { title, type, status, focus_area_id, goal_id } = updates

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) fields.title = title
  if (type !== undefined) fields.type = type
  if (status !== undefined) fields.status = status
  if (focus_area_id !== undefined) fields.focus_area_id = focus_area_id
  if (goal_id !== undefined) fields.goal_id = goal_id

  const { error } = await supabase
    .from('projects')
    .update(fields)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
