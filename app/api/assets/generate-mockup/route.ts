import { createClient } from '@/lib/supabase/server'
import { logUsage } from '@/lib/usage'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { asset_id, prompt } = await req.json()
  if (!asset_id) return Response.json({ error: 'asset_id required' }, { status: 400 })

  const { data: asset } = await supabase
    .from('assets')
    .select('*')
    .eq('id', asset_id)
    .eq('user_id', user.id)
    .single()

  if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 })

  const { data: brand } = await supabase.from('brand_profile').select('ai_image_model').single()
  const imageModel = brand?.ai_image_model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'

  const imageRes = await fetch(asset.url)
  if (!imageRes.ok) return Response.json({ error: 'Could not fetch source image' }, { status: 500 })

  const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
  const ext = (asset.storage_path.split('.').pop() ?? 'png').toLowerCase()
  const mimeType = (asset.mime_type ?? 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp'
  const imageFile = new File([imageBuffer], `design.${ext}`, { type: mimeType })

  const fullPrompt = prompt?.trim() ||
    'Create a beautiful styled flat lay Instagram post photo featuring this wedding invitation design. ' +
    'Arrange it on a soft linen surface with white roses, eucalyptus sprigs, and a gold pen. ' +
    'Soft natural window light. Elegant and romantic mood. ' +
    'The invitation should be the clear centrepiece of the composition.'

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let b64: string
  try {
    const response = await openai.images.edit({
      model: imageModel,
      image: imageFile,
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
    })

    const imageData = response.data?.[0]
    if (!imageData) throw new Error('No image data returned')
    if (imageData.b64_json) {
      b64 = imageData.b64_json
    } else if (imageData.url) {
      const imgRes = await fetch(imageData.url)
      b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
    } else {
      throw new Error('No image data returned')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    return Response.json({ error: message }, { status: 500 })
  }

  const storagePath = `${user.id}/mockup-${crypto.randomUUID()}.png`
  const buffer = Buffer.from(b64, 'base64')

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType: 'image/png' })

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  logUsage(supabase, user.id, 'openai', imageModel, 'mockup', undefined, undefined, 1)

  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('assets')
    .insert({
      user_id: user.id,
      name: `Mockup — ${asset.name}`,
      type: 'mockup',
      url: publicUrl,
      storage_path: storagePath,
      mime_type: 'image/png',
      size_bytes: buffer.length,
      tags: [],
      source: 'ai_generated',
      source_asset_id: asset_id,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
