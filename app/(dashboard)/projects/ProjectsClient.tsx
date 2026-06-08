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
const STATUS_COLORS: Record<Project['status'], string> = {
  active: '#7a9478', completed: '#5a8fbe', archived: '#9e9e9e',
}

interface CalendarEntry {
  month_year: string
  day: CalendarDay
  project?: Project
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
  const [creatingUntrackedFor, setCreatingUntrackedFor] = useState<string | null>(null) // key = `${month_year}:${day}`

  // Create form state
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<Project['type']>('general')
  const [newFocusAreaId, setNewFocusAreaId] = useState('')
  const [newGoalId, setNewGoalId] = useState('')
  const [creating, setCreating] = useState(false)

  async function createProject() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
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

  async function addTasksForUntracked(entry: CalendarEntry) {
    const key = `${entry.month_year}:${entry.day.day}`
    setCreatingUntrackedFor(key)
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
      setCreatingUntrackedFor(null)
    }
  }

  function handleUpdate(updated: Project) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handleDelete(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id))
    setCounts(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  // ── Build content section entries ───────────────────────────────────────────

  // Flatten all calendar days from all fetched months
  const contentEntries: CalendarEntry[] = []
  const sortedCalendars = [...calendars].sort((a, b) => a.month_year.localeCompare(b.month_year))
  for (const cal of sortedCalendars) {
    const sortedDays = [...(cal.days ?? [])].sort((a, b) => a.day - b.day)
    for (const day of sortedDays) {
      const project = projects.find(p =>
        p.type === 'content' &&
        p.calendar_month_year === cal.month_year &&
        p.calendar_day === day.day
      )
      contentEntries.push({ month_year: cal.month_year, day, project })
    }
  }

  // Content projects with no matching calendar entry (fallback — show in Projects section)
  const unmatchedContentProjects = projects.filter(p =>
    p.type === 'content' &&
    (!p.calendar_month_year || !contentEntries.some(e => e.project?.id === p.id))
  )

  // Non-content projects
  const otherProjects = projects.filter(p => p.type !== 'content')

  // Group content entries by month
  const contentByMonth = new Map<string, CalendarEntry[]>()
  for (const entry of contentEntries) {
    if (!contentByMonth.has(entry.month_year)) contentByMonth.set(entry.month_year, [])
    contentByMonth.get(entry.month_year)!.push(entry)
  }

  const hasContent = contentEntries.length > 0 || unmatchedContentProjects.length > 0
  const hasProjects = otherProjects.length > 0

  // ── Card renderers ───────────────────────────────────────────────────────────

  function formatShortDate(monthYear: string, day: number) {
    const [yr, mo] = monthYear.split('-')
    return new Date(Number(yr), Number(mo) - 1, day)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function renderTrackedContentCard(entry: CalendarEntry) {
    const { project, day, month_year } = entry
    if (!project) return null
    const count = counts[project.id]
    const progress = count && count.total > 0 ? Math.round((count.done / count.total) * 100) : null

    return (
      <div
        key={project.id}
        className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={() => setSelectedProject(project)}
      >
        {/* Format + date + status row */}
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

        {/* Theme */}
        <h3 className="text-sm font-semibold leading-tight mb-1.5" style={{ color: 'var(--foreground)' }}>{day.theme}</h3>

        {/* Post idea */}
        {day.post_idea && (
          <p className="text-[11px] leading-snug mb-3 line-clamp-2" style={{ color: 'var(--muted)' }}>{day.post_idea}</p>
        )}

        {/* Task progress */}
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
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>No tasks yet</p>
        )}
      </div>
    )
  }

  function renderUntrackedContentCard(entry: CalendarEntry) {
    const { day, month_year } = entry
    const key = `${month_year}:${day.day}`
    const isCreating = creatingUntrackedFor === key

    return (
      <div
        key={key}
        className="rounded-xl p-4"
        style={{ background: 'var(--surface)', border: '1px dashed var(--border)', opacity: 0.75 }}
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
        </div>

        <h3 className="text-sm font-semibold leading-tight mb-1.5" style={{ color: 'var(--foreground)' }}>{day.theme}</h3>

        {day.post_idea && (
          <p className="text-[11px] leading-snug mb-3 line-clamp-2" style={{ color: 'var(--muted)' }}>{day.post_idea}</p>
        )}

        <button
          onClick={() => addTasksForUntracked(entry)}
          disabled={isCreating}
          className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}
        >
          {isCreating ? 'Creating…' : 'Add tasks →'}
        </button>
      </div>
    )
  }

  function renderProjectCard(project: Project) {
    const count = counts[project.id]
    const focusArea = focusAreas.find(f => f.id === project.focus_area_id)
    const goal = goals.find(g => g.id === project.goal_id)
    const progress = count && count.total > 0 ? Math.round((count.done / count.total) * 100) : null

    return (
      <div
        key={project.id}
        className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={() => setSelectedProject(project)}
      >
        {/* Type + status row */}
        <div className="flex items-center justify-between mb-2.5">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ background: (TYPE_COLORS[project.type] ?? 'var(--muted)') + '20', color: TYPE_COLORS[project.type] ?? 'var(--muted)' }}
          >
            {project.type}
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ background: STATUS_COLORS[project.status] + '20', color: STATUS_COLORS[project.status] }}
          >
            {project.status}
          </span>
        </div>

        <h3 className="text-sm font-semibold leading-tight mb-2" style={{ color: 'var(--foreground)' }}>{project.title}</h3>

        {project.due_date && (
          <p className="text-[11px] mb-1.5" style={{ color: new Date(project.due_date + 'T00:00:00') < new Date() && project.status === 'active' ? '#c07a6a' : 'var(--muted)' }}>
            Due {new Date(project.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}

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
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress === 100 ? '#7a9478' : 'var(--foreground)' }} />
            </div>
          </div>
        ) : (
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>No tasks yet</p>
        )}
      </div>
    )
  }

  function monthLabel(monthYear: string) {
    const [yr, mo] = monthYear.split('-')
    return new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Content posts and work projects in one place"
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
            <div className="grid grid-cols-3 gap-3">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as Project['type'])}
                className={inputClass}
                style={inputStyle}
              >
                <option value="general">General</option>
                <option value="content">Content</option>
                <option value="client">Client</option>
              </select>
              {focusAreas.length > 0 && (
                <select
                  value={newFocusAreaId}
                  onChange={e => setNewFocusAreaId(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Focus area…</option>
                  {focusAreas.map(fa => <option key={fa.id} value={fa.id}>{fa.title}</option>)}
                </select>
              )}
              {goals.length > 0 && (
                <select
                  value={newGoalId}
                  onChange={e => setNewGoalId(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Goal…</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={createProject} loading={creating} disabled={!newTitle.trim()}>
                Create project
              </Button>
            </div>
          </div>
        </div>
      )}

      {!hasContent && !hasProjects ? (
        <div className="text-center py-16">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No content or projects yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Generate a content calendar or create your first project.</p>
          <Button size="sm" onClick={() => setShowCreate(true)}>+ New project</Button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ── Content section ── */}
          {hasContent && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
                Content <span className="font-normal normal-case">({contentEntries.length} post{contentEntries.length !== 1 ? 's' : ''}{unmatchedContentProjects.length > 0 ? ` + ${unmatchedContentProjects.length} unlinked` : ''})</span>
              </p>

              {/* Group by month */}
              {Array.from(contentByMonth.entries()).map(([monthYear, entries]) => (
                <div key={monthYear} className="mb-6">
                  <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>{monthLabel(monthYear)}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {entries.map(entry =>
                      entry.project
                        ? renderTrackedContentCard(entry)
                        : renderUntrackedContentCard(entry)
                    )}
                  </div>
                </div>
              ))}

              {/* Unmatched content projects fallback */}
              {unmatchedContentProjects.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>Unlinked content projects</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {unmatchedContentProjects.map(renderProjectCard)}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Projects section ── */}
          {hasProjects && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
                Projects <span className="font-normal normal-case">({otherProjects.filter(p => p.status === 'active').length} active)</span>
              </p>

              {otherProjects.filter(p => p.status === 'active').length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-6">
                  {otherProjects.filter(p => p.status === 'active').map(renderProjectCard)}
                </div>
              )}

              {otherProjects.filter(p => p.status !== 'active').length > 0 && (
                <>
                  <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>Completed / Archived</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {otherProjects.filter(p => p.status !== 'active').map(renderProjectCard)}
                  </div>
                </>
              )}
            </section>
          )}
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
