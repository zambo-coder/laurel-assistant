'use client'

import { useState, useEffect } from 'react'
import { CalendarDay, Task } from '@/types'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import toast from 'react-hot-toast'

const TASK_STATUS_ICON: Record<string, string> = { todo: '○', in_progress: '◐', done: '✓' }
const TASK_STATUS_COLOR: Record<string, string> = { todo: '#9e9e9e', in_progress: '#c4a06a', done: '#7a9478' }

const FORMATS: CalendarDay['format'][] = ['reel', 'carousel', 'story', 'static']
const STATUSES: Array<{ value: NonNullable<CalendarDay['status']>; label: string; color: string }> = [
  { value: 'idea',      label: 'Idea',      color: '#9e9e9e' },
  { value: 'planning',  label: 'Planning',  color: '#7a9478' },
  { value: 'filming',   label: 'Filming',   color: '#c4a06a' },
  { value: 'editing',   label: 'Editing',   color: '#8b7ab0' },
  { value: 'scheduled', label: 'Scheduled', color: '#5a8fbe' },
  { value: 'posted',    label: 'Posted',    color: '#4a7a4a' },
]

interface ProposedTask {
  title: string
  category: string
  priority: string
  batch_group: string
  selected: boolean
}

interface Props {
  day: CalendarDay
  monthYear: string
  isProposal?: boolean
  onClose: () => void
  onSave: (updated: CalendarDay) => void
  onTasksAdded?: () => void
}

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

