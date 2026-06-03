'use client'

import { useState, useRef, useEffect, useMemo, ReactNode } from 'react'
import { Task, Project, FocusArea, Goal } from '@/types'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMode = 'list' | 'table'
type GroupBy = 'none' | 'project' | 'focus_area' | 'goal'
type SortCol = 'title' | 'due_date' | 'priority' | 'status' | 'category'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done'
type Category = { name: string; color: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: Category[] = [
  { name: 'general', color: '#9e9e9e' },
  { name: 'content', color: '#8b7ab0' },
  { name: 'admin', color: '#5a8fbe' },
  { name: 'design', color: '#c4a06a' },
  { name: 'customer', color: '#7a9478' },
]

const COLOR_PRESETS = [
  '#9e9e9e', '#8b7ab0', '#5a8fbe', '#7a9478',
  '#c4a06a', '#c07a6a', '#6ab0b0', '#b08a7a',
]

const TYPE_COLORS: Record<string, string> = { content: '#8b7ab0', client: '#5a8fbe', general: '#9e9e9e' }
const STATUS_LABELS: Record<string, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }
const STATUS_NEXT: Record<Task['status'], Task['status']> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
const PRIORITY_COLORS: Record<string, string> = { high: '#c07a6a', medium: '#c4a06a', low: '#7a9478' }
const PRIORITIES = ['low', 'medium', 'high'] as const
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, done: 2 }

const STATUS_PILL: Record<Task['status'], { bg: string; fg: string; icon: string }> = {
  todo:        { bg: 'var(--border)',   fg: 'var(--muted)',  icon: '○' },
  in_progress: { bg: '#c4a06a22',       fg: '#c4a06a',       icon: '◐' },
  done:        { bg: '#7a947822',       fg: '#7a9478',       icon: '✓' },
}

const TABLE_COLS: { key: string; label: string; alwaysOn: boolean; defaultOn: boolean }[] = [
  { key: 'status',     label: 'Status',     alwaysOn: true,  defaultOn: true  },
  { key: 'title',      label: 'Title',      alwaysOn: true,  defaultOn: true  },
  { key: 'due_date',   label: 'Due',        alwaysOn: false, defaultOn: true  },
  { key: 'priority',   label: 'Priority',   alwaysOn: false, defaultOn: true  },
  { key: 'category',   label: 'Category',   alwaysOn: false, defaultOn: true  },
  { key: 'project',    label: 'Project',    alwaysOn: false, defaultOn: true  },
  { key: 'focus_area', label: 'Focus area', alwaysOn: false, defaultOn: false },
  { key: 'batch',      label: 'Batch',      alwaysOn: false, defaultOn: false },
]

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

const TODAY = new Date().toISOString().split('T')[0]

interface NewTaskForm {
  title: string; description: string
  category: string; priority: Task['priority']
  due_date: string; batch_group: string
}
const DEFAULT_FORM: NewTaskForm = { title: '', description: '', category: 'general', priority: 'medium', due_date: '', batch_group: '' }

// ─── Topo sort helpers ────────────────────────────────────────────────────────

function topoSortGroup(group: Task[]): Task[] {
  const ids = new Set(group.map(t => t.id))
  const visited = new Set<string>()
  const result: Task[] = []
  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const task = group.find(t => t.id === id)!
    for (const dep of (task.depends_on ?? []).filter(d => ids.has(d))) visit(dep)
    result.push(task)
  }
  for (const t of group) visit(t.id)
  return result
}

