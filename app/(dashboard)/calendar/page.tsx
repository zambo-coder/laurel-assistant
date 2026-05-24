'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Textarea from '@/components/ui/Textarea'
import { CalendarDay } from '@/types'

const FORMAT_COLORS: Record<string, string> = {
  reel: '#e8f4ec',
  carousel: '#e8eef8',
  story: '#f8f0e8',
  static: '#f4f0f8',
}

const FORMAT_TEXT: Record<string, string> = {
  reel: '#3d7a52',
  carousel: '#2d5a9e',
  story: '#9e6a2d',
  static: '#6a3d9e',
}

function getMonthYear(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [focus, setFocus] = useState('')
  const [days, setDays] = useState<CalendarDay[]>([])
  const [streaming, setStreaming] = useState(false)
  const [rawText, setRawText] = useState('')
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Load existing calendar on mount / month change
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/calendar?month_year=${monthYear}`)
        const data = await res.json()
        if (data?.days) setDays(data.days)
        else setDays([])
      } catch { setDays([]) }
      finally { setLoading(false) }
    }
    load()
  }, [monthYear])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  async function generate() {
    if (streaming) return
    setStreaming(true)
    setRawText('')
    setDays([])

    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear, focus, days_in_month: daysInMonth }),
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
        // Parse incrementally so days appear as they stream
        const partial = parseCalendarClient(full)
        if (partial.length > 0) setDays(partial)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      toast.error(message)
    } finally {
      setStreaming(false)
    }
  }

  async function regenerateDay(dayNum: number) {
    setRegeneratingDay(dayNum)
    try {
      const res = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear, day: dayNum }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDays(prev => prev.map(d => d.day === dayNum ? data : d))
      toast.success(`Day ${dayNum} regenerated`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed'
      toast.error(message)
    } finally {
      setRegeneratingDay(null)
    }
  }

  function exportCalendar() {
    const sorted = [...days].sort((a, b) => a.day - b.day)
    const text = sorted.map(d =>
      `Day ${d.day} (${d.format.toUpperCase()}) — ${d.theme}\n${d.post_idea}`
    ).join('\n\n')
    navigator.clipboard.writeText(`${getMonthYear(new Date(year, month))} Content Calendar\n\n${text}`)
    toast.success('Calendar copied to clipboard')
  }

  const dayMap = new Map(days.map(d => [d.day, d]))
  const hasCalendar = days.length > 0

  return (
    <div>
      <PageHeader
        title="Content Calendar"
        description="A full month of Instagram post ideas tailored to your brand"
        action={
          hasCalendar ? (
            <Button variant="secondary" size="sm" onClick={exportCalendar}>Export</Button>
          ) : undefined
        }
      />

      {/* Month nav + generate */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:opacity-70 transition-opacity text-lg" style={{ color: 'var(--muted)' }}>←</button>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {getMonthYear(new Date(year, month))}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:opacity-70 transition-opacity text-lg" style={{ color: 'var(--muted)' }}>→</button>
        </div>

        <Textarea
          label="Focus areas (optional)"
          placeholder="e.g. Autumn weddings, promoting full suite packages, sustainability"
          value={focus}
          onChange={e => setFocus(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end mt-4">
          <Button onClick={generate} loading={streaming} disabled={loading}>
            {hasCalendar ? 'Regenerate month' : 'Generate calendar'}
          </Button>
        </div>
      </Card>

      {/* Streaming preview */}
      {streaming && days.length === 0 && (
        <Card className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>GENERATING</p>
          <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap streaming-cursor" style={{ color: 'var(--muted)' }}>
            {rawText || ' '}
          </p>
        </Card>
      )}

      {/* Calendar grid */}
      {hasCalendar && (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--muted)' }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty cells for first week */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dayData = dayMap.get(dayNum)
              const isRegenerating = regeneratingDay === dayNum

              return (
                <div
                  key={dayNum}
                  className="rounded-xl p-2.5 relative group min-h-[100px]"
                  style={{
                    background: dayData ? FORMAT_COLORS[dayData.format] : 'var(--cream-200,#f4efe6)',
                    border: '1px solid var(--border)',
                    opacity: isRegenerating ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--stone-600,#655a4d)' }}>{dayNum}</span>
                    {dayData && (
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.7)', color: FORMAT_TEXT[dayData.format] }}
                      >
                        {dayData.format}
                      </span>
                    )}
                  </div>

                  {dayData ? (
                    <>
                      <p className="text-[10px] font-medium leading-tight mb-1" style={{ color: 'var(--foreground)' }}>
                        {dayData.theme}
                      </p>
                      <p className="text-[10px] leading-tight" style={{ color: 'var(--stone-500,#7c6e5e)' }}>
                        {dayData.post_idea}
                      </p>
                      <button
                        onClick={() => regenerateDay(dayNum)}
                        disabled={isRegenerating || streaming}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-[10px] p-0.5 rounded transition-opacity"
                        style={{ color: 'var(--muted)' }}
                        title="Regenerate this day"
                      >
                        ↺
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-12">
                      {streaming ? (
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>…</span>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 justify-end">
            {Object.entries(FORMAT_COLORS).map(([fmt, bg]) => (
              <div key={fmt} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: bg, border: '1px solid var(--border)' }} />
                <span className="text-xs capitalize" style={{ color: 'var(--muted)' }}>{fmt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function parseCalendarClient(text: string): CalendarDay[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const days: CalendarDay[] = []
  for (const line of lines) {
    const match = line.match(/^DAY_(\d+)\|(\w+)\|([^|]+)\|(.+)$/i)
    if (match) {
      const format = match[2].toLowerCase()
      days.push({
        day: parseInt(match[1]),
        format: (['reel', 'carousel', 'story', 'static'].includes(format) ? format : 'static') as CalendarDay['format'],
        theme: match[3].trim(),
        post_idea: match[4].trim(),
      })
    }
  }
  return days
}
