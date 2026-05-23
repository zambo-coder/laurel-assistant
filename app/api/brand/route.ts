import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabase.from('brand_profile').select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const { error } = await supabase
    .from('brand_profile')
    .upsert({ ...body, user_id: user.id, updated_at: new Date().toISOString() })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
