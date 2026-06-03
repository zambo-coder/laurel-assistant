import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const name = (formData.get('name') as string) || file.name.replace(/\.[^/.]+$/, '')
  const type = (formData.get('type') as string) || 'design'

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase()
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('assets')
    .insert({
      user_id: user.id,
      name,
      type,
      url: publicUrl,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      tags: [],
      source: 'upload',
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from('assets').remove([storagePath])
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
