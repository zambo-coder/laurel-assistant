'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Textarea from '@/components/ui/Textarea'

const GOALS = [
  { id: 'followers', label: 'Grow followers', description: 'Build audience and brand awareness' },
  { id: 'inquiries', label: 'Get more inquiries', description: 'Convert followers into potential clients' },
  { id: 'service', label: 'Promote a service', description: 'Spotlight a specific offering' },
]

interface DayPlan {
  day: number
  format: string
  theme: string
  content: string
  tactic: string
}

interface CampaignPlan {
  overview: string
  days: DayPlan[]
  story_ideas: string[]
  budget?: string
}

const FORMAT_BADGE: Record<string, string> = {
  reel: '#e8f4ec',
  carousel: '#e8eef8',
  story: '#f8f0e8',
  static: '#f4f0f8',
}

export default function CampaignPage() {
  const [goal, setGoal] = useState<string>('')
  const [serviceDesc, setServiceDesc] = useState('')
  const [includeBudget, setIncludeBudget] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [rawText, setRawText] = useState('')
  const [plan, setPlan] = useState<CampaignPlan | null>(null)

  async function generate() {
    if (!goal || streaming) return
    setStreaming(true)
    setRawText('')
    setPlan(null)

    try {
      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: GOALS.find(g => g.id === goal)?.label,
          service_description: goal === 'service' ? serviceDesc : undefined,
          include_budget: includeBudget,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed (${res.status})`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setRawText(full)
      }

      const parsed = parseCampaign(full)
      setPlan(parsed)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      toast.error(message)
    } finally {
      setStreaming(false)
    }
  }

  function copyPlan() {
    if (!plan) return
    const lines = [
      `14-Day Instagram Campaign — ${GOALS.find(g => g.id === goal)?.label}`,
      '',
      plan.overview,
      '',
      ...plan.days.map(d =>
        `Day ${d.day} (${d.format.toUpperCase()}) — ${d.theme}\n→ ${d.content}\n💬 ${d.tactic}`
      ),
      '',
      'STORY IDEAS:',
      ...plan.story_ideas.map(s => `• ${s}`),
      ...(plan.budget ? ['', 'BUDGET TIPS:', plan.budget] : []),
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Plan copied to clipboard')
  }

  return (
    <div>
      <PageHeader
        title="Campaign Planner"
        description="Design a focused 14-day Instagram mini-campaign with daily content"
        action={plan ? <Button variant="secondary" size="sm" onClick={copyPlan}>Copy plan</Button> : undefined}
      />

      {/* Setup */}
      <Card className="mb-6">
        <div className="mb-5">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>Campaign goal</p>
          <div className="grid grid-cols-3 gap-3">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className="p-4 rounded-xl text-left transition-all"
                style={{
                  background: goal === g.id ? 'var(--foreground)' : 'var(--background)',
                  border: `1.5px solid ${goal === g.id ? 'var(--foreground)' : 'var(--border)'}`,
                }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: goal === g.id ? 'var(--background)' : 'var(--foreground)' }}>
                  {g.label}
                </p>
                <p className="text-xs" style={{ color: goal === g.id ? 'rgba(255,255,255,0.65)' : 'var(--muted)' }}>
                  {g.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {goal === 'service' && (
          <div className="mb-5">
            <Textarea
              label="Which service?"
              placeholder="e.g. Full invitation suite — handcrafted, starting at €800"
              value={serviceDesc}
              onChange={e => setServiceDesc(e.target.value)}
              rows={2}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setIncludeBudget(!includeBudget)}
              className="w-9 h-5 rounded-full transition-all relative"
              style={{ background: includeBudget ? 'var(--foreground)' : 'var(--border)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: includeBudget ? '18px' : '2px' }}
              />
            </div>
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>Include budget tips</span>
          </label>
          <Button onClick={generate} loading={streaming} disabled={!goal || (goal === 'service' && !serviceDesc.trim())}>
            Create campaign
          </Button>
        </div>
      </Card>

      {/* Streaming preview */}
      {streaming && !plan && (
        <Card className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>GENERATING</p>
          <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap streaming-cursor" style={{ color: 'var(--muted)' }}>
            {rawText || ' '}
          </p>
        </Card>
      )}

      {/* Results */}
      {plan && (
        <div className="space-y-4">
          {/* Overview */}
          <Card>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Campaign overview</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{plan.overview}</p>
          </Card>

          {/* Day-by-day */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>14-day plan</p>
            <div className="space-y-2">
              {plan.days.map(d => (
                <div
                  key={d.day}
                  className="flex gap-4 p-4 rounded-xl"
                  style={{ background: FORMAT_BADGE[d.format.toLowerCase()] || 'var(--cream-200,#f4efe6)', border: '1px solid var(--border)' }}
                >
                  <div className="shrink-0 w-8 text-center">
                    <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Day</div>
                    <div className="text-lg font-bold leading-tight" style={{ color: 'var(--foreground)' }}>{d.day}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.7)', color: 'var(--stone-500,#7c6e5e)' }}>
                        {d.format}
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{d.theme}</span>
                    </div>
                    <p className="text-sm leading-snug mb-1.5" style={{ color: 'var(--foreground)' }}>{d.content}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>💬 {d.tactic}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Story ideas */}
          {plan.story_ideas.length > 0 && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Story ideas</p>
              <ul className="space-y-2">
                {plan.story_ideas.map((idea, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-sm mt-0.5" style={{ color: 'var(--accent)' }}>✦</span>
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>{idea}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Budget */}
          {plan.budget && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Budget guide</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{plan.budget}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function parseCampaign(text: string): CampaignPlan {
  const overviewMatch = text.match(/OVERVIEW:\s*([^\n]+)/)
  const overview = overviewMatch ? overviewMatch[1].trim() : ''

  const days: DayPlan[] = []
  const dayLines = text.matchAll(/^DAY_(\d+)\|(\w+)\|([^|]+)\|([^|]+)\|(.+)$/gim)
  for (const match of dayLines) {
    days.push({
      day: parseInt(match[1]),
      format: match[2].toLowerCase(),
      theme: match[3].trim(),
      content: match[4].trim(),
      tactic: match[5].trim(),
    })
  }

  const storyMatch = text.match(/STORY_IDEAS:\s*([^\n]+)/)
  const story_ideas = storyMatch
    ? storyMatch[1].split('|').map(s => s.trim()).filter(Boolean)
    : []

  const budgetMatch = text.match(/BUDGET:\s*([^\n]+)/)
  const budget = budgetMatch ? budgetMatch[1].trim() : undefined

  return { overview, days, story_ideas, budget }
}