function sortWithTopoSameDate(tasks: Task[]): Task[] {
  const groups = new Map<string, Task[]>()
  const undated: Task[] = []
  for (const t of tasks) {
    if (!t.due_date) { undated.push(t); continue }
    if (!groups.has(t.due_date)) groups.set(t.due_date, [])
    groups.get(t.due_date)!.push(t)
  }
  const dated: Task[] = []
  for (const [, g] of [...groups.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    dated.push(...topoSortGroup(g))
  }
  return [...undated, ...dated]
}

function sortTasksBy(tasks: Task[], col: SortCol, dir: SortDir): Task[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0
    if (col === 'due_date') {
      const da = a.due_date ?? '9999-99-99', db = b.due_date ?? '9999-99-99'
      cmp = da < db ? -1 : da > db ? 1 : 0
    } else if (col === 'priority') {
      cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    } else if (col === 'status') {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    } else if (col === 'title') {
      cmp = a.title.localeCompare(b.title)
    } else if (col === 'category') {
      cmp = (a.category ?? '').localeCompare(b.category ?? '')
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TasksClient({
  initialTasks, initialProjects, initialCategories, initialFocusAreas, initialGoals,
}: {
  initialTasks: Task[]
  initialProjects: Project[]
  initialCategories: Category[]
  initialFocusAreas: Pick<FocusArea, 'id' | 'title' | 'status' | 'goal_id'>[]
  initialGoals: Pick<Goal, 'id' | 'title' | 'timeframe' | 'status'>[]
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [focusAreas] = useState(initialFocusAreas)
  const [goals] = useState(initialGoals)
  const [categories, setCategories] = useState<Category[]>(
    initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES
  )

  // View state
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showTodayOnly, setShowTodayOnly] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(() => {
    try { return localStorage.getItem('tasks_hide_completed') === 'true' } catch { return false }
  })
  const [sortCol, setSortCol] = useState<SortCol>('due_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('tasks_visible_cols')
      if (saved) return new Set(JSON.parse(saved))
    } catch {}
    return new Set(TABLE_COLS.filter(c => c.defaultOn).map(c => c.key))
  })
  const [showColToggle, setShowColToggle] = useState(false)

  // Selection & UI state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState<NewTaskForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [editField, setEditField] = useState<{ id: string; field: string } | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (showAdd) titleRef.current?.focus() }, [showAdd])

  const selected = selectedId ? tasks.find(t => t.id === selectedId) ?? null : null
  const blockedBySelected = selected ? tasks.filter(t => t.depends_on?.includes(selected.id)) : []

  function catColor(name: string) {
    return categories.find(c => c.name === name)?.color ?? '#9e9e9e'
  }

  function toggleHideCompleted() {
    const next = !hideCompleted
    setHideCompleted(next)
    try { localStorage.setItem('tasks_hide_completed', String(next)) } catch {}
  }

  function toggleCol(key: string) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem('tasks_visible_cols', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  async function saveCategories(updated: Category[]) {
    setCategories(updated)
    await fetch('/api/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_categories: updated }),
    })
  }

  function addProject(p: Project) { setProjects(prev => [p, ...prev]) }

  async function cycleStatus(task: Task) {
    const next = STATUS_NEXT[task.status]
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    await patch(task.id, { status: next })
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    if (selectedId === id) setSelectedId(null)
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  async function deleteProject(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id))
    setTasks(prev => prev.map(t => t.project_id === id ? { ...t, project_id: undefined } : t))
    if (selectedProjectId === id) setSelectedProjectId(null)
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
  }

  async function patchProject(id: string, updates: Partial<Project>) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  async function patch(id: string, updates: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  async function addTask() {
    if (!newForm.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newForm,
          due_date: newForm.due_date || null,
          batch_group: newForm.batch_group || null,
          description: newForm.description || null,
        }),
      })
      if (!res.ok) throw new Error()
      const created: Task = await res.json()
      setTasks(prev => [created, ...prev])
      setNewForm(DEFAULT_FORM)
      setShowAdd(false)
    } catch { toast.error('Could not add task') }
    finally { setSaving(false) }
  }

  async function removeDependency(taskId: string, depId: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    await patch(taskId, { depends_on: (task.depends_on ?? []).filter(id => id !== depId) })
  }

  async function addDependency(taskId: string, depId: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.depends_on?.includes(depId)) return
    await patch(taskId, { depends_on: [...(task.depends_on ?? []), depId] })
  }

  // ─── Filtering ────────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = tasks
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter)
    } else if (hideCompleted) {
      result = result.filter(t => t.status !== 'done')
    }
    // Today filter
    if (showTodayOnly) {
      result = result.filter(t =>
        t.due_date === TODAY || (t.due_date && t.due_date < TODAY && t.status !== 'done')
      )
    }
    // Sort
    if (displayMode === 'table') {
      result = sortTasksBy(result, sortCol, sortDir)
    } else {
      result = sortWithTopoSameDate(result)
    }
    return result
  }, [tasks, statusFilter, hideCompleted, showTodayOnly, displayMode, sortCol, sortDir])

  // ─── Grouping ─────────────────────────────────────────────────────────────

  type GroupSection = { id: string; label: string; sublabel?: string; items: Task[] }

  function groupTasks(taskList: Task[]): GroupSection[] {
    if (groupBy === 'none') return [{ id: '__all', label: '', items: taskList }]

    if (groupBy === 'project') {
      const groups: GroupSection[] = projects
        .map(p => ({ id: p.id, label: p.title, sublabel: p.type, items: taskList.filter(t => t.project_id === p.id) }))
        .filter(g => g.items.length > 0)
      const unlinked = taskList.filter(t => !t.project_id)
      if (unlinked.length > 0) groups.push({ id: '__unlinked', label: 'No project', items: unlinked })
      return groups
    }

    if (groupBy === 'focus_area') {
      const groups: GroupSection[] = focusAreas
        .map(f => ({ id: f.id, label: f.title, items: taskList.filter(t => t.focus_area_id === f.id) }))
        .filter(g => g.items.length > 0)
      const unlinked = taskList.filter(t => !t.focus_area_id)
      if (unlinked.length > 0) groups.push({ id: '__unlinked', label: 'No focus area', items: unlinked })
      return groups
    }

    if (groupBy === 'goal') {
      const faMap = new Map(focusAreas.map(f => [f.id, f]))
      function resolveGoalId(t: Task): string | undefined {
        if (t.goal_id) return t.goal_id
        if (t.focus_area_id) return faMap.get(t.focus_area_id)?.goal_id ?? undefined
        return undefined
      }
      const groups: GroupSection[] = goals
        .map(g => ({ id: g.id, label: g.title, sublabel: g.timeframe, items: taskList.filter(t => resolveGoalId(t) === g.id) }))
        .filter(g => g.items.length > 0)
      const unlinked = taskList.filter(t => !resolveGoalId(t))
      if (unlinked.length > 0) groups.push({ id: '__unlinked', label: 'No goal', items: unlinked })
      return groups
    }

    return [{ id: '__all', label: '', items: taskList }]
  }

  // ─── List view helpers ────────────────────────────────────────────────────

  function sectionTasks(all: Task[]) {
    if (statusFilter === 'done') return { open: [], done: all.filter(t => t.status === 'done') }
    if (statusFilter !== 'all') return { open: all.filter(t => t.status === statusFilter), done: [] }
    return {
      open: all.filter(t => t.status !== 'done'),
      done: hideCompleted ? [] : all.filter(t => t.status === 'done'),
    }
  }

  function taskRowEl(task: Task, showProject: boolean) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        project={showProject ? projects.find(p => p.id === task.project_id) : undefined}
        catColor={catColor}
        isSelected={selectedId === task.id}
        onClick={() => { setSelectedId(selectedId === task.id ? null : task.id); setSelectedProjectId(null) }}
        onCycleStatus={() => cycleStatus(task)}
        onDelete={() => deleteTask(task.id)}
        editField={editField}
        setEditField={setEditField}
        onPatch={patch}
      />
    )
  }

  function renderTaskSection(all: Task[], showProject: boolean) {
    const { open, done } = sectionTasks(all)
    if (open.length === 0 && done.length === 0) return null
    return (
      <>
        {open.map(t => taskRowEl(t, showProject))}
        {done.length > 0 && (
          <>
            <div className="flex items-center gap-2 my-2 px-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Completed</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            {done.map(t => taskRowEl(t, showProject))}
          </>
        )}
      </>
    )
  }

  function renderList() {
    const groups = groupTasks(filteredTasks)
    const isEmpty = groups.every(g => g.items.length === 0)

    if (isEmpty) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {statusFilter === 'all' ? 'No tasks yet. Add one above.' : `No ${STATUS_LABELS[statusFilter].toLowerCase()} tasks.`}
          </p>
        </div>
      )
    }

    if (groupBy === 'none') {
      // Unplanned / Scheduled split
      const items = groups[0].items
      const unplanned = items.filter(t => !t.due_date)
      const planned = sortWithTopoSameDate(items.filter(t => !!t.due_date))
      const unplannedEl = renderTaskSection(unplanned, true)
      const plannedEl = renderTaskSection(planned, true)
      return (
        <div className="space-y-1">
          {unplannedEl && (
            <div>
              <SectionLabel label="Unplanned" count={unplanned.filter(t => statusFilter === 'all' || t.status === statusFilter).length} />
              {unplannedEl}
            </div>
          )}
          {plannedEl && (
            <div className={unplannedEl ? 'mt-4' : ''}>
              <SectionLabel label="Scheduled" count={planned.filter(t => statusFilter === 'all' || t.status === statusFilter).length} />
              {plannedEl}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-5">
        {groups.map(group => (
          <div key={group.id}>
            <div className="flex items-center gap-2 px-1 mb-1.5">
              {group.sublabel && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: (TYPE_COLORS[group.sublabel] ?? 'var(--border)') + '20', color: TYPE_COLORS[group.sublabel] ?? 'var(--muted)' }}>
                  {group.sublabel}
                </span>
              )}
              <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{group.label}</span>
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{group.items.length}</span>
              {group.id !== '__unlinked' && groupBy === 'project' && (
                <button
                  className="text-[10px] hover:opacity-60 transition-opacity"
                  style={{ color: 'var(--muted)' }}
                  onClick={() => { setSelectedProjectId(group.id); setSelectedId(null) }}
                  title="Edit project"
                >⋯</button>
              )}
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            {renderTaskSection(topoSortGroup(group.items), groupBy !== 'project')}
          </div>
        ))}
      </div>
    )
  }

  function renderTable() {
    const groups = groupTasks(filteredTasks)
    const isEmpty = groups.every(g => g.items.length === 0)
    const showProject = groupBy !== 'project'
    const showFocusArea = visibleCols.has('focus_area') && groupBy !== 'focus_area'

    if (isEmpty) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {statusFilter === 'all' ? 'No tasks yet. Add one above.' : `No ${STATUS_LABELS[statusFilter].toLowerCase()} tasks.`}
          </p>
        </div>
      )
    }

    const colCount = TABLE_COLS.filter(c => visibleCols.has(c.key)).length + 1 // +1 for delete

    return (
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {TABLE_COLS.filter(c => visibleCols.has(c.key)).map(col => {
                const isSorted = sortCol === col.key
                const sortable = ['title', 'due_date', 'priority', 'status', 'category'].includes(col.key)
                return (
                  <th
                    key={col.key}
                    className="text-left px-3 py-2.5 text-[10px] uppercase tracking-widest font-semibold select-none"
                    style={{ color: isSorted ? 'var(--foreground)' : 'var(--muted)', cursor: sortable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                    onClick={() => sortable && handleSort(col.key as SortCol)}
                  >
                    {col.label}
                    {isSorted && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                )
              })}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <>
                {group.label && (
                  <tr key={`hdr-${group.id}`} style={{ background: 'var(--cream-200)' }}>
                    <td colSpan={colCount} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {group.sublabel && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                            style={{ background: (TYPE_COLORS[group.sublabel] ?? 'var(--muted)') + '20', color: TYPE_COLORS[group.sublabel] ?? 'var(--muted)' }}>
                            {group.sublabel}
                          </span>
                        )}
                        <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{group.label}</span>
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{group.items.length} task{group.items.length !== 1 ? 's' : ''}</span>
                        {group.id !== '__unlinked' && groupBy === 'project' && (
                          <button className="text-[10px] hover:opacity-60" style={{ color: 'var(--muted)' }}
                            onClick={() => { setSelectedProjectId(group.id); setSelectedId(null) }}>
                            ⋯
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {group.items.map(task => (
                  <TaskTableRow
                    key={task.id}
                    task={task}
                    visibleCols={visibleCols}
                    showProject={showProject}
                    showFocusArea={showFocusArea}
                    project={projects.find(p => p.id === task.project_id)}
                    focusArea={focusAreas.find(f => f.id === task.focus_area_id)}
                    catColor={catColor}
                    isSelected={selectedId === task.id}
                    onSelect={() => { setSelectedId(selectedId === task.id ? null : task.id); setSelectedProjectId(null) }}
                    onCycleStatus={() => cycleStatus(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Tasks"
          description="Everything that needs to get done"
          action={<Button size="sm" onClick={() => setShowAdd(p => !p)}>{showAdd ? 'Cancel' : '+ Add task'}</Button>}
        />

        {/* Add task form */}
        {showAdd && (
          <div className="mb-6 rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <input
              ref={titleRef}
              value={newForm.title}
              onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              className={inputClass} style={inputStyle}
              placeholder="Task title…"
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <textarea
              value={newForm.description}
              onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className={`${inputClass} resize-none`} style={inputStyle}
              placeholder="Description (optional)"
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex gap-1 flex-wrap">
                {categories.map(c => (
                  <button key={c.name} onClick={() => setNewForm(f => ({ ...f, category: c.name }))}
                    className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                    style={{ background: newForm.category === c.name ? c.color : 'var(--border)', color: newForm.category === c.name ? '#fff' : 'var(--muted)' }}>
                    {c.name}
                  </button>
                ))}
                <button onClick={() => setShowCategoryModal(true)}
                  className="px-2 py-1 rounded-full text-xs transition-all hover:opacity-70"
                  style={{ color: 'var(--muted)' }} title="Edit categories">✎</button>
              </div>
              <div className="flex gap-1">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setNewForm(f => ({ ...f, priority: p }))}
                    className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                    style={{ background: newForm.priority === p ? PRIORITY_COLORS[p] : 'var(--border)', color: newForm.priority === p ? '#fff' : 'var(--muted)' }}>
                    {p}
                  </button>
                ))}
              </div>
              <input type="date" value={newForm.due_date} onChange={e => setNewForm(f => ({ ...f, due_date: e.target.value }))}
                className="px-3 py-1 rounded-lg text-xs outline-none"
                style={{ ...inputStyle, border: '1.5px solid var(--border)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={addTask} loading={saving}>Add task</Button>
            </div>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Display mode toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['table', 'list'] as DisplayMode[]).map(m => (
              <button key={m} onClick={() => setDisplayMode(m)}
                className="px-3 py-1.5 text-xs font-medium capitalize transition-all"
                style={{ background: displayMode === m ? 'var(--foreground)' : 'transparent', color: displayMode === m ? 'var(--background)' : 'var(--muted)' }}>
                {m === 'table' ? '⊟ Table' : '≡ List'}
              </button>
            ))}
          </div>

          {/* Group by */}
          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as GroupBy)}
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: groupBy !== 'none' ? 'var(--foreground)' : 'var(--surface)', color: groupBy !== 'none' ? 'var(--background)' : 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <option value="none">Group: none</option>
            <option value="project">Group: project</option>
            <option value="focus_area">Group: focus area</option>
            <option value="goal">Group: goal</option>
          </select>

          {/* Today filter */}
          <button
            onClick={() => setShowTodayOnly(t => !t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: showTodayOnly ? '#c4a06a' : 'var(--surface)', color: showTodayOnly ? '#fff' : 'var(--muted)', border: '1px solid var(--border)' }}
          >
            Today
          </button>

          {/* Hide completed */}
          <button onClick={toggleHideCompleted}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: hideCompleted ? 'var(--foreground)' : 'var(--surface)', color: hideCompleted ? 'var(--background)' : 'var(--muted)', border: '1px solid var(--border)' }}>
            {hideCompleted ? 'Show completed' : 'Hide completed'}
          </button>

          {/* Column toggle (table mode only) */}
          {displayMode === 'table' && (
            <div className="relative ml-auto">
              <button
                onClick={() => setShowColToggle(v => !v)}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                Columns ▾
              </button>
              {showColToggle && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl shadow-lg z-30 p-2 space-y-1 min-w-[140px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {TABLE_COLS.filter(c => !c.alwaysOn).map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:opacity-80">
                      <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)}
                        style={{ accentColor: 'var(--foreground)' }} />
                      <span className="text-xs" style={{ color: 'var(--foreground)' }}>{col.label}</span>
                    </label>
                  ))}
                  <button
                    onClick={() => setShowColToggle(false)}
                    className="w-full mt-1 pt-1 text-xs text-center"
                    style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}
                  >Done</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {(['all', 'todo', 'in_progress', 'done'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{ background: statusFilter === s ? 'var(--foreground)' : 'var(--border)', color: statusFilter === s ? 'var(--background)' : 'var(--muted)' }}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {displayMode === 'table' ? renderTable() : renderList()}
      </div>

      {/* Detail panel */}
      {(selected || selectedProjectId) && (
        <div className="w-80 shrink-0">
          {selected ? (
            <TaskDetail
              task={selected}
              allTasks={tasks}
              allProjects={projects}
              allFocusAreas={focusAreas}
              categories={categories}
              catColor={catColor}
              blockedBySelected={blockedBySelected}
              onPatch={patch}
              onClose={() => setSelectedId(null)}
              onDelete={deleteTask}
              onAddDep={addDependency}
              onRemoveDep={removeDependency}
              onAddProject={addProject}
              onEditCategories={() => setShowCategoryModal(true)}
            />
          ) : selectedProjectId ? (
            <ProjectDetail
              project={projects.find(p => p.id === selectedProjectId)!}
              allFocusAreas={focusAreas}
              taskCount={tasks.filter(t => t.project_id === selectedProjectId).length}
              onPatch={patchProject}
              onDelete={deleteProject}
              onClose={() => setSelectedProjectId(null)}
            />
          ) : null}
        </div>
      )}

      {/* Category modal */}
      {showCategoryModal && (
        <CategoryModal
          categories={categories}
          tasks={tasks}
          onSave={saveCategories}
          onClose={() => setShowCategoryModal(false)}
        />
      )}
    </div>
  )
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1.5">
      <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: color ?? 'var(--muted)' }}>{label}</span>
      <span className="text-[10px]" style={{ color: color ?? 'var(--muted)' }}>{count}</span>
      <div className="flex-1 h-px" style={{ background: color ? color + '30' : 'var(--border)' }} />
    </div>
  )
}

// ─── Task Row (list view) ──────────────────────────────────────────────────────

interface RowProps {
  task: Task
  project?: Project
  catColor: (name: string) => string
  isSelected: boolean
  onClick: () => void
  onCycleStatus: () => void
  onDelete: () => void
  editField: { id: string; field: string } | null
  setEditField: (v: { id: string; field: string } | null) => void
  onPatch: (id: string, updates: Partial<Task>) => void
}

function TaskRow({ task, project, catColor, isSelected, onClick, onCycleStatus, onDelete, editField, setEditField, onPatch }: RowProps) {
  const isEditingTitle = editField?.id === task.id && editField.field === 'title'
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [confirming, setConfirming] = useState(false)

  const pill = STATUS_PILL[task.status]
  const isOverdue = task.due_date && task.status !== 'done' && task.due_date < TODAY

  return (
    <div
      className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-all cursor-pointer group${isSelected ? ' ring-1' : ''}`}
      style={{ background: isSelected ? 'var(--cream-200)' : 'transparent', border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}` }}
      onClick={onClick}
    >
      {/* Status button — larger, labeled pill */}
      <button
        onClick={e => { e.stopPropagation(); onCycleStatus() }}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
        style={{ background: pill.bg, color: pill.fg, minWidth: '82px', justifyContent: 'center' }}
        title={`${STATUS_LABELS[task.status]} — click to advance`}
      >
        <span>{pill.icon}</span>
        <span>{STATUS_LABELS[task.status]}</span>
      </button>

      <div className="flex-1 min-w-0">
        {isEditingTitle ? (
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => { onPatch(task.id, { title: titleDraft }); setEditField(null) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onPatch(task.id, { title: titleDraft }); setEditField(null) } }}
            onClick={e => e.stopPropagation()}
            autoFocus
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        ) : (
          <p
            className={`text-sm leading-tight truncate${task.status === 'done' ? ' line-through opacity-50' : ''}`}
            style={{ color: 'var(--foreground)' }}
            onDoubleClick={e => { e.stopPropagation(); setEditField({ id: task.id, field: 'title' }); setTitleDraft(task.title) }}
            title="Double-click to edit"
          >
            {task.title}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {project && (
            <span className="text-[10px] font-medium truncate max-w-[120px]" style={{ color: TYPE_COLORS[project.type] ?? '#9e9e9e' }}>
              {project.title}
            </span>
          )}
          {task.category && task.category !== 'general' && (
            <span className="text-[10px] font-medium capitalize" style={{ color: catColor(task.category) }}>{task.category}</span>
          )}
          {task.due_date && (
            <span className="text-[10px]" style={{ color: isOverdue ? '#c07a6a' : 'var(--muted)' }}>
              {isOverdue ? '⚠ ' : ''}{new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {task.depends_on?.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>⛓ {task.depends_on.length}</span>
          )}
        </div>
      </div>

      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[task.priority] }} title={`Priority: ${task.priority}`} />
      {confirming ? (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: '#c07a6a', color: '#fff' }}>Delete</button>
          <button onClick={e => { e.stopPropagation(); setConfirming(false) }}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--border)', color: 'var(--muted)' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={e => { e.stopPropagation(); setConfirming(true) }}
          className="opacity-0 group-hover:opacity-100 text-sm hover:opacity-60 transition-opacity shrink-0"
          style={{ color: 'var(--muted)' }}>×</button>
      )}
    </div>
  )
}

