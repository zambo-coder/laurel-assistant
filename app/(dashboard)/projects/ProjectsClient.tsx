'use client'

import { useState } from 'react'
import { Project, FocusArea, Goal, CalendarDay, ContentCalendar } from '@/types'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import ProjectModal from '@/components/projects/ProjectModal'
import toast from 'react-hot-toast'

const FORMAT_COLORS: Record<string, string> = {
  reel: 'var(--badge-reel)', carousel: 'var(--badge-carousel)', story: 'var(--badge-story)', static: 'var(--badge-static)',
}
const PROD_STATUS_COLORS: Record<string, string> = {
  idea: '#9e9e9e', planning: '#7a9478', filming: '#c4a06a', editing: '#8b7ab0', scheduled: '#5a8fbe', posted: '#4a7a4a',
}
const TYPE_COLORS: Record<string, string> = {
  content: '#5a8fbe', client: '#7a9478', general: '#c4a06a',
}

interface CalendarEntry {
  month_year: string
  day: CalendarDay
  project?: Project
}

interface MonthGroup {
  monthYear: string
  calendarEntries: CalendarEntry[]
  projects: Project[]
}

interface Props {
  initialProjects: Project[]
  taskCounts: Record<string, { total: number; done: number }>
  focusAreas: Pick<FocusArea, 'id' | 'title'>[]
  goals: Pick<Goal, 'id' | 'title'>[]
  calendars: Pick<ContentCalendar, 'month_year' | 'days'>[]
}

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

