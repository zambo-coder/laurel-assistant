'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import { PresenceAnalysis } from '@/types'

interface PageEntry {
  url: string
  platform: string
  label: string
}

interface Props {
  pages: PageEntry[]
  initialAnalyses: PresenceAnalysis[]
}

const PLATFORM_ICONS: Record<string, string> = {
  website: '◑',
  instagram: '◎',
  etsy: '◇',
  other: '◈',
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#7a9478' : score >= 40 ? '#c4a06a' : '#c07a6a'
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ border: `3px solid ${color}`, color }}
      >
        {score}
      </div>
    </div>
  )
}

export default function PresenceClient({ pages, initialAnalyses }: Props) {
  const [analyses, setAnalyses] = useState<PresenceAnalysis[]>(initialAnalyses)
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  function getAnalysis(url: string) {
    return analyses.find(a => a.url === url) ?? null
  }

  async function analyse(page: PageEntry) {
    setLoading(p => ({ ...p, [page.url]: true }))
    try {
      const res = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: page.url, platform: page.platform }),
      })
      if (!res.ok) throw new Error()
      const result: PresenceAnalysis = await res.json()
      setAnalyses(p => [result, ...p.filter(a => a.url !== page.url)])
    } catch {
      // silently fail
    } finally {
      setLoading(p => ({ ...p, [page.url]: false }))
    }
  }

  if (pages.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="My Presence" description="Analyse your online pages against your brand goals and inspiration references." />
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No pages configured yet. Add your website URL and Etsy shop in{' '}
              <a href="/settings" className="underline underline-offset-2">Settings</a>.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Presence"
        description="AI analysis of your online pages — completeness, customer impression, and gaps to close."
      />

      <div className="space-y-6">
        {pages.map(page => {
          const analysis = getAnalysis(page.url)
          const isLoading = loading[page.url]

          return (
            <Card key={page.url}>
              {/* Page header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{PLATFORM_ICONS[page.platform] ?? '◈'}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{page.label}</p>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--muted)' }}
                    >
                      {page.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
                <Button
                  onClick={() => analyse(page)}
                  loading={isLoading}
                  variant="secondary"
                  size="sm"
                >
                  {analysis ? 'Re-analyse' : 'Analyse'}
                </Button>
              </div>

              {isLoading && (
                <div className="py-6 text-center">
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Analysing your page...</p>
                </div>
              )}

              {!isLoading && analysis?.analysis && (
                <div className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  {/* Completeness */}
                  <div className="flex items-start gap-4 pt-4">
                    <ScoreRing score={analysis.analysis.completeness.score} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Completeness</p>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                        {analysis.analysis.completeness.notes}
                      </p>
                    </div>
                  </div>

                  {/* Customer impression */}
                  <div className="p-3 rounded-lg" style={{ background: 'var(--background)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Ideal customer impression</p>
                    <p className="text-sm italic leading-relaxed" style={{ color: 'var(--foreground)' }}>
                      &ldquo;{analysis.analysis.customer_impression}&rdquo;
                    </p>
                  </div>

                  {/* vs References */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>vs. Your inspirations</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                      {analysis.analysis.vs_references}
                    </p>
                  </div>

                  {/* Gaps */}
                  {analysis.analysis.gaps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Gaps to close</p>
                      <ul className="space-y-1.5">
                        {analysis.analysis.gaps.map((gap, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 text-xs" style={{ color: 'var(--accent)' }}>→</span>
                            <span className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Technical */}
                  {analysis.analysis.technical && (
                    <div className="flex items-center gap-2 pt-1">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background: analysis.analysis.technical.https ? '#7a947820' : '#c07a6a20',
                          color: analysis.analysis.technical.https ? '#7a9478' : '#c07a6a',
                        }}
                      >
                        {analysis.analysis.technical.https ? '✓ HTTPS' : '✗ No HTTPS'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {analysis.analysis.technical.score_note}
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] pt-1" style={{ color: 'var(--muted)' }}>
                    Analysed {new Date(analysis.analyzed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}

              {!isLoading && !analysis && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Click Analyse to get a detailed breakdown.
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