// ─── Task Table Row ───────────────────────────────────────────────────────────

function TaskTableRow({ task, visibleCols, showProject, showFocusArea, project, focusArea, catColor, isSelected, onSelect, onCycleStatus, onDelete }: {
  task: Task
  visibleCols: Set<string>
  showProject: boolean
  showFocusArea: boolean
  project?: Project
  focusArea?: Pick<FocusArea, 'id' | 'title' | 'status' | 'goal_id'>
  catColor: (name: string) => string
  isSelected: boolean
  onSelect: () => void
  onCycleStatus: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const pill = STATUS_PILL[task.status]
  const isOverdue = task.due_date && task.status !== 'done' && task.due_date < TODAY

  const tdStyle = { padding: '9px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' as const }

  return (
    <tr
      onClick={onSelect}
      className="cursor-pointer group transition-colors"
      style={{ background: isSelected ? 'var(--cream-200)' : 'transparent' }}
    >
      {visibleCols.has('status') && (
        <td style={{ ...tdStyle, width: '110px' }} onClick={e => { e.stopPropagation(); onCycleStatus() }}>
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-full justify-center hover:opacity-80 transition-opacity"
            style={{ background: pill.bg, color: pill.fg }}
          >
            {pill.icon} {STATUS_LABELS[task.status]}
          </button>
        </td>
      )}
      {visibleCols.has('title') && (
        <td style={tdStyle}>
          <span className={`text-sm${task.status === 'done' ? ' line-through opacity-50' : ''}`} style={{ color: 'var(--foreground)' }}>
            {task.title}
          </span>
          {task.description && (
            <span className="text-[10px] ml-2 truncate" style={{ color: 'var(--muted)' }}>
              {task.description.slice(0, 60)}{task.description.length > 60 ? '…' : ''}
            </span>
          )}
        </td>
      )}
      {visibleCols.has('due_date') && (
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          {task.due_date ? (
            <span className="text-xs" style={{ color: isOverdue ? '#c07a6a' : 'var(--muted)' }}>
              {isOverdue ? '⚠ ' : ''}{new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          ) : <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>}
        </td>
      )}
      {visibleCols.has('priority') && (
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[task.priority] }} />
            <span className="text-xs capitalize" style={{ color: 'var(--muted)' }}>{task.priority}</span>
          </span>
        </td>
      )}
      {visibleCols.has('category') && (
        <td style={tdStyle}>
          <span className="text-xs capitalize" style={{ color: catColor(task.category) }}>{task.category}</span>
        </td>
      )}
      {visibleCols.has('project') && showProject && (
        <td style={tdStyle}>
          {project ? (
            <span className="text-xs truncate max-w-[120px] inline-block" style={{ color: TYPE_COLORS[project.type] ?? '#9e9e9e' }}>{project.title}</span>
          ) : <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>}
        </td>
      )}
      {visibleCols.has('focus_area') && showFocusArea && (
        <td style={tdStyle}>
          {focusArea ? (
            <span className="text-xs truncate max-w-[120px] inline-block" style={{ color: 'var(--muted)' }}>{focusArea.title}</span>
          ) : <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>}
        </td>
      )}
      {visibleCols.has('batch') && (
        <td style={tdStyle}>
          {task.batch_group ? (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{task.batch_group}</span>
          ) : <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>}
        </td>
      )}
      <td style={{ ...tdStyle, width: '40px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="text-[9px] px-1 py-0.5 rounded" style={{ background: '#c07a6a', color: '#fff' }}>Del</button>
            <button onClick={() => setConfirming(false)} className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--muted)' }}>×</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="opacity-0 group-hover:opacity-100 text-base hover:opacity-60 transition-opacity"
            style={{ color: 'var(--muted)' }}>×</button>
        )}
      </td>
    </tr>
  )
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

