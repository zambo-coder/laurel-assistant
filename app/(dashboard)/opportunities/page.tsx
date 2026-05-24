'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import { OpportunityItem } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  social: 'Social Media',
  commercial: 'Commercial',
  brand: 'Brand',
  technical: 'Technical',
}

const CATEGORY_ICONS: Record<string, string> = {
  social: '✦',
  commercial: '◇',
  brand: '◈',
  technical: '◉',
}

const IMPACT_STYLE: Record<string, { bg: string; color: string }> = {
  high: { bg: '#c07a6a18', color: '#c07a6a' },
  medium: { bg: '#c4a06a18', color: '#c4a06a' },
  low: { bg: '#7a947818', color: '#7a9478' },
}

const EFFORT_STYLE: Record<string, { bg: string; color: string }> = {
  low: { bg: '#7a947818', color: '#7a9478' },
  medium: { bg: '#c4a06a18', color: '#c4a06a' },
  high: { bg: '#c07a6a18', color: '#c07a6a' },
}

function Badge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: style.bg, color: style.color }}
    >
      {label}
    </span>
  )
}

export default function OpportunitiesPage() {
  const [items, setItems] = useState<OpportunityItem[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/opportunities')
      .then(r => r.json())
      .then(data => {
        if (data?.items) {
          setItems(data.items)
          setGeneratedAt(data.generated_at)
        }
      })
      .finally(() => setLoaded(true))
  }, [])

  async function generate() {
    setGenerating(true)
    setStreamText('')
    setItems([])
    try {
      const res = await fetch('/api/opportunities', { method: 'POST' })
      if (!res.ok || !res.body) throw new Error()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setStreamText(accumulated)
      }

      // Parse final JSON array
      const match = accumulated.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed: OpportunityItem[] = JSON.parse(match[0])
        setItems(parsed)
        setGeneratedAt(new Date().toISOString())
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false)
      setStreamText('')
    }
  }

  // Group items by category
  const grouped = items.reduce<Record<string, OpportunityItem[]>>((acc, item) => {
    const cat = item.category ?? 'brand'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const categoryOrder = ['social', 'commercial', 'brand', 'technical']

  return (
    <div className="space-y-8">
      <PageHeader
        title="Opportunities"
        description="Prioritised initiatives based on your brand, inspiration references, and presence analysis."
        action={
          <Button onClick={generate} loading={generating}>
            {items.length > 0 ? 'Refresh' : 'Generate'}
          </Button>
        }
      />

      {generating && streamText && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
            Generating...
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>
            {streamText.slice(-300)}
          </p>
        </Card>
      )}

      {!loaded && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
      )}

      {loaded && items.length === 0 && !generating && (
        <Card>
          <div className="py-10 text-center">
            <p className="text-sm mb-1" style={{ color: 'var(--foreground)' }}>No opportunities generated yet</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Add inspiration references and run a presence analysis first for the best results, then click Generate.
            </p>
          </div>
        </Card>
      )}

      {items.length > 0 && (
        <div className="space-y-8">
          {categoryOrder.filter(cat => grouped[cat]?.length).map(cat => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">{CATEGORY_ICONS[cat]}</span>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{CATEGORY_LABELS[cat]}</h2>
              </div>
              <div className="space-y-3">
                {grouped[cat].map((item, i) => (
                  <Card key={i} padding="sm">
                    <div className="px-2 pt-3 pb-2">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge label={`${item.impact} impact`} style={IMPACT_STYLE[item.impact] ?? IMPACT_STYLE.medium} />
                          <Badge label={`${item.effort} effort`} style={EFFORT_STYLE[item.effort] ?? EFFORT_STYLE.medium} />
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>{item.description}</p>
                      <div
                        className="flex items-start gap-2 rounded-lg px-3 py-2"
                        style={{ background: 'var(--background)' }}
                      >
                        <span className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>→</span>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
                          <span className="font-medium">Next step: </span>{item.next_step}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {generatedAt && (
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Generated {new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