export default function ProjectsClient({ initialProjects, taskCounts, focusAreas, goals, calendars }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [counts, setCounts] = useState(taskCounts)
  const [openingEntry, setOpeningEntry] = useState<string | null>(null)
  // Suppress calendar entries whose projects were deleted this session
  const [deletedCalendarKeys, setDeletedCalendarKeys] = useState<Set<string>>(new Set())

  // Create form state
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<Project['type']>('general')
  const [newDueDate, setNewDueDate] = useState('')
  const [newFocusAreaId, setNewFocusAreaId] = useState('')
  const [newGoalId, setNewGoalId] = useState('')
  const [creating, setCreating] = useState(false)

  async function createProject() {
    if (!newTitle.trim()) return
    if (newType !== 'content' && !newDueDate) {
      toast.error('Please set a due date')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          due_date: newDueDate || null,
          focus_area_id: newFocusAreaId || null,
          goal_id: newGoalId || null,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setProjects(prev => [created, ...prev])
      setCounts(prev => ({ ...prev, [created.id]: { total: 0, done: 0 } }))
      setNewTitle('')
      setNewType('general')
      setNewDueDate('')
      setNewFocusAreaId('')
      setNewGoalId('')
      setShowCreate(false)
      toast.success('Project created')
    } catch {
      toast.error('Could not create project')
    } finally {
      setCreating(false)
    }
  }

  async function openUntrackedEntry(entry: CalendarEntry) {
    const key = `${entry.month_year}:${entry.day.day}`
    setOpeningEntry(key)
    try {
      const title = entry.day.theme?.trim() || `${entry.month_year} Day ${entry.day.day}`
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type: 'content',
          calendar_month_year: entry.month_year,
          calendar_day: entry.day.day,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setProjects(prev => [created, ...prev])
      setCounts(prev => ({ ...prev, [created.id]: { total: 0, done: 0 } }))
      setSelectedProject(created)
    } catch {
      toast.error('Could not create project')
    } finally {
      setOpeningEntry(null)
    }
  }

  function handleUpdate(updated: Project) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handleDelete(id: string) {
    const deleted = projects.find(p => p.id === id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setCounts(prev => { const n = { ...prev }; delete n[id]; return n })
    if (deleted?.calendar_month_year && deleted.calendar_day != null) {
      const key = `${deleted.calendar_month_year}:${deleted.calendar_day}`
      setDeletedCalendarKeys(prev => new Set([...prev, key]))
    }
  }

  // ── Build month groups ───────────────────────────────────────────────────────

  // Calendar entries (content posts from fetched calendars)
  const contentEntries: CalendarEntry[] = []
  for (const cal of [...calendars].sort((a, b) => a.month_year.localeCompare(b.month_year))) {
    for (const day of [...(cal.days ?? [])].sort((a, b) => a.day - b.day)) {
      const key = `${cal.month_year}:${day.day}`
      if (deletedCalendarKeys.has(key)) continue
      const project = projects.find(p =>
        p.type === 'content' &&
        p.calendar_month_year === cal.month_year &&
        p.calendar_day === day.day
      )
      contentEntries.push({ month_year: cal.month_year, day, project })
    }
  }

  // Standalone projects: general/client + content without calendar fields
  const standaloneProjects = projects.filter(p =>
    p.type !== 'content' || !p.calendar_month_year
  )

  // Merge into month groups
  const groupMap = new Map<string, MonthGroup>()

  for (const entry of contentEntries) {
    if (!groupMap.has(entry.month_year)) {
      groupMap.set(entry.month_year, { monthYear: entry.month_year, calendarEntries: [], projects: [] })
    }
    groupMap.get(entry.month_year)!.calendarEntries.push(entry)
  }

  for (const project of standaloneProjects) {
    const monthYear = project.due_date
      ? project.due_date.slice(0, 7)
      : '__unplanned'
    if (!groupMap.has(monthYear)) {
      groupMap.set(monthYear, { monthYear, calendarEntries: [], projects: [] })
    }
    groupMap.get(monthYear)!.projects.push(project)
  }

  const sortedGroups = [...groupMap.entries()]
    .sort(([a], [b]) => {
      if (a === '__unplanned') return 1
      if (b === '__unplanned') return -1
      return a.localeCompare(b)
    })
    .map(([, g]) => g)

  const isEmpty = sortedGroups.length === 0

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function formatShortDate(monthYear: string, day: number) {
    const [yr, mo] = monthYear.split('-')
    return new Date(Number(yr), Number(mo) - 1, day)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function monthLabel(monthYear: string) {
    if (monthYear === '__unplanned') return 'No date'
    const [yr, mo] = monthYear.split('-')
    return new Date(Number(yr), Number(mo) - 1, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  // ── Content (calendar) card ──────────────────────────────────────────────────

  function renderContentCard(entry: CalendarEntry) {
    const { project, day, month_year } = entry
    const key = `${month_year}:${day.day}`
    const isOpening = openingEntry === key
    const count = project ? counts[project.id] : undefined
    const progress = count && count.total > 0 ? Math.round((count.done / count.total) * 100) : null

    return (
      <div
        key={project?.id ?? key}
        className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: isOpening ? 0.6 : 1 }}
        onClick={() => {
          if (isOpening) return
          if (project) setSelectedProject(project)
          else openUntrackedEntry(entry)
        }}
      >
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
            style={{ background: FORMAT_COLORS[day.format], color: 'var(--foreground)' }}
          >
            {day.format}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            {formatShortDate(month_year, day.day)}
          </span>
          {day.status && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
              style={{ background: PROD_STATUS_COLORS[day.status] + '25', color: PROD_STATUS_COLORS[day.status] }}
            >
              {day.status}
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold leading-tight mb-1.5" style={{ color: 'var(--foreground)' }}>
          {day.theme}
        </h3>

        {day.post_idea && (
          <p className="text-[11px] leading-snug mb-3 line-clamp-2" style={{ color: 'var(--muted)' }}>
            {day.post_idea}
          </p>
        )}

        {count && count.total > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{count.done}/{count.total} tasks done</span>
              <span className="text-[10px] font-medium" style={{ color: 'var(--foreground)' }}>{progress}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: progress === 100 ? '#7a9478' : 'var(--foreground)' }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            {isOpening ? 'Opening…' : 'No tasks yet'}
          </p>
        )}
      </div>
    )
  }

  // ── Standalone project card ──────────────────────────────────────────────────

  function renderProjectCard(project: Project) {
    const count = counts[project.id]
    const focusArea = focusAreas.find(f => f.id === project.focus_area_id)
    const goal = goals.find(g => g.id === project.goal_id)
    const progress = count && count.total > 0 ? Math.round((count.done / count.total) * 100) : null
    const isOverdue = project.due_date && project.status === 'active' &&
      new Date(project.due_date + 'T00:00:00') < new Date()

    return (
      <div
        key={project.id}
        className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={() => setSelectedProject(project)}
      >
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ background: (TYPE_COLORS[project.type] ?? 'var(--muted)') + '20', color: TYPE_COLORS[project.type] ?? 'var(--muted)' }}
          >
            {project.type}
          </span>
          {project.due_date && (
            <span className="text-[10px]" style={{ color: isOverdue ? '#c07a6a' : 'var(--muted)' }}>
              {isOverdue ? '⚠ ' : ''}
              {new Date(project.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ml-auto"
            style={{ background: project.status === 'active' ? '#7a947820' : project.status === 'completed' ? '#5a8fbe20' : '#9e9e9e20',
                     color: project.status === 'active' ? '#7a9478' : project.status === 'completed' ? '#5a8fbe' : '#9e9e9e' }}
          >
            {project.status}
          </span>
        </div>

        <h3 className="text-sm font-semibold leading-tight mb-2" style={{ color: 'var(--foreground)' }}>{project.title}</h3>

        {(focusArea || goal) && (
          <div className="mb-3 space-y-0.5">
            {focusArea && <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}><span className="opacity-60">Focus: </span>{focusArea.title}</p>}
            {goal && <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}><span className="opacity-60">Goal: </span>{goal.title}</p>}
          </div>
        )}

        {count && count.total > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{count.done}/{count.total} tasks done</span>
              <span className="text-[10px] font-medium" style={{ color: 'var(--foreground)' }}>{progress}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: progress === 100 ? '#7a9478' : 'var(--foreground)' }} />
            </div>
          </div>
        ) : (
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>No tasks yet</p>
        )}
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Everything planned, organised by month"
        action={
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancel' : '+ New project'}
          </Button>
        }
      />

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>New project</p>
          <div className="space-y-3">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Project title"
              className={inputClass}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              onKeyDown={e => { if (e.key === 'Enter') createProject() }}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <select value={newType} onChange={e => setNewType(e.target.value as Project['type'])} className={inputClass} style={inputStyle}>
                <option value="general">General</option>
                <option value="client">Client</option>
                <option value="content">Content</option>
              </select>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, borderColor: !newDueDate && newType !== 'content' ? '#c07a6a60' : 'var(--border)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = !newDueDate && newType !== 'content' ? '#c07a6a60' : 'var(--border)')}
                title={newType !== 'content' ? 'Required' : 'Optional'}
              />
              {focusAreas.length > 0 && (
                <select value={newFocusAreaId} onChange={e => setNewFocusAreaId(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Focus area…</option>
                  {focusAreas.map(fa => <option key={fa.id} value={fa.id}>{fa.title}</option>)}
                </select>
              )}
              {goals.length > 0 && (
                <select value={newGoalId} onChange={e => setNewGoalId(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Goal…</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center justify-between">
              {!newDueDate && newType !== 'content' && (
                <p className="text-xs" style={{ color: '#c07a6a' }}>Due date is required</p>
              )}
              <div className="ml-auto">
                <Button onClick={createProject} loading={creating} disabled={!newTitle.trim() || (newType !== 'content' && !newDueDate)}>
                  Create project
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="text-center py-16">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No projects yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Generate a content calendar or create your first project.</p>
          <Button size="sm" onClick={() => setShowCreate(true)}>+ New project</Button>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(group => (
            <div key={group.monthYear}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
                {monthLabel(group.monthYear)}{' '}
                <span className="font-normal normal-case">
                  ({group.calendarEntries.length + group.projects.length})
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.calendarEntries.map(entry => renderContentCard(entry))}
                {group.projects.map(project => renderProjectCard(project))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          focusAreas={focusAreas}
          goals={goals}
          onClose={() => setSelectedProject(null)}
          onUpdate={updated => {
            handleUpdate(updated)
            setSelectedProject(null)
          }}
          onDelete={id => {
            handleDelete(id)
            setSelectedProject(null)
          }}
        />
      )}
    </div>
  )
}
