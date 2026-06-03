import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const updates = await req.json()
  const { name, type, tags, notes } = updates

  const fields: Record<string, unknown> = {}
  if (name !== undefined) fields.name = name
  if (type !== undefined) fields.type = type
  if (tags !== undefined) fields.tags = tags
  if (notes !== undefined) fields.notes = notes

  const { error } = await supabase
    .from('assets')
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

  const { data: asset } = await supabase
    .from('assets')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!asset) return Response.json({ error: 'Not found' }, { status: 404 })

  await supabase.storage.from('assets').remove([asset.storage_path])

  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
