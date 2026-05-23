import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()

  const { data: brand } = await supabase
    .from('brand_profile')
    .select('*')
    .single()

  if (!brand) return new Response('Brand profile not found', { status: 404 })

  // Gather context snippets for the assistant
  const [{ data: recentCaptions }, { data: recentInquiries }, { data: timeLogs }] = await Promise.all([
    supabase.from('caption_history').select('prompt, captions').order('created_at', { ascending: false }).limit(5),
    supabase.from('client_inquiries').select('inquiry, response, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('time_logs').select('activity_type, hours_spent, log_date').order('log_date', { ascending: false }).limit(10),
  ])

  const contextBlocks = []
  if (recentCaptions?.length) {
    contextBlocks.push(`Recent caption prompts: ${recentCaptions.map(c => c.prompt).join('; ')}`)
  }
  if (recentInquiries?.length) {
    contextBlocks.push(`Recent client inquiries (${recentInquiries.length}): ${recentInquiries.map(c => c.inquiry.slice(0, 80)).join(' | ')}`)
  }
  if (timeLogs?.length) {
    const byActivity: Record<string, number> = {}
    timeLogs.forEach(l => { byActivity[l.activity_type] = (byActivity[l.activity_type] || 0) + l.hours_spent })
    contextBlocks.push(`Recent time tracked: ${Object.entries(byActivity).map(([k, v]) => `${k}: ${v}h`).join(', ')}`)
  }

  const systemPrompt = `${buildBrandSystemPrompt(brand)}

CURRENT CONTEXT:
${contextBlocks.length ? contextBlocks.join('\n') : 'No activity data yet.'}

You are a conversational business co-pilot. Be concise, warm, and specific to her business.
You can help with: content ideas, replying to clients, strategic thinking, planning, copy, and anything else she needs.
Keep responses focused — no fluff. If she asks you to do something that maps to a tool in the app (like "generate a caption" or "write a client reply"), do it inline AND mention which section of the app she can save/manage it.
Today's date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
