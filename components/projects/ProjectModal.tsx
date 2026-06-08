'use client'

import { useState, useEffect } from 'react'
import { Project, Task, FocusArea, Goal, CalendarDay } from '@/types'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import toast from 'react-hot-toast'

const FORMAT_COLORS: Record<string, string> = {
  reel: 'var(--badge-reel)', carousel: 'var(--badge-carousel)', story: 'var(--badge-story)', static: 'var(--badge-static)',
}
const PROD_STATUS_COLORS: Record<string, string> = {
  idea: '#9e9e9e', planning: '#7a9478', filming: '#c4a06a', editing: '#8b7ab0', scheduled: '#5a8fbe', posted: '#4a7a4a',
}
const TASK_STATUS_CYCLE: Task['status'][] = ['todo', 'in_progress', 'done']
const TASK_STATUS_ICON: Record<string, string> = { todo: '○', in_progress: '◐', done: '✓' }
const TASK_STATUS_COLOR: Record<string, string> = { todo: '#9e9e9e', in_progress: '#c4a06a', done: '#7a9478' }
const TASK_STATUS_LABEL: Record<string, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

interface ProposedTask {
  title: string
  category: string
  priority: string
  batch_group: string
  selected: boolean
}

interface TaskDraft {
  title: string
  status: Task['status']
  priority: Task['priority']
  due_date: string
}

interface Props {
  project: Project
  focusAreas: Pick<FocusArea, 'id' | 'title'>[]
  goals: Pick<Goal, 'id' | 'title'>[]
  onClose: () => void
  onUpdate: (updated: Project) => void
  onDelete: (id: string) => void
}

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

