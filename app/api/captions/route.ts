import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { prompt } = await req.json()
  if (!prompt?.trim()) return new Response('Prompt required', { status: 400 })

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return new Response('Brand profile not found', { status: 404 })

  const systemPrompt = `${buildBrandSystemPrompt(brand)}

You are generating Instagram captions. Output EXACTLY 5 captions following this format — no extra text before or after:

CAPTION_1:
[caption text — warm, brand-voice, 3-5 sentences, may include line breaks and emojis if fitting]

NICHE_TAGS_1: [8-10 niche hashtags specific to wedding stationery/design]
BROAD_TAGS_1: [8-10 broad wedding/lifestyle hashtags]
LOCAL_TAGS_1: [5-7 Copenhagen/Denmark/Scandinavia location hashtags]
---
CAPTION_2:
[different angle on the same post — slightly different tone or hook]

NICHE_TAGS_2: [hashtags]
BROAD_TAGS_2: [hashtags]
LOCAL_TAGS_2: [hashtags]
---
(continue through CAPTION_5)

Write hashtags as space-separated strings starting with #. Make each caption feel distinct.`

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Post description: ${prompt}` }],
  })

  const encoder = new TextEncoder()
  let fullText = ''

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }

      // Save to history after streaming completes
      try {
        const parsed = parseCaptions(fullText)
        await supabase.from('caption_history').insert({
          user_id: user.id,
          prompt,
          captions: parsed,
        })
      } catch { /* non-critical */ }

      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function parseCaptions(text: string) {
  const captions = []
  const blocks = text.split('---').map(b => b.trim()).filter(Boolean)

  for (const block of blocks) {
    const captionMatch = block.match(/CAPTION_\d+:\n([\s\S]*?)(?=\nNICHE_TAGS)/i)
    const nicheMatch = block.match(/NICHE_TAGS_\d+:\s*(.+)/i)
    const broadMatch = block.match(/BROAD_TAGS_\d+:\s*(.+)/i)
    const localMatch = block.match(/LOCAL_TAGS_\d+:\s*(.+)/i)

    if (captionMatch) {
      captions.push({
        text: captionMatch[1].trim(),
        hashtags: {
          niche: nicheMatch ? nicheMatch[1].trim().split(/\s+/) : [],
          broad: broadMatch ? broadMatch[1].trim().split(/\s+/) : [],
          local: localMatch ? localMatch[1].trim().split(/\s+/) : [],
        },
      })
    }
  }

  return captions
}
