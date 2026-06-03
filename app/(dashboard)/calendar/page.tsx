'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DayModal from '@/components/calendar/DayModal'
import { CalendarDay, CalendarFramework } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, string> = {
  reel: 'var(--badge-reel)', carousel: 'var(--badge-carousel)', story: 'var(--badge-story)', static: 'var(--badge-static)',
}
const STATUS_COLORS: Record<string, string> = {
  idea: '#9e9e9e', planning: '#7a9478', filming: '#c4a06a', editing: '#8b7ab0', scheduled: '#5a8fbe', posted: '#4a7a4a',
}
const FORMAT_TEXT: Record<string, string> = {
  reel: 'var(--accent)', carousel: 'var(--accent)', story: 'var(--accent)', static: 'var(--accent)',
}
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function countPostsInMonth(year: number, month: number, postingDays: number[]) {
  const total = getDaysInMonth(year, month)
  let count = 0
  for (let d = 1; d <= total; d++) {
    if (postingDays.includes(new Date(year, month, d).getDay())) count++
  }
  return count
}
function parseCalendarClient(text: string): CalendarDay[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).flatMap(line => {
    const m = line.match(/^DAY_(\d+)\|(\w+)\|([^|]+)\|(.+)$/i)
    if (!m) return []
    const fmt = m[2].toLowerCase()
    return [{ day: parseInt(m[1]), format: (['reel','carousel','story','static'].includes(fmt) ? fmt : 'static') as CalendarDay['format'], theme: m[3].trim(), post_idea: m[4].trim() }]
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Framework state
  const [framework, setFramework] = useState<CalendarFramework>({ posts_per_week: 4, posting_days: [1, 3, 5, 0], monthly_focus: '' })
  const [reasoning, setReasoning] = useState<string>('')
  const [frameworkLoading, setFrameworkLoading] = useState(false)
  const [frameworkExpanded, setFrameworkExpanded] = useState(true)
  const [frameworkDirty, setFrameworkDirty] = useState(false)

  // Calendar state
  const [days, setDays] = useState<CalendarDay[]>([])
  const [savedDays, setSavedDays] = useState<CalendarDay[]>([])
  const [isProposal, setIsProposal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)

  // Proposal selection
  const [checkedDays, setCheckedDays] = useState<Set<number>>(new Set())

  // Post-save task generation offer
  const [showTasksOffer, setShowTasksOffer] = useState(false)
  const [generatingBatchTasks, setGeneratingBatchTasks] = useState(false)

  // Per-day pending proposals (individual ↺ regenerations)
  const [pending, setPending] = useState<Record<number, CalendarDay | null>>({})
  const [regenerating, setRegenerating] = useState<Record<number, boolean>>({})

  // Day modal
  const [modalDay, setModalDay] = useState<CalendarDay | null>(null)

  const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const postCount = countPostsInMonth(year, month, framework.posting_days)
  const hasCalendar = days.length > 0

  // Computed maps
  const dayMap = new Map(days.map(d => [d.day, d]))
  const savedDayMap = new Map(savedDays.map(d => [d.day, d]))

  // Load calendar + recommendation on month change
  useEffect(() => {
    loadCalendar()
    loadRecommendation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthYear])

  async function loadCalendar() {
    setCalendarLoading(true)
    setDays([])
    setSavedDays([])
    setPending({})
    setIsProposal(false)
    setCheckedDays(new Set())
    setShowTasksOffer(false)
    try {
      const res = await fetch(`/api/calendar?month_year=${monthYear}`)
      const data = await res.json()
      if (data?.days) {
        setDays(data.days)
        setSavedDays(data.days)
        setFrameworkExpanded(false)
        if (data.framework) {
          setFramework(data.framework)
          setFrameworkDirty(false)
        }
      } else {
        setFrameworkExpanded(true)
      }
    } catch { /* no calendar yet */ }
    finally { setCalendarLoading(false) }
  }

  async function saveCalendar() {
    setSaving(true)
    try {
      // Compute final days: kept saved + accepted proposals
      const proposalDayNums = new Set(days.map(d => d.day))
      const keptSaved = savedDays.filter(d => !proposalDayNums.has(d.day) || !checkedDays.has(d.day))
      const accepted = days.filter(d => checkedDays.has(d.day))
      const finalDays = [...keptSaved, ...accepted].sort((a, b) => a.day - b.day)

      const res = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', month_year: monthYear, days: finalDays, framework }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `Save failed (${res.status})`)
      }
      setSavedDays(finalDays)
      setDays(finalDays)
      setIsProposal(false)
      setShowTasksOffer(finalDays.length > 0)
      toast.success(`Calendar saved — ${finalDays.length} post${finalDays.length !== 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save calendar')
    } finally {
      setSaving(false)
    }
  }

  function discardProposal() {
    setDays([...savedDays])
    setIsProposal(false)
    setCheckedDays(new Set())
  }

  function removeDayFromProposal(dayNum: number) {
    setDays(prev => prev.filter(d => d.day !== dayNum))
    setCheckedDays(prev => { const n = new Set(prev); n.delete(dayNum); return n })
  }

  async function loadRecommendation() {
    setFrameworkLoading(true)
    setReasoning('')
    try {
      const res = await fetch('/api/calendar/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear }),
      })
      const data = await res.json()
      if (data.reasoning) setReasoning(data.reasoning)
      if (data.framework && !hasCalendar) {
        setFramework(data.framework)
        setFrameworkDirty(false)
      }
    } catch { /* non-critical */ }
    finally { setFrameworkLoading(false) }
  }

  function updateFramework(patch: Partial<CalendarFramework>) {
    setFramework(f => ({ ...f, ...patch }))
    setFrameworkDirty(true)
  }

  function toggleDay(dow: number) {
    setFramework(f => {
      const next = f.posting_days.includes(dow)
        ? f.posting_days.filter(d => d !== dow)
        : [...f.posting_days, dow]
      return { ...f, posting_days: next }
    })
    setFrameworkDirty(true)
  }

  async function generate() {
    if (generating || framework.posting_days.length === 0) return
    setGenerating(true)
    setDays([])
    setPending({})
    setCheckedDays(new Set())
    setShowTasksOffer(false)

    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear, days_in_month: daysInMonth, framework }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed (${res.status})`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let latestDays: CalendarDay[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const partial = parseCalendarClient(full)
        if (partial.length > 0) {
          setDays(partial)
          latestDays = partial
        }
      }
      setFrameworkExpanded(false)
      setFrameworkDirty(false)
      setIsProposal(true)
      setCheckedDays(new Set(latestDays.map(d => d.day)))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function proposeRegenerate(dayNum: number) {
    setRegenerating(r => ({ ...r, [dayNum]: true }))
    try {
      const res = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear, day: dayNum }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setPending(p => ({ ...p, [dayNum]: data }))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate')
    } finally {
      setRegenerating(r => ({ ...r, [dayNum]: false }))
    }
  }

  function acceptProposal(dayNum: number) {
    const proposal = pending[dayNum]
    if (!proposal) return
    setDays(prev => prev.map(d => d.day === dayNum ? proposal : d))
    setPending(p => { const n = { ...p }; delete n[dayNum]; return n })
    toast.success('Day updated')
  }

  function rejectProposal(dayNum: number) {
    setPending(p => { const n = { ...p }; delete n[dayNum]; return n })
  }

  async function generateBatchTasks() {
    setGeneratingBatchTasks(true)
    let totalTasks = 0
    try {
      for (const calDay of savedDays) {
        try {
          let projectId: string | undefined
          const projectTitle = calDay.theme?.trim() || `${monthYear} Day ${calDay.day}`
          const projectRes = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: projectTitle, type: 'content' }),
          })
          if (projectRes.ok) {
            const p = await projectRes.json()
            projectId = p.id
          }

          const tasksRes = await fetch('/api/tasks/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              month_year: monthYear,
              day: calDay.day,
              post_idea: calDay.post_idea,
              theme: calDay.theme,
              format: calDay.format,
            }),
          })
          const data = await tasksRes.json()
          if (!tasksRes.ok || !data.tasks?.length) continue

          // Create sequentially and chain: each task depends on the previous one
          let prevId: string | undefined
          for (const t of data.tasks as { title: string; category: string; priority: string; batch_group: string }[]) {
            const res = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...t,
                month_year: monthYear,
                calendar_day: calDay.day,
                source: 'calendar',
                project_id: projectId,
                depends_on: prevId ? [prevId] : [],
              }),
            })
            if (res.ok) {
              const created = await res.json()
              prevId = created.id
              totalTasks++
            }
          }
        } catch { /* skip failed days */ }
      }
      toast.success(`${totalTasks} tasks created across ${savedDays.length} posts`)
      setShowTasksOffer(false)
    } catch {
      toast.error('Could not generate tasks')
    } finally {
      setGeneratingBatchTasks(false)
    }
  }

  function exportCalendar() {
    const sorted = [...days].sort((a, b) => a.day - b.day)
    const text = sorted.map(d => `Day ${d.day} (${d.format.toUpperCase()}) — ${d.theme}\n${d.post_idea}`).join('\n\n')
    navigator.clipboard.writeText(`${getMonthLabel(year, month)} Content Calendar\n\n${text}`)
    toast.success('Calendar copied to clipboard')
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div>
      <PageHeader
        title="Content Calendar"
        description="A realistic posting plan built around your schedule"
        action={hasCalendar ? <Button variant="secondary" size="sm" onClick={exportCalendar}>Export</Button> : undefined}
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="p-2 rounded-lg transition-opacity hover:opacity-60 text-lg" style={{ color: 'var(--muted)' }}>←</button>
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{getMonthLabel(year, month)}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg transition-opacity hover:opacity-60 text-lg" style={{ color: 'var(--muted)' }}>→</button>
      </div>

      {/* Framework panel */}
      <Card className="mb-6">
        <button
          onClick={() => setFrameworkExpanded(e => !e)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Posting framework</span>
            {!frameworkExpanded && hasCalendar && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--cream-200)', color: 'var(--muted)' }}>
                {framework.posts_per_week}x/week · {framework.posting_days.map(d => DAY_NAMES[d]).join(', ')}
              </span>
            )}
          </div>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{frameworkExpanded ? '▲' : '▼'}</span>
        </button>

        {frameworkExpanded && (
          <div className="mt-5 space-y-5">
            {/* AI reasoning */}
            {frameworkLoading ? (
              <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--cream-200)' }}>
                <span className="streaming-cursor" style={{ color: 'var(--muted)' }}>Analysing your brand and this month</span>
              </div>
            ) : reasoning ? (
              <div className="p-4 rounded-xl" style={{ background: 'var(--cream-200)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>AI recommendation</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{reasoning}</p>
              </div>
            ) : null}

            {/* Posts per week slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Posts per week</label>
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{framework.posts_per_week}×</span>
              </div>
              <input
                type="range" min={1} max={7} value={framework.posts_per_week}
                onChange={e => updateFramework({ posts_per_week: Number(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--foreground)' }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>1 — minimum</span>
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>7 — daily</span>
              </div>
            </div>

            {/* Posting days */}
            <div>
              <label className="block text-sm font-medium mb-2.5" style={{ color: 'var(--foreground)' }}>Posting days</label>
              <div className="flex gap-1.5">
                {DAY_NAMES.map((name, dow) => {
                  const active = framework.posting_days.includes(dow)
                  return (
                    <button
                      key={dow}
                      onClick={() => toggleDay(dow)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: active ? 'var(--foreground)' : 'var(--background)',
                        color: active ? 'var(--background)' : 'var(--muted)',
                        border: `1.5px solid ${active ? 'var(--foreground)' : 'var(--border)'}`,
                      }}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Monthly focus */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                Monthly focus <span className="font-normal" style={{ color: 'var(--muted)' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={framework.monthly_focus}
                onChange={e => updateFramework({ monthly_focus: e.target.value })}
                placeholder="e.g. Autumn collection launch, push full suites"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Live post count + CTA */}
            <div className="flex items-center justify-between pt-1">
              <div>
                {framework.posting_days.length > 0 ? (
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                    That's <strong>{postCount} posts</strong> in {getMonthLabel(year, month).split(' ')[0]} —{' '}
                    <span style={{ color: 'var(--muted)' }}>
                      {DAY_FULL.filter((_, i) => framework.posting_days.includes(i)).join(', ')}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: '#8b3030' }}>Select at least one posting day</p>
                )}
              </div>
              <Button
                onClick={generate}
                loading={generating}
                disabled={framework.posting_days.length === 0 || calendarLoading}
              >
                {hasCalendar && frameworkDirty ? 'Update & regenerate' : hasCalendar ? 'Regenerate' : 'Agree & generate'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Proposal banner */}
      {isProposal && days.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl mb-5"
          style={{ background: '#f5c76a20', border: '1px solid #f5c76a' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: '#7a4f00' }}>
              {checkedDays.size} of {days.length} posts selected
            </p>
            <p className="text-xs" style={{ color: '#a06800' }}>
              Uncheck any posts you don't want, then save to confirm.
              {savedDays.length > 0 && ' Existing posts not in this proposal are kept.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={discardProposal}
              className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: '#7a4f00', border: '1px solid #f5c76a' }}
            >
              {savedDays.length > 0 ? 'Revert to saved' : 'Discard'}
            </button>
            <Button size="sm" onClick={saveCalendar} loading={saving} disabled={checkedDays.size === 0 && savedDays.length === 0}>
              Save calendar
            </Button>
          </div>
        </div>
      )}

      {/* Post-save task generation offer */}
      {showTasksOffer && !isProposal && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl mb-5"
          style={{ background: '#7a947820', border: '1px solid #7a9478' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Generate production tasks?</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Create task lists for all {savedDays.length} post{savedDays.length !== 1 ? 's' : ''} — one project per post, linked to this calendar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTasksOffer(false)}
              className="text-xs px-3 py-1.5 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: 'var(--muted)' }}
            >
              Skip
            </button>
            <Button size="sm" onClick={generateBatchTasks} loading={generatingBatchTasks}>
              Generate tasks
            </Button>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      {calendarLoading ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--muted)' }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const proposal = pending[dayNum]
              const isRegenerating = regenerating[dayNum]
              const hasPending = !!proposal

              // In proposal mode: proposal days come from dayMap, existing saved shown via savedDayMap
              const proposedData = isProposal ? dayMap.get(dayNum) : undefined
              const savedData = savedDayMap.get(dayNum)
              const dayData = isProposal ? (proposedData ?? savedData) : dayMap.get(dayNum)

              const isProposalCell = isProposal && !!proposedData
              const isKeptSaved = isProposal && !proposedData && !!savedData
              const replacesExisting = isProposalCell && !!savedData
              const isChecked = isProposalCell ? checkedDays.has(dayNum) : true

              const isPostingDay = framework.posting_days.includes(new Date(year, month, dayNum).getDay())

              return (
                <div
                  key={dayNum}
                  className={`rounded-xl p-2.5 relative group min-h-[100px] transition-all${dayData && !hasPending && !isProposalCell ? ' cursor-pointer' : isProposalCell ? ' cursor-pointer' : ''}`}
                  style={{
                    background: hasPending
                      ? 'var(--pending-bg)'
                      : isProposalCell
                        ? FORMAT_COLORS[proposedData!.format]
                        : dayData
                          ? FORMAT_COLORS[dayData.format]
                          : isPostingDay
                            ? 'var(--cream-200)'
                            : 'var(--background)',
                    border: `1px solid ${hasPending ? '#f5c76a' : isProposalCell && !isChecked ? 'var(--border)' : 'var(--border)'}`,
                    opacity: isRegenerating ? 0.5 : isProposalCell && !isChecked ? 0.45 : 1,
                  }}
                  onClick={() => {
                    if (hasPending) return
                    if (dayData) setModalDay(dayData)
                  }}
                >
                  {/* Day number row */}
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold" style={{ color: isPostingDay ? 'var(--stone-600,#655a4d)' : 'var(--muted)' }}>
                        {dayNum}
                      </span>
                      {dayData?.status && (
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: STATUS_COLORS[dayData.status] }}
                          title={dayData.status}
                        />
                      )}
                    </div>

                    {isProposalCell ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); proposeRegenerate(dayNum) }}
                          disabled={generating || isRegenerating}
                          className="text-xs leading-none p-0.5 rounded transition-opacity hover:opacity-60"
                          style={{ color: 'var(--muted)' }}
                          title="Regenerate this day"
                        >
                          ↺
                        </button>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            e.stopPropagation()
                            setCheckedDays(prev => {
                              const n = new Set(prev)
                              if (e.target.checked) n.add(dayNum)
                              else n.delete(dayNum)
                              return n
                            })
                          }}
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 mt-0.5 cursor-pointer"
                          style={{ accentColor: 'var(--foreground)', width: '13px', height: '13px' }}
                          title={isChecked ? 'Will be saved' : 'Will not be saved'}
                        />
                      </div>
                    ) : isKeptSaved ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                        saved
                      </span>
                    ) : (dayData && !hasPending) ? (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.7)', color: FORMAT_TEXT[dayData.format] }}>
                        {dayData.format}
                      </span>
                    ) : hasPending ? (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: '#f5c76a', color: '#7a4f00' }}>
                        New
                      </span>
                    ) : null}
                  </div>

                  {/* "Replaces" warning */}
                  {replacesExisting && isChecked && (
                    <p className="text-[9px] font-semibold uppercase tracking-widest mb-1 leading-tight" style={{ color: '#c07a6a' }}>
                      Replaces existing
                    </p>
                  )}

                  {/* Content */}
                  {hasPending && proposal ? (
                    <>
                      <p className="text-[10px] font-medium leading-tight mb-1" style={{ color: 'var(--foreground)' }}>{proposal.theme}</p>
                      <p className="text-[10px] leading-tight mb-2" style={{ color: 'var(--stone-500,#7c6e5e)' }}>{proposal.post_idea}</p>
                      <div className="flex gap-1">
                        <button onClick={e => { e.stopPropagation(); acceptProposal(dayNum) }}
                          className="flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                          ✓ Accept
                        </button>
                        <button onClick={e => { e.stopPropagation(); rejectProposal(dayNum) }}
                          className="flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                          ✗ Keep
                        </button>
                      </div>
                    </>
                  ) : dayData ? (
                    <>
                      <p className="text-[10px] font-medium leading-tight mb-1" style={{ color: 'var(--foreground)' }}>{dayData.theme}</p>
                      <p className="text-[10px] leading-tight" style={{ color: 'var(--stone-500,#7c6e5e)' }}>{dayData.post_idea}</p>
                      {isRegenerating ? (
                        <div className="absolute top-1.5 right-1.5">
                          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" style={{ color: 'var(--muted)' }} />
                        </div>
                      ) : isProposalCell ? (
                        <button
                          onClick={e => { e.stopPropagation(); removeDayFromProposal(dayNum) }}
                          className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-[10px] p-0.5 rounded transition-opacity"
                          style={{ color: 'var(--muted)' }}
                          title="Remove from proposal"
                        >
                          ×
                        </button>
                      ) : !isProposal ? (
                        <button
                          onClick={e => { e.stopPropagation(); proposeRegenerate(dayNum) }}
                          disabled={generating}
                          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-xs p-0.5 rounded transition-opacity"
                          style={{ color: 'var(--muted)' }}
                          title="Suggest a new idea for this day"
                        >
                          ↺
                        </button>
                      ) : null}
                    </>
                  ) : isPostingDay && generating ? (
                    <div className="flex items-center justify-center h-12">
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>…</span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          {hasCalendar && (
            <div className="flex gap-4 mt-4 justify-end items-center">
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Format:</span>
              {Object.entries(FORMAT_COLORS).map(([fmt, bg]) => (
                <div key={fmt} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: bg, border: '1px solid var(--border)' }} />
                  <span className="text-xs capitalize" style={{ color: 'var(--muted)' }}>{fmt}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Day modal */}
      {modalDay && (
        <DayModal
          day={modalDay}
          monthYear={monthYear}
          isProposal={isProposal}
          onClose={() => setModalDay(null)}
          onSave={updated => {
            setDays(prev => {
              const without = prev.filter(d => d.day !== modalDay!.day && d.day !== updated.day)
              return [...without, updated].sort((a, b) => a.day - b.day)
            })
            // Keep checkedDays consistent if day number changed
            if (isProposal && updated.day !== modalDay.day) {
              setCheckedDays(prev => {
                const n = new Set(prev)
                if (n.has(modalDay!.day)) { n.delete(modalDay!.day); n.add(updated.day) }
                return n
              })
            }
            setModalDay(null)
          }}
        />
      )}
    </div>
  )
}