export default function ProjectModal({ project, focusAreas, goals, onClose, onUpdate, onDelete }: Props) {
  const isContent = project.type === 'content' && !!project.calendar_month_year

  // Shared state
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [generatingTasks, setGeneratingTasks] = useState(false)
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[]>([])
  const [addingTasks, setAddingTasks] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)

  // Content-project state
  const [calendarDay, setCalendarDay] = useState<CalendarDay | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [strategyExpanded, setStrategyExpanded] = useState(false)
  const [focusAreaId, setFocusAreaId] = useState(project.focus_area_id ?? '')
  const [goalId, setGoalId] = useState(project.goal_id ?? '')

  // General-project state
  const [form, setForm] = useState({ ...project })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setTasksLoading(true)
    fetch(`/api/tasks?project_id=${project.id}`)
      .then(r => r.json())
      .then(data => setLinkedTasks(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setTasksLoading(false))
  }, [project.id])

  useEffect(() => {
    if (!isContent || !project.calendar_month_year) return
    setCalendarLoading(true)
    fetch(`/api/calendar?month_year=${project.calendar_month_year}`)
      .then(r => r.json())
      .then(data => {
        if (data?.days && project.calendar_day != null) {
          const matched = (data.days as CalendarDay[]).find(d => d.day === project.calendar_day)
          if (matched) setCalendarDay(matched)
        }
      })
      .catch(() => {})
      .finally(() => setCalendarLoading(false))
  }, [isContent, project.calendar_month_year, project.calendar_day])

  // ── Task inline editing ──────────────────────────────────────────────────────

  function expandTask(t: Task) {
    setExpandedTaskId(t.id)
    setTaskDraft({ title: t.title, status: t.status, priority: t.priority, due_date: t.due_date ?? '' })
  }

  function collapseTask() {
    setExpandedTaskId(null)
    setTaskDraft(null)
  }

  async function cycleTaskStatus(t: Task, e: React.MouseEvent) {
    e.stopPropagation()
    const next = TASK_STATUS_CYCLE[(TASK_STATUS_CYCLE.indexOf(t.status) + 1) % TASK_STATUS_CYCLE.length]
    try {
      const res = await fetch(`/api/tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
      setLinkedTasks(prev => prev.map(lt => lt.id === t.id ? { ...lt, status: next } : lt))
    } catch {
      toast.error('Could not update task')
    }
  }

  async function saveTask(taskId: string) {
    if (!taskDraft) return
    setSavingTaskId(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskDraft.title,
          status: taskDraft.status,
          priority: taskDraft.priority,
          due_date: taskDraft.due_date || null,
        }),
      })
      if (!res.ok) throw new Error()
      setLinkedTasks(prev => prev.map(lt => lt.id === taskId ? { ...lt, ...taskDraft, due_date: taskDraft.due_date || undefined } : lt))
      collapseTask()
    } catch {
      toast.error('Could not save task')
    } finally {
      setSavingTaskId(null)
    }
  }

  // ── Save project ─────────────────────────────────────────────────────────────

  async function save() {
    setSaving(true)
    try {
      let body: Record<string, unknown>
      if (isContent) {
        body = { focus_area_id: focusAreaId || null, goal_id: goalId || null }
      } else {
        body = {
          title: form.title,
          type: form.type,
          status: form.status,
          due_date: form.due_date ?? null,
          focus_area_id: form.focus_area_id ?? null,
          goal_id: form.goal_id ?? null,
        }
      }
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      onUpdate(isContent ? { ...project, focus_area_id: focusAreaId || undefined, goal_id: goalId || undefined } : form)
      toast.success('Saved')
      onClose()
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDelete(project.id)
      toast.success('Project deleted')
      onClose()
    } catch {
      toast.error('Could not delete project')
    } finally {
      setDeleting(false)
    }
  }

  // ── Task generation ──────────────────────────────────────────────────────────

  async function generateTasks() {
    setGeneratingTasks(true)
    setProposedTasks([])
    try {
      const body = isContent && calendarDay
        ? { month_year: project.calendar_month_year, day: project.calendar_day, post_idea: calendarDay.post_idea, theme: calendarDay.theme, format: calendarDay.format }
        : { post_idea: project.title, theme: project.title, format: 'general' }
      const res = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    try {
      let dueDate: string | undefined
      if (isContent && project.calendar_month_year && project.calendar_day != null) {
        const [yr, mo] = project.calendar_month_year.split('-')
        dueDate = `${yr}-${mo}-${String(project.calendar_day).padStart(2, '0')}`
      }
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
            source: isContent ? 'calendar' : 'manual',
            project_id: project.id,
            focus_area_id: (isContent ? focusAreaId : form.focus_area_id) || null,
            goal_id: (isContent ? goalId : form.goal_id) || null,
            due_date: dueDate ?? null,
            month_year: isContent ? project.calendar_month_year : null,
            calendar_day: isContent ? project.calendar_day : null,
            depends_on: prevId ? [prevId] : [],
          }),
        })
        if (res.ok) {
          const created = await res.json()
          prevId = created.id
        }
      }
      const refreshed = await fetch(`/api/tasks?project_id=${project.id}`).then(r => r.json()).catch(() => [])
      setLinkedTasks(Array.isArray(refreshed) ? refreshed : [])
      setProposedTasks([])
      toast.success(`${selected.length} task${selected.length !== 1 ? 's' : ''} added`)
    } catch {
      toast.error('Could not add tasks')
    } finally {
      setAddingTasks(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function formatPostDate(monthYear: string, day: number) {
    const [yr, mo] = monthYear.split('-')
    return new Date(Number(yr), Number(mo) - 1, day)
      .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const doneCount = linkedTasks.filter(t => t.status === 'done').length

  // ── Render task list ─────────────────────────────────────────────────────────

  function renderTaskRow(t: Task) {
    const isExpanded = expandedTaskId === t.id
    return (
      <div key={t.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {/* Collapsed row */}
        {!isExpanded ? (
          <div
            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: 'var(--background)' }}
            onClick={() => expandTask(t)}
          >
            <button
              onClick={e => cycleTaskStatus(t, e)}
              className="shrink-0 text-xs hover:opacity-70 transition-opacity"
              style={{ color: TASK_STATUS_COLOR[t.status] }}
              title={`Status: ${TASK_STATUS_LABEL[t.status]} — click to cycle`}
            >
              {TASK_STATUS_ICON[t.status]}
            </button>
            <span className={`text-xs flex-1 truncate${t.status === 'done' ? ' line-through opacity-50' : ''}`} style={{ color: 'var(--foreground)' }}>
              {t.title}
            </span>
            {t.due_date && (
              <span className="text-[10px] shrink-0" style={{ color: 'var(--muted)' }}>
                {new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {t.batch_group && (
              <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                {t.batch_group}
              </span>
            )}
          </div>
        ) : (
          /* Expanded row */
          <div className="px-3 py-3 space-y-3" style={{ background: 'var(--surface)' }}>
            {/* Title input */}
            <input
              value={taskDraft?.title ?? ''}
              onChange={e => setTaskDraft(d => d ? { ...d, title: e.target.value } : d)}
              className="w-full px-3 py-1.5 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              autoFocus
            />
            <div className="flex gap-4 flex-wrap">
              {/* Status */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Status</p>
                <div className="flex gap-1">
                  {TASK_STATUS_CYCLE.map(s => (
                    <button
                      key={s}
                      onClick={() => setTaskDraft(d => d ? { ...d, status: s } : d)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
                      style={{
                        background: taskDraft?.status === s ? TASK_STATUS_COLOR[s] : 'var(--border)',
                        color: taskDraft?.status === s ? '#fff' : 'var(--muted)',
                      }}
                    >
                      {TASK_STATUS_ICON[s]} {TASK_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Priority */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Priority</p>
                <div className="flex gap-1">
                  {(['low', 'medium', 'high'] as Task['priority'][]).map(p => (
                    <button
                      key={p}
                      onClick={() => setTaskDraft(d => d ? { ...d, priority: p } : d)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium capitalize transition-all"
                      style={{
                        background: taskDraft?.priority === p
                          ? (p === 'high' ? '#c07a6a' : p === 'low' ? '#7a9478' : '#c4a06a')
                          : 'var(--border)',
                        color: taskDraft?.priority === p ? '#fff' : 'var(--muted)',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {/* Due date */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Due date</p>
                <input
                  type="date"
                  value={taskDraft?.due_date ?? ''}
                  onChange={e => setTaskDraft(d => d ? { ...d, due_date: e.target.value } : d)}
                  className="px-2 py-1 rounded-lg text-[10px] outline-none transition-all"
                  style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={collapseTask} className="text-xs px-3 py-1.5 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                Cancel
              </button>
              <Button size="sm" onClick={() => saveTask(t.id)} loading={savingTaskId === t.id}>
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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
        {/* ── Content project header ── */}
        {isContent ? (
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {calendarLoading ? (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Loading post details…</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1.5">
                      {calendarDay && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                          style={{ background: FORMAT_COLORS[calendarDay.format], color: 'var(--foreground)' }}
                        >
                          {calendarDay.format}
                        </span>
                      )}
                      {calendarDay?.status && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                          style={{ background: PROD_STATUS_COLORS[calendarDay.status] + '25', color: PROD_STATUS_COLORS[calendarDay.status] }}
                        >
                          {calendarDay.status}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold leading-tight mb-0.5" style={{ color: 'var(--foreground)' }}>
                      {calendarDay?.theme ?? project.title}
                    </h2>
                    {project.calendar_month_year && project.calendar_day != null && (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {formatPostDate(project.calendar_month_year, project.calendar_day)}
                      </p>
                    )}
                  </>
                )}
              </div>
              <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity ml-4 shrink-0" style={{ color: 'var(--muted)' }}>×</button>
            </div>
          </div>
        ) : (
          /* ── General/client project header ── */
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>
              {project.type} project
            </p>
            <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity" style={{ color: 'var(--muted)' }}>×</button>
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          {/* ── Content project body ── */}
          {isContent ? (
            <>
              {/* Post idea (read-only) */}
              {calendarDay?.post_idea && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Post idea</label>
                    {project.calendar_month_year && (
                      <Link
                        href="/calendar"
                        className="text-[10px] underline underline-offset-2 hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--muted)' }}
                        onClick={onClose}
                      >
                        Edit in Calendar →
                      </Link>
                    )}
                  </div>
                  <p className="text-sm px-3 py-2.5 rounded-lg leading-relaxed" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    {calendarDay.post_idea}
                  </p>
                </div>
              )}

              {/* Link to strategy (collapsible) */}
              {(focusAreas.length > 0 || goals.length > 0) && (
                <div>
                  <button
                    onClick={() => setStrategyExpanded(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--muted)' }}
                  >
                    <span>{strategyExpanded ? '▾' : '▸'}</span>
                    Link to strategy {(focusAreaId || goalId) && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--border)' }}>linked</span>}
                  </button>
                  {strategyExpanded && (
                    <div className="mt-3 space-y-3">
                      {focusAreas.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Focus area</label>
                          <select
                            value={focusAreaId}
                            onChange={e => setFocusAreaId(e.target.value)}
                            className={inputClass}
                            style={inputStyle}
                            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                          >
                            <option value="">None</option>
                            {focusAreas.map(fa => <option key={fa.id} value={fa.id}>{fa.title}</option>)}
                          </select>
                        </div>
                      )}
                      {goals.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Goal</label>
                          <select
                            value={goalId}
                            onChange={e => setGoalId(e.target.value)}
                            className={inputClass}
                            style={inputStyle}
                            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                          >
                            <option value="">None</option>
                            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ── General/client project body ── */
            <>
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              {/* Due date */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Due date <span className="font-normal normal-case">(optional)</span></label>
                <input
                  type="date"
                  value={form.due_date ?? ''}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value || undefined }))}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              {/* Type + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as Project['type'] }))}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  >
                    <option value="content">Content</option>
                    <option value="client">Client</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Project['status'] }))}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Focus area */}
              {focusAreas.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Focus area</label>
                  <select
                    value={form.focus_area_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, focus_area_id: e.target.value || undefined }))}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  >
                    <option value="">None</option>
                    {focusAreas.map(fa => <option key={fa.id} value={fa.id}>{fa.title}</option>)}
                  </select>
                </div>
              )}

              {/* Goal */}
              {goals.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Goal</label>
                  <select
                    value={form.goal_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, goal_id: e.target.value || undefined }))}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  >
                    <option value="">None</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {/* ── Tasks section (shared) ── */}
          <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3 pt-3">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Tasks
                {!tasksLoading && linkedTasks.length > 0 && (
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                    {doneCount}/{linkedTasks.length} done
                  </span>
                )}
              </p>
              {!tasksLoading && linkedTasks.length === 0 && proposedTasks.length === 0 && (
                <Button variant="secondary" size="sm" onClick={generateTasks} loading={generatingTasks}>
                  Generate tasks
                </Button>
              )}
            </div>

            {tasksLoading ? (
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>Loading tasks…</p>
            ) : linkedTasks.length > 0 ? (
              <div className="space-y-1.5 mb-3">
                {linkedTasks.map(t => renderTaskRow(t))}
              </div>
            ) : (
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>No tasks yet. Click "Generate tasks" to create a task list.</p>
            )}

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
                        {t.batch_group && <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{t.batch_group}</p>}
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
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Delete this project?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
                style={{ background: '#c07a6a20', color: '#c07a6a' }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs hover:opacity-70 transition-opacity px-2 py-1"
              style={{ color: 'var(--muted)' }}
            >
              Delete project
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm hover:opacity-70 transition-opacity px-4 py-2" style={{ color: 'var(--muted)' }}>
              Cancel
            </button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
