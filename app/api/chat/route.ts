import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { streamToResponse } from '@/lib/stream'
import { NextRequest } from 'next/server'
import { InspirationRef } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return new Response('Brand profile not found', { status: 404 })

  const [{ data: recentCaptions }, { data: recentInquiries }, { data: timeLogs }, { data: refs }] = await Promise.all([
    supabase.from('caption_history').select('prompt').order('created_at', { ascending: false }).limit(5),
    supabase.from('client_inquiries').select('inquiry').order('created_at', { ascending: false }).limit(5),
    supabase.from('time_logs').select('activity_type, hours_spent').order('log_date', { ascending: false }).limit(10),
    supabase.from('inspiration_refs').select('*').order('created_at', { ascending: false }),
  ])

  const contextBlocks: string[] = []
  if (recentCaptions?.length) {
    contextBlocks.push(`Recent caption prompts: ${recentCaptions.map(c => c.prompt).join('; ')}`)
  }
  if (recentInquiries?.length) {
    contextBlocks.push(`Recent client inquiries (${recentInquiries.length}): ${recentInquiries.map(c => c.inquiry.slice(0, 80)).join(' | ')}`)
  }
  if (timeLogs?.length) {
    const byActivity: Record<string, number> = {}
    timeLogs.forEach(l => { byActivity[l.activity_type] = (byActivity[l.activity_type] || 0) + Number(l.hours_spent) })
    contextBlocks.push(`Recent time tracked: ${Object.entries(byActivity).map(([k, v]) => `${k}: ${v}h`).join(', ')}`)
  }

  const systemPrompt = `${buildBrandSystemPrompt(brand, refs as InspirationRef[])}

CURRENT CONTEXT:
${contextBlocks.length ? contextBlocks.join('\n') : 'No activity data yet.'}

You are a conversational business co-pilot. Be concise, warm, and specific to her business.
You can help with: content ideas, replying to clients, strategic thinking, planning, copy, and anything else she needs.
Keep responses focused — no fluff.
Today's date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })
    return streamToResponse(stream)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