interface DetailProps {
  task: Task
  allTasks: Task[]
  allProjects: Project[]
  allFocusAreas: Pick<FocusArea, 'id' | 'title' | 'status'>[]
  categories: { name: string; color: string }[]
  catColor: (name: string) => string
  blockedBySelected: Task[]
  onPatch: (id: string, updates: Partial<Task>) => void
  onClose: () => void
  onDelete: (id: string) => void
  onAddDep: (taskId: string, depId: string) => void
  onRemoveDep: (taskId: string, depId: string) => void
  onAddProject: (p: Project) => void
  onEditCategories: () => void
}

function TaskDetail({ task, allTasks, allProjects, allFocusAreas, categories, catColor, blockedBySelected, onPatch, onClose, onDelete, onAddDep, onRemoveDep, onAddProject, onEditCategories }: DetailProps) {
  const [addDepSearch, setAddDepSearch] = useState('')
  const [addBlocksSearch, setAddBlocksSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const blockedBy = (task.depends_on ?? []).map(id => allTasks.find(t => t.id === id)).filter(Boolean) as Task[]
  const currentProject = allProjects.find(p => p.id === task.project_id)

  const depCandidates = allTasks.filter(t =>
    t.id !== task.id && !(task.depends_on ?? []).includes(t.id) &&
    (addDepSearch === '' || t.title.toLowerCase().includes(addDepSearch.toLowerCase()))
  ).slice(0, 6)

  const blocksCandidates = allTasks.filter(t =>
    t.id !== task.id && !blockedBySelected.some(b => b.id === t.id) &&
    !(task.depends_on ?? []).includes(t.id) &&
    (addBlocksSearch === '' || t.title.toLowerCase().includes(addBlocksSearch.toLowerCase()))
  ).slice(0, 6)

  return (
    <div className="sticky top-4 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{task.title}</p>
        <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity shrink-0 ml-2" style={{ color: 'var(--muted)' }}>×</button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        <FieldRow label="Status">
          <div className="flex gap-1 flex-wrap">
            {(['todo', 'in_progress', 'done'] as Task['status'][]).map(s => (
              <button key={s} onClick={() => onPatch(task.id, { status: s })}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{ background: task.status === s ? 'var(--foreground)' : 'var(--border)', color: task.status === s ? 'var(--background)' : 'var(--muted)' }}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Priority">
          <div className="flex gap-1">
            {PRIORITIES.map(p => (
              <button key={p} onClick={() => onPatch(task.id, { priority: p })}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                style={{ background: task.priority === p ? PRIORITY_COLORS[p] : 'var(--border)', color: task.priority === p ? '#fff' : 'var(--muted)' }}>
                {p}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label={
          <span className="flex items-center gap-1.5">
            Category
            <button onClick={onEditCategories} className="hover:opacity-60 transition-opacity" title="Edit categories" style={{ color: 'var(--muted)' }}>✎</button>
          </span>
        }>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c.name} onClick={() => onPatch(task.id, { category: c.name })}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                style={{ background: task.category === c.name ? c.color : 'var(--border)', color: task.category === c.name ? '#fff' : 'var(--muted)' }}>
                {c.name}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Due date">
          <input type="date" value={task.due_date ?? ''} onChange={e => onPatch(task.id, { due_date: e.target.value || undefined })}
            className="px-3 py-1 rounded-lg text-xs outline-none"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
          />
        </FieldRow>

        <FieldRow label="Description">
          <textarea
            defaultValue={task.description ?? ''}
            onBlur={e => onPatch(task.id, { description: e.target.value || undefined })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none transition-all"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            placeholder="Add a description…"
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          />
        </FieldRow>

        <FieldRow label="Batch group">
          <input
            defaultValue={task.batch_group ?? ''}
            onBlur={e => { onPatch(task.id, { batch_group: e.target.value || undefined }); e.target.style.borderColor = 'var(--border)' }}
            className="px-3 py-1.5 rounded-lg text-xs outline-none w-full"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            placeholder="e.g. film, edit, publish"
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          />
        </FieldRow>

        <FieldRow label="Project">
          <ProjectField
            currentProject={currentProject}
            allProjects={allProjects}
            onSet={projectId => onPatch(task.id, { project_id: projectId ?? undefined })}
            onAdd={onAddProject}
          />
        </FieldRow>

        <FieldRow label="Focus area">
          <FocusAreaSelect
            value={task.focus_area_id ?? null}
            options={allFocusAreas}
            onChange={id => onPatch(task.id, { focus_area_id: id ?? undefined })}
          />
        </FieldRow>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Blocked by</p>
          {blockedBy.length > 0 ? (
            <div className="space-y-1 mb-2">
              {blockedBy.map(dep => (
                <div key={dep.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dep.status === 'done' ? '#7a9478' : '#c4a06a' }} />
                  <span className={`text-xs flex-1 truncate${dep.status === 'done' ? ' line-through opacity-50' : ''}`} style={{ color: 'var(--foreground)' }}>{dep.title}</span>
                  <button onClick={() => onRemoveDep(task.id, dep.id)} className="text-xs hover:opacity-60" style={{ color: 'var(--muted)' }}>×</button>
                </div>
              ))}
            </div>
          ) : <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>No blockers</p>}
          <DepSearch search={addDepSearch} onSearch={setAddDepSearch} candidates={depCandidates}
            onAdd={depId => { onAddDep(task.id, depId); setAddDepSearch('') }} placeholder="Add blocker…" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Blocks</p>
          {blockedBySelected.length > 0 ? (
            <div className="space-y-1 mb-2">
              {blockedBySelected.map(dep => (
                <div key={dep.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dep.status === 'done' ? '#7a9478' : '#c07a6a' }} />
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--foreground)' }}>{dep.title}</span>
                  <button onClick={() => onRemoveDep(dep.id, task.id)} className="text-xs hover:opacity-60" style={{ color: 'var(--muted)' }}>×</button>
                </div>
              ))}
            </div>
          ) : <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Doesn't block anything</p>}
          <DepSearch search={addBlocksSearch} onSearch={setAddBlocksSearch} candidates={blocksCandidates}
            onAdd={depId => { onAddDep(depId, task.id); setAddBlocksSearch('') }} placeholder="Add task this blocks…" />
        </div>

        <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          {confirmDelete ? (
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#c07a6a12', border: '1px solid #c07a6a30' }}>
              <p className="text-xs" style={{ color: '#c07a6a' }}>Delete this task? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--border)', color: 'var(--muted)' }}>Cancel</button>
                <button onClick={() => { onDelete(task.id); onClose() }}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: '#c07a6a', color: '#fff' }}>Delete</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full text-xs py-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: '#c07a6a18', color: '#c07a6a', border: '1px solid #c07a6a30' }}>
              Delete task
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Category Modal ────────────────────────────────────────────────────────────

function CategoryModal({ categories, tasks, onSave, onClose }: {
  categories: { name: string; color: string }[]
  tasks: Task[]
  onSave: (cats: { name: string; color: string }[]) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState([...categories])
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function tryDelete(name: string) {
    const inUse = tasks.filter(t => t.category === name).length
    if (inUse > 0) {
      setPendingDelete(name)
    } else {
      setDraft(prev => prev.filter(c => c.name !== name))
    }
  }

  function confirmDelete(name: string) {
    setDraft(prev => prev.filter(c => c.name !== name))
    setPendingDelete(null)
  }

  function addCategory() {
    const trimmed = newName.trim().toLowerCase()
    if (!trimmed) return
    if (draft.some(c => c.name === trimmed)) { toast.error('Category already exists'); return }
    setDraft(prev => [...prev, { name: trimmed, color: newColor }])
    setNewName('')
    setNewColor(COLOR_PRESETS[0])
  }

  async function save() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Edit categories</h2>
          <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity" style={{ color: 'var(--muted)' }}>×</button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {draft.map(cat => (
            <div key={cat.name}>
              <div className="flex items-center gap-3 py-1.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                <span className="text-sm flex-1 capitalize" style={{ color: 'var(--foreground)' }}>{cat.name}</span>
                {pendingDelete !== cat.name && (
                  <button onClick={() => tryDelete(cat.name)}
                    className="text-xs hover:opacity-60 transition-opacity px-2 py-0.5 rounded"
                    style={{ color: 'var(--muted)' }}>×</button>
                )}
              </div>
              {pendingDelete === cat.name && (
                <div className="ml-6 mb-2 rounded-lg px-3 py-2.5 text-xs space-y-2" style={{ background: '#c07a6a12', border: '1px solid #c07a6a30' }}>
                  <p style={{ color: '#c07a6a' }}>
                    {tasks.filter(t => t.category === cat.name).length} task{tasks.filter(t => t.category === cat.name).length !== 1 ? 's' : ''} use this category.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPendingDelete(null)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{ background: 'var(--border)', color: 'var(--muted)' }}>Cancel</button>
                    <button onClick={() => confirmDelete(cat.name)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{ background: '#c07a6a', color: '#fff' }}>Delete anyway</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>Add category</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
            placeholder="Category name…"
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_PRESETS.map(col => (
              <button key={col} onClick={() => setNewColor(col)}
                className="w-5 h-5 rounded-full transition-all"
                style={{ background: col, outline: newColor === col ? `2px solid ${col}` : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
          <button onClick={addCategory} disabled={!newName.trim()}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: newColor, color: '#fff' }}>
            + Add &ldquo;{newName.trim() || '…'}&rdquo;
          </button>
        </div>
        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="text-sm hover:opacity-70 transition-opacity px-4 py-2" style={{ color: 'var(--muted)' }}>Cancel</button>
          <Button size="sm" onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Project Field ─────────────────────────────────────────────────────────────

function ProjectField({ currentProject, allProjects, onSet, onAdd }: {
  currentProject?: Project
  allProjects: Project[]
  onSet: (id: string | null) => void
  onAdd: (p: Project) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<Project['type']>('general')
  const [creating, setCreating] = useState(false)

  const filtered = allProjects.filter(p =>
    search === '' || p.title.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8)

  async function createProject() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), type: newType }),
      })
      if (!res.ok) throw new Error()
      const p: Project = await res.json()
      onAdd(p)
      onSet(p.id)
      setShowNew(false)
      setNewTitle('')
      setOpen(false)
    } catch { toast.error('Could not create project') }
    finally { setCreating(false) }
  }

  if (showNew) {
    return (
      <div className="space-y-2">
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createProject()} autoFocus
          className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--background)', border: '1.5px solid var(--accent)', color: 'var(--foreground)' }}
          placeholder="Project name…" />
        <div className="flex gap-1">
          {(['content', 'client', 'general'] as Project['type'][]).map(t => (
            <button key={t} onClick={() => setNewType(t)}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize transition-all"
              style={{ background: newType === t ? TYPE_COLORS[t] : 'var(--border)', color: newType === t ? '#fff' : 'var(--muted)' }}>{t}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNew(false)} className="text-xs" style={{ color: 'var(--muted)' }}>Cancel</button>
          <button onClick={createProject} disabled={creating || !newTitle.trim()} className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2"
        style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}>
        {currentProject ? (
          <>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize shrink-0" style={{ background: TYPE_COLORS[currentProject.type] + '20', color: TYPE_COLORS[currentProject.type] }}>
              {currentProject.type}
            </span>
            <span className="flex-1 truncate">{currentProject.title}</span>
          </>
        ) : <span style={{ color: 'var(--muted)' }}>No project</span>}
        <span className="text-[9px]" style={{ color: 'var(--muted)' }}>▼</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-20 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="p-2">
            <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
              className="w-full px-2 py-1 rounded text-xs outline-none"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              placeholder="Search projects…" />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {currentProject && (
              <button onMouseDown={() => { onSet(null); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity"
                style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Remove project</button>
            )}
            {filtered.map(p => (
              <button key={p.id} onMouseDown={() => { onSet(p.id); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity flex items-center gap-2"
                style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize shrink-0" style={{ background: TYPE_COLORS[p.type] + '20', color: TYPE_COLORS[p.type] }}>{p.type}</span>
                <span className="truncate">{p.title}</span>
              </button>
            ))}
          </div>
          <button onMouseDown={() => { setShowNew(true); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-xs font-medium"
            style={{ color: 'var(--foreground)', borderTop: '1px solid var(--border)' }}>+ New project</button>
        </div>
      )}
    </div>
  )
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      {children}
    </div>
  )
}

// ─── Focus Area Select ─────────────────────────────────────────────────────────

function FocusAreaSelect({ value, options, onChange }: {
  value: string | null
  options: Pick<FocusArea, 'id' | 'title' | 'status'>[]
  onChange: (id: string | null) => void
}) {
  const current = options.find(f => f.id === value)
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}
      className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
      style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: current ? 'var(--foreground)' : 'var(--muted)' }}>
      <option value=''>No focus area</option>
      {options.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
    </select>
  )
}

// ─── Project Detail Panel ──────────────────────────────────────────────────────

function ProjectDetail({ project, allFocusAreas, taskCount, onPatch, onDelete, onClose }: {
  project: Project
  allFocusAreas: Pick<FocusArea, 'id' | 'title' | 'status'>[]
  taskCount: number
  onPatch: (id: string, updates: Partial<Project>) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [titleDraft, setTitleDraft] = useState(project.title)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="sticky top-4 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>Project</p>
        <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity shrink-0 ml-2" style={{ color: 'var(--muted)' }}>×</button>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        <FieldRow label="Title">
          <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => titleDraft.trim() && onPatch(project.id, { title: titleDraft.trim() })}
            onKeyDown={e => e.key === 'Enter' && titleDraft.trim() && onPatch(project.id, { title: titleDraft.trim() })}
            className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')} />
        </FieldRow>
        <FieldRow label="Type">
          <div className="flex gap-1">
            {(['content', 'client', 'general'] as Project['type'][]).map(t => (
              <button key={t} onClick={() => onPatch(project.id, { type: t })}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                style={{ background: project.type === t ? TYPE_COLORS[t] : 'var(--border)', color: project.type === t ? '#fff' : 'var(--muted)' }}>{t}</button>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Status">
          <div className="flex gap-1">
            {(['active', 'completed', 'archived'] as Project['status'][]).map(s => (
              <button key={s} onClick={() => onPatch(project.id, { status: s })}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                style={{ background: project.status === s ? 'var(--foreground)' : 'var(--border)', color: project.status === s ? 'var(--background)' : 'var(--muted)' }}>{s}</button>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Focus area">
          <FocusAreaSelect
            value={project.focus_area_id ?? null}
            options={allFocusAreas}
            onChange={id => onPatch(project.id, { focus_area_id: id ?? undefined })}
          />
        </FieldRow>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{taskCount} task{taskCount !== 1 ? 's' : ''} in this project</p>
        <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          {confirmDelete ? (
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#c07a6a12', border: '1px solid #c07a6a30' }}>
              <p className="text-xs" style={{ color: '#c07a6a' }}>Delete this project? Tasks will be unlinked but not deleted.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--border)', color: 'var(--muted)' }}>Cancel</button>
                <button onClick={() => { onDelete(project.id); onClose() }} className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: '#c07a6a', color: '#fff' }}>Delete</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full text-xs py-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: '#c07a6a18', color: '#c07a6a', border: '1px solid #c07a6a30' }}>
              Delete project
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Dep Search ────────────────────────────────────────────────────────────────

function DepSearch({ search, onSearch, candidates, onAdd, placeholder }: {
  search: string; onSearch: (v: string) => void
  candidates: Task[]; onAdd: (id: string) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <input value={search} onChange={e => { onSearch(e.target.value); setOpen(true) }}
        onFocus={e => { setOpen(true); e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; setTimeout(() => setOpen(false), 150) }}
        className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
        style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
        placeholder={placeholder} />
      {open && candidates.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {candidates.map(t => (
            <button key={t.id} onMouseDown={() => onAdd(t.id)}
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity flex items-center gap-2"
              style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[t.priority] }} />
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
