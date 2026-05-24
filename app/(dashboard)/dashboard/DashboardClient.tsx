'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import DashboardChat from '@/components/dashboard/DashboardChat'
import Link from 'next/link'
import { BrandProfile, DashboardWidget, OpportunityItem } from '@/types'

const ALL_WIDGETS: { id: DashboardWidget; label: string }[] = [
  { id: 'chat', label: 'AI Assistant' },
  { id: 'quick_actions', label: 'Quick Actions' },
  { id: 'top_opportunities', label: 'Top Opportunities' },
  { id: 'recent_captions', label: 'Recent Captions' },
  { id: 'website_card', label: 'Website' },
  { id: 'upcoming_posts', label: 'Upcoming Posts' },
]

const DEFAULT_WIDGETS: DashboardWidget[] = ['chat', 'quick_actions', 'top_opportunities', 'recent_captions', 'website_card']

const IMPACT_COLOR: Record<string, string> = {
  high: '#c07a6a',
  medium: '#c4a06a',
  low: '#7a9478',
}

interface CalendarDay {
  day: number
  theme: string
  post_idea: string
  format: string
}

interface Props {
  brand: BrandProfile | null
  recentCaptions: { id: string; prompt: string; created_at: string }[]
  recentInquiries: { id: string; inquiry: string; created_at: string }[]
  topOpportunities: OpportunityItem[]
  calendarDays: CalendarDay[]
  calendarMonth: string
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardClient({
  brand, recentCaptions, recentInquiries, topOpportunities, calendarDays, calendarMonth,
}: Props) {
  const savedWidgets = (brand?.dashboard_widgets ?? DEFAULT_WIDGETS) as DashboardWidget[]
  const [activeWidgets, setActiveWidgets] = useState<DashboardWidget[]>(savedWidgets)
  const [showCustomise, setShowCustomise] = useState(false)
  const [savingWidgets, setSavingWidgets] = useState(false)

  const has = (id: DashboardWidget) => activeWidgets.includes(id)

  async function toggleWidget(id: DashboardWidget) {
    const next = activeWidgets.includes(id)
      ? activeWidgets.filter(w => w !== id)
      : [...activeWidgets, id]
    setActiveWidgets(next)
    setSavingWidgets(true)
    try {
      await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...brand, dashboard_widgets: next }),
      })
    } finally {
      setSavingWidgets(false)
    }
  }

  // Build upcoming posts from calendar
  const today = new Date()
  const currentDay = today.getDate()
  const upcomingDays = calendarDays
    .filter(d => d.day >= currentDay)
    .slice(0, 3)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>{getGreeting()}</p>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
            {brand?.business_name ?? 'Your Studio'}
          </h1>
          {brand?.tagline && (
            <p className="mt-1 text-sm italic" style={{ color: 'var(--muted)' }}>{brand.tagline}</p>
          )}
        </div>
        <button
          onClick={() => setShowCustomise(p => !p)}
          className="text-xs hover:opacity-70 transition-opacity mt-1"
          style={{ color: 'var(--muted)' }}
        >
          {showCustomise ? 'Done' : '⊙ Customise'}
        </button>
      </div>

      {/* Customise panel */}
      {showCustomise && (
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide px-2 pt-2 mb-3" style={{ color: 'var(--muted)' }}>
            Dashboard widgets {savingWidgets && '· saving...'}
          </p>
          <div className="flex flex-wrap gap-2 px-2 pb-2">
            {ALL_WIDGETS.map(w => (
              <button
                key={w.id}
                onClick={() => toggleWidget(w.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: has(w.id) ? 'var(--foreground)' : 'var(--border)',
                  color: has(w.id) ? 'var(--background)' : 'var(--muted)',
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Quick actions */}
      {has('quick_actions') && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { href: '/captions', icon: '✦', label: 'Generate caption', sub: 'Social Media' },
            { href: '/inquiries', icon: '✉', label: 'Handle inquiry', sub: 'Commercial' },
            { href: '/opportunities', icon: '◆', label: 'View opportunities', sub: 'Strategy' },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-sm transition-shadow cursor-pointer group">
                <div className="text-xl mb-3">{item.icon}</div>
                <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.sub}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-5 gap-6">
        {/* AI Chat shortcut */}
        {has('chat') && (
          <div className={has('website_card') || has('recent_captions') || has('top_opportunities') || has('upcoming_posts') ? 'col-span-3' : 'col-span-5'}>
            <Card padding="sm" className="flex flex-col">
              <div className="px-2 pt-2 pb-1 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#7a9478' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>AI Assistant</span>
                <Link href="/chat" className="text-xs ml-auto underline underline-offset-2 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                  Open full chat →
                </Link>
              </div>
              <DashboardChat brand={brand} />
            </Card>
          </div>
        )}

        {/* Right column */}
        {(has('website_card') || has('recent_captions') || has('top_opportunities') || has('upcoming_posts')) && (
          <div className={has('chat') ? 'col-span-2 space-y-4' : 'col-span-5 grid grid-cols-2 gap-4'}>
            {/* Top Opportunities */}
            {has('top_opportunities') && (
              <Card padding="sm">
                <div className="px-2 pt-2 pb-1 mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Top opportunities</p>
                  <Link href="/opportunities" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted)' }}>View all →</Link>
                </div>
                {topOpportunities.length > 0 ? (
                  <ul className="space-y-2 px-2 pb-2">
                    {topOpportunities.map((op, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[10px] mt-0.5 shrink-0 font-bold" style={{ color: IMPACT_COLOR[op.impact] ?? 'var(--accent)' }}>◆</span>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{op.title}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs px-2 pb-2" style={{ color: 'var(--muted)' }}>
                    <Link href="/opportunities" className="underline underline-offset-2">Generate opportunities →</Link>
                  </p>
                )}
              </Card>
            )}

            {/* Upcoming posts */}
            {has('upcoming_posts') && (
              <Card padding="sm">
                <div className="px-2 pt-2 pb-1 mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Upcoming posts</p>
                  <Link href="/calendar" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted)' }}>Calendar →</Link>
                </div>
                {upcomingDays.length > 0 ? (
                  <ul className="space-y-2 px-2 pb-2">
                    {upcomingDays.map(d => (
                      <li key={d.day}>
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--muted)' }}>
                          {calendarMonth} {d.day} · {d.format}
                        </p>
                        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>{d.theme}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs px-2 pb-2" style={{ color: 'var(--muted)' }}>No upcoming posts this month</p>
                )}
              </Card>
            )}

            {/* Website card */}
            {has('website_card') && brand?.website_url && (
              <Card padding="sm">
                <div className="px-2 pt-2 pb-1 mb-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Website</p>
                </div>
                <div className="px-2 space-y-2 pb-2">
                  <a
                    href={brand.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <span>◑</span>
                    <span className="underline underline-offset-2 truncate">{brand.website_url.replace(/^https?:\/\//, '')}</span>
                  </a>
                  <a
                    href="https://account.squarespace.com/analytics"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--muted)' }}
                  >
                    <span>◎</span>
                    <span className="underline underline-offset-2">Squarespace Analytics →</span>
                  </a>
                </div>
              </Card>
            )}

            {/* Recent captions */}
            {has('recent_captions') && (
              <Card padding="sm">
                <div className="px-2 pt-2 pb-1 mb-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Recent captions</p>
                </div>
                {recentCaptions.length > 0 ? (
                  <ul className="space-y-2 px-2">
                    {recentCaptions.map((c) => (
                      <li key={c.id}>
                        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>{c.prompt}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs px-2 pb-2" style={{ color: 'var(--muted)' }}>No captions yet</p>
                )}
                <div className="px-2 pb-2 mt-3">
                  <Link href="/captions" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted)' }}>View all →</Link>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
