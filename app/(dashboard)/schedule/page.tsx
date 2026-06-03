'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import DayModal from '@/components/calendar/DayModal'
import { CalendarDay, Task } from '@/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FORMAT_COLORS: Record<string, string> = {
  reel: 'var(--badge-reel)', carousel: 'var(--badge-carousel)', story: 'var(--badge-story)', static: 'var(--badge-static)',
}
const STATUS_COLORS: Record<string, string> = {
  idea: '#9e9e9e', planning: '#7a9478', filming: '#c4a06a', editing: '#8b7ab0', scheduled: '#5a8fbe', posted: '#4a7a4a',
}
const PRIORITY_COLORS: Record<string, string> = { high: '#c07a6a', medium: '#c4a06a', low: '#7a9478' }
const TASK_STATUS_COLOR: Record<string, string> = { todo: '#9e9e9e', in_progress: '#c4a06a', done: '#7a9478' }

function getMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function SchedulePage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [modalDay, setModalDay] = useState<CalendarDay | null>(null)

  const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthYear])

  async function load() {
    setLoading(true)
    try {
      const [calRes, taskRes] = await Promise.all([
        fetch(`/api/calendar?month_year=${monthYear}`),
        fetch(`/api/tasks?schedule_month=${monthYear}`),
      ])
      const [calData, taskData] = await Promise.all([calRes.json(), taskRes.json()])
      setCalendarDays(calData?.days ?? [])
      setTasks(Array.isArray(taskData) ? taskData : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const dayMap = new Map(calendarDays.map(d => [d.day, d]))

  // Group tasks by their display day
  function tasksForDay(dayNum: number): Task[] {
    const dateStr = `${monthYear}-${String(dayNum).padStart(2, '0')}`
    return tasks.filter(t => {
      if (t.month_year === monthYear && t.calendar_day === dayNum) return true
      if (t.due_date === dateStr) return true
      return false
    })
  }

  const todayDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : null

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="All activities — content, tasks, and deliverables in one view"
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={prevMonth} className="p-2 rounded-lg transition-opacity hover:opacity-60 text-lg" style={{ color: 'var(--muted)' }}>←</button>
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{getMonthLabel(year, month)}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg transition-opacity hover:opacity-60 text-lg" style={{ color: 'var(--muted)' }}>→</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-5 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--badge-reel)' }} />
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Content post</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#c07a6a' }} />
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>High-priority task</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#c4a06a' }} />
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Medium task</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#7a9478' }} />
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Low task / done</span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
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
              const post = dayMap.get(dayNum)
              const dayTasks = tasksForDay(dayNum)
              const openTasks = dayTasks.filter(t => t.status !== 'done')
              const doneTasks = dayTasks.filter(t => t.status === 'done')
              const isToday = dayNum === todayDay

              return (
                <div
                  key={dayNum}
                  className="rounded-xl p-2 min-h-[90px] relative flex flex-col gap-1"
                  style={{
                    background: isToday ? 'var(--cream-200)' : 'var(--background)',
                    border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-xs font-semibold${isToday ? '' : ''}`}
                      style={{ color: isToday ? 'var(--foreground)' : 'var(--muted)' }}
                    >
                      {dayNum}
                    </span>
                    {isToday && <span className="text-[8px] px-1 rounded-full font-semibold" style={{ background: 'var(--accent)', color: '#fff' }}>Today</span>}
                  </div>

                  {/* Content post */}
                  {post && (
                    <button
                      onClick={() => setModalDay(post)}
                      className="w-full text-left rounded-md px-1.5 py-1 hover:opacity-80 transition-opacity"
                      style={{ background: FORMAT_COLORS[post.format] }}
                      title={post.post_idea}
                    >
                      <div className="flex items-center gap-1">
                        {post.status && (
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[post.status] }} />
                        )}
                        <p className="text-[9px] font-semibold uppercase tracking-wide leading-none truncate" style={{ color: 'var(--stone-600,#655a4d)' }}>
                          {post.format}
                        </p>
                      </div>
                      <p className="text-[9px] leading-tight mt-0.5 truncate" style={{ color: 'var(--stone-500,#7c6e5e)' }}>{post.theme}</p>
                    </button>
                  )}

                  {/* Tasks */}
                  {openTasks.slice(0, 3).map(t => (
                    <Link
                      key={t.id}
                      href="/tasks"
                      className="block w-full text-left rounded-md px-1.5 py-0.5 hover:opacity-80 transition-opacity"
                      style={{ background: PRIORITY_COLORS[t.priority] + '18', border: `1px solid ${PRIORITY_COLORS[t.priority]}40` }}
                      title={t.title}
                    >
                      <p className="text-[9px] leading-tight truncate" style={{ color: TASK_STATUS_COLOR[t.status] }}>{t.title}</p>
                    </Link>
                  ))}
                  {openTasks.length > 3 && (
                    <Link href="/tasks" className="text-[9px]" style={{ color: 'var(--muted)' }}>+{openTasks.length - 3} more</Link>
                  )}
                  {doneTasks.length > 0 && openTasks.length === 0 && (
                    <p className="text-[9px]" style={{ color: '#7a9478' }}>✓ {doneTasks.length} done</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Empty state */}
          {calendarDays.length === 0 && tasks.length === 0 && (
            <div className="mt-8 text-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Nothing planned for {getMonthLabel(year, month).split(' ')[0]} yet.{' '}
                <Link href="/calendar" className="underline underline-offset-2">Generate content calendar</Link>
                {' '}or{' '}
                <Link href="/tasks" className="underline underline-offset-2">add tasks</Link>.
              </p>
            </div>
          )}
        </>
      )}

      {/* Day modal for content posts */}
      {modalDay && (
        <DayModal
          day={modalDay}
          monthYear={monthYear}
          onClose={() => setModalDay(null)}
          onSave={updated => {
            setCalendarDays(prev => {
              const without = prev.filter(d => d.day !== modalDay!.day && d.day !== updated.day)
              return [...without, updated].sort((a, b) => a.day - b.day)
            })
            setModalDay(null)
          }}
          onTasksAdded={() => load()}
        />
      )}
    </div>
  )
}