export default function DayModal({ day, monthYear, isProposal, onClose, onSave, onTasksAdded }: Props) {
  const [form, setForm] = useState<CalendarDay>({ ...day })
  const [targetDay, setTargetDay] = useState(day.day)
  const [saving, setSaving] = useState(false)
  const [generatingTasks, setGeneratingTasks] = useState(false)
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[]>([])
  const [addingTasks, setAddingTasks] = useState(false)
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Load tasks linked to this day
  useEffect(() => {
    setTasksLoading(true)
    fetch(`/api/tasks?month_year=${monthYear}&calendar_day=${day.day}`)
      .then(r => r.json())
      .then(data => setLinkedTasks(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setTasksLoading(false))
  }, [monthYear, day.day])

  async function save() {
    if (isProposal) {
      onSave({ ...form, day: targetDay })
      toast.success('Changes applied — save the calendar to confirm')
      onClose()
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', month_year: monthYear, day: day.day, updates: { ...form, day: targetDay } }),
      })
      if (!res.ok) throw new Error()
      onSave({ ...form, day: targetDay })
      toast.success('Day saved')
      onClose()
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function generateTasks() {
    setGeneratingTasks(true)
    setProposedTasks([])
    try {
      const res = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear, day: form.day, post_idea: form.post_idea, theme: form.theme, format: form.format }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setProposedTasks((data.tasks ?? []).map((t: Omit<ProposedTask, 'selected'>) => ({ ...t, selected: true })))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate tasks')
    } finally {
      setGeneratingTasks(false)
    }
  }

  async function confirmTasks() {
    const selected = proposedTasks.filter(t => t.selected)
    if (!selected.length) { setProposedTasks([]); return }
    setAddingTasks(true)
    const [yr, mo] = monthYear.split('-')
    const dueDate = `${yr}-${mo}-${String(form.day).padStart(2, '0')}`
    try {
      // Auto-create a content project for this calendar post
      let projectId: string | undefined
      try {
        const projectTitle = form.theme?.trim() || `${monthYear} Day ${form.day}`
        const projectRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: projectTitle, type: 'content' }),
        })
        if (projectRes.ok) {
          const p = await projectRes.json()
          projectId = p.id
        }
      } catch { /* non-fatal — tasks still created without project */ }

      // Create sequentially and chain: each task depends on the previous one
      let prevId: string | undefined
      for (const t of selected) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t.title,
            category: t.category,
            priority: t.priority,
            batch_group: t.batch_group,
            due_date: dueDate,
            month_year: monthYear,
            calendar_day: form.day,
            source: 'calendar',
            project_id: projectId,
            depends_on: prevId ? [prevId] : [],
          }),
        })
        if (res.ok) {
          const created = await res.json()
          prevId = created.id
        }
      }
      // Refresh linked tasks list
      const refreshed = await fetch(`/api/tasks?month_year=${monthYear}&calendar_day=${form.day}`).then(r => r.json()).catch(() => [])
      setLinkedTasks(Array.isArray(refreshed) ? refreshed : [])
      setProposedTasks([])
      toast.success(`${selected.length} task${selected.length !== 1 ? 's' : ''} added`)
      onTasksAdded?.()
    } catch {
      toast.error('Could not add tasks')
    } finally {
      setAddingTasks(false)
    }
  }

  const [year, monthStr] = monthYear.split('-')
  const daysInMonth = new Date(Number(year), Number(monthStr), 0).getDate()
  const dateLabel = new Date(Number(year), Number(monthStr) - 1, targetDay)
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--muted)' }}>{monthYear}</p>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{dateLabel}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs" style={{ color: 'var(--muted)' }}>Day</label>
              <select
                value={targetDay}
                onChange={e => setTargetDay(Number(e.target.value))}
                className="px-2 py-1 rounded-lg text-xs outline-none"
                style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity" style={{ color: 'var(--muted)' }}>×</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: form.status === s.value ? s.color : 'var(--border)',
                    color: form.status === s.value ? '#fff' : 'var(--muted)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Format</label>
            <div className="flex gap-1.5">
              {FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => setForm(prev => ({ ...prev, format: f }))}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: form.format === f ? 'var(--foreground)' : 'var(--border)',
                    color: form.format === f ? 'var(--background)' : 'var(--muted)',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Theme</label>
            <input
              value={form.theme}
              onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              placeholder="2–5 word theme"
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Post idea */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Post idea</label>
            <textarea
              value={form.post_idea}
              onChange={e => setForm(f => ({ ...f, post_idea: e.target.value }))}
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
              placeholder="Describe the post concept"
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Caption <span className="font-normal normal-case" style={{ color: 'var(--muted)' }}>(optional)</span></label>
            <textarea
              value={form.caption ?? ''}
              onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
              placeholder="Write or paste the final caption here"
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Notes <span className="font-normal normal-case" style={{ color: 'var(--muted)' }}>(optional)</span></label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={`${inputClass} resize-none`}
              style={inputStyle}
              placeholder="Any notes, references, or reminders"
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Tasks section */}
          <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3 pt-4">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Production tasks</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Tasks linked to this post</p>
              </div>
              <Button variant="secondary" size="sm" onClick={generateTasks} loading={generatingTasks}>
                Generate tasks
              </Button>
            </div>

            {/* Existing linked tasks */}
            {tasksLoading ? (
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>Loading tasks…</p>
            ) : linkedTasks.length > 0 ? (
              <div className="mb-4 space-y-1.5">
                {linkedTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                    <span className="text-xs shrink-0" style={{ color: TASK_STATUS_COLOR[t.status] }}>{TASK_STATUS_ICON[t.status]}</span>
                    <span className={`text-xs flex-1 truncate${t.status === 'done' ? ' line-through opacity-50' : ''}`} style={{ color: 'var(--foreground)' }}>{t.title}</span>
                    {t.batch_group && <span className="text-[10px] shrink-0" style={{ color: 'var(--muted)' }}>{t.batch_group}</span>}
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <Link href="/tasks" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted)' }}>View all tasks →</Link>
                </div>
              </div>
            ) : null}

            {proposedTasks.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-2.5" style={{ background: 'var(--cream-200)', borderBottom: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Select tasks to add</p>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {proposedTasks.map((t, i) => (
                    <label key={i} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                      <input
                        type="checkbox"
                        checked={t.selected}
                        onChange={e => setProposedTasks(prev => prev.map((p, pi) => pi === i ? { ...p, selected: e.target.checked } : p))}
                        className="shrink-0"
                        style={{ accentColor: 'var(--foreground)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: 'var(--foreground)' }}>{t.title}</p>
                        {t.batch_group && (
                          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{t.batch_group}</p>
                        )}
                      </div>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: t.priority === 'high' ? '#c07a6a20' : t.priority === 'low' ? '#7a947820' : '#c4a06a20',
                          color: t.priority === 'high' ? '#c07a6a' : t.priority === 'low' ? '#7a9478' : '#c4a06a',
                        }}
                      >
                        {t.priority}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setProposedTasks([])} className="text-xs hover:opacity-70 transition-opacity px-3 py-1.5" style={{ color: 'var(--muted)' }}>
                    Cancel
                  </button>
                  <Button size="sm" onClick={confirmTasks} loading={addingTasks}>
                    Add {proposedTasks.filter(t => t.selected).length} task{proposedTasks.filter(t => t.selected).length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="text-sm hover:opacity-70 transition-opacity px-4 py-2" style={{ color: 'var(--muted)' }}>
            Cancel
          </button>
          <Button onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
    </div>
  )
}
