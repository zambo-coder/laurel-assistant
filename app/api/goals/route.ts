import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { title, description, timeframe, status, source } = await req.json()
  if (!title?.trim()) return Response.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description ?? null,
      timeframe: timeframe ?? 'annual',
      status: status ?? 'active',
      source: source ?? 'manual',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
