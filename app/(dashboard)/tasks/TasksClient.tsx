'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { Task, Project, FocusArea } from '@/types'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import toast from 'react-hot-toast'

type ViewMode = 'all' | 'today' | 'projects'
type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done'
type Category = { name: string; color: string }

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
const VIEW_LABELS: Record<ViewMode, string> = { all: 'All', today: 'Today', projects: 'Projects' }

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

const TODAY = new Date().toISOString().split('T')[0]

interface NewTaskForm {
  title: string; description: string
  category: string; priority: Task['priority']
  due_date: string; batch_group: string
}
const DEFAULT_FORM: NewTaskForm = { title: '', description: '', category: 'general', priority: 'medium', due_date: '', batch_group: '' }

// Topological sort within a same-date group so chained tasks appear in execution order
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

export default function TasksClient({ initialTasks, initialProjects, initialCategories, initialFocusAreas }: {
  initialTasks: Task[]
  initialProjects: Project[]
  initialCategories: Category[]
  initialFocusAreas: Pick<FocusArea, 'id' | 'title' | 'status'>[]
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [focusAreas] = useState(initialFocusAreas)
  const [categories, setCategories] = useState<Category[]>(
    initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES
  )
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [hideCompleted, setHideCompleted] = useState(() => {
    try { return localStorage.getItem('tasks_hide_completed') === 'true' } catch { return false }
  })
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

  // Split tasks into open + done, respecting current filters
  function sectionTasks(all: Task[]) {
    if (statusFilter === 'done') return { open: [], done: all.filter(t => t.status === 'done') }
    if (statusFilter !== 'all') return { open: all.filter(t => t.status === statusFilter), done: [] }
    return {
      open: all.filter(t => t.status !== 'done'),
      done: hideCompleted ? [] : all.filter(t => t.status === 'done'),
    }
  }

  function taskRow(task: Task, showProject: boolean) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        project={showProject ? projects.find(p => p.id === task.project_id) : undefined}
        catColor={catColor}
        isSelected={selectedId === task.id}
        onClick={() => setSelectedId(selectedId === task.id ? null : task.id)}
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
        {open.map(t => taskRow(t, showProject))}
        {done.length > 0 && (
          <>
            <div className="flex items-center gap-2 my-2 px-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Completed</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            {done.map(t => taskRow(t, showProject))}
          </>
        )}
      </>
    )
  }

  // ─── View renderers ────────────────────────────────────────────────────────

  function renderAllView() {
    const unplanned = tasks.filter(t => !t.due_date)
    const planned = sortWithTopoSameDate(tasks.filter(t => !!t.due_date))

    const unplannedContent = renderTaskSection(unplanned, true)
    const plannedContent = renderTaskSection(planned, true)

    if (!unplannedContent && !plannedContent) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {statusFilter === 'all' ? 'No tasks yet. Add one above.' : `No ${STATUS_LABELS[statusFilter].toLowerCase()} tasks.`}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {unplannedContent && (
          <div>
            <SectionLabel label="Unplanned" count={
              tasks.filter(t => !t.due_date && (statusFilter === 'all' || t.status === statusFilter)).length
            } />
            {unplannedContent}
          </div>
        )}
        {plannedContent && (
          <div className={unplannedContent ? 'mt-4' : ''}>
            <SectionLabel label="Scheduled" count={
              tasks.filter(t => !!t.due_date && (statusFilter === 'all' || t.status === statusFilter)).length
            } />
            {plannedContent}
          </div>
        )}
      </div>
    )
  }

  function renderTodayView() {
    const overdue = tasks.filter(t => t.due_date && t.due_date < TODAY && t.status !== 'done')
    const todayAll = topoSortGroup(tasks.filter(t => t.due_date === TODAY))

    const filtered = (arr: Task[]) => statusFilter === 'all' ? arr : arr.filter(t => t.status === statusFilter)
    const overdueFiltered = filtered(overdue)
    const todayFiltered = filtered(todayAll)

    if (overdueFiltered.length === 0 && todayFiltered.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Nothing due today.</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {overdueFiltered.length > 0 && (
          <div className="rounded-xl p-3" style={{ background: '#c07a6a0c', border: '1px solid #c07a6a30' }}>
            <SectionLabel label="Overdue" count={overdueFiltered.length} color="#c07a6a" />
            {overdueFiltered.map(t => taskRow(t, true))}
          </div>
        )}
        {todayFiltered.length > 0 && (
          <div>
            <SectionLabel label="Today" count={todayFiltered.length} />
            {renderTaskSection(todayAll, true)}
          </div>
        )}
      </div>
    )
  }

  function renderProjectsView() {
    const projectGroups = projects
      .map(p => ({ project: p, items: tasks.filter(t => t.project_id === p.id) }))
      .filter(g => g.items.length > 0)
    const unassigned = tasks.filter(t => !t.project_id)

    if (projectGroups.length === 0 && unassigned.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No tasks yet.</p>
        </div>
      )
    }

    return (
      <div className="space-y-5">
        {projectGroups.map(({ project, items }) => (
          <div key={project.id}>
            <button
              className="w-full flex items-center gap-2 px-1 mb-1.5 text-left hover:opacity-80 transition-opacity"
              onClick={() => {
                setSelectedProjectId(selectedProjectId === project.id ? null : project.id)
                setSelectedId(null)
              }}
            >
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                style={{ background: TYPE_COLORS[project.type] + '20', color: TYPE_COLORS[project.type] }}>
                {project.type}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{project.title}</span>
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{items.length} task{items.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>⋯</span>
            </button>
            {renderTaskSection(topoSortGroup(items), false)}
          </div>
        ))}
        {unassigned.length > 0 && (
          <div>
            <SectionLabel label="Unassigned" count={unassigned.length} />
            {renderTaskSection(unassigned, false)}
          </div>
        )}
      </div>
    )
  }

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
                    style={{
                      background: newForm.category === c.name ? c.color : 'var(--border)',
                      color: newForm.category === c.name ? '#fff' : 'var(--muted)',
                    }}>
                    {c.name}
                  </button>
                ))}
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-2 py-1 rounded-full text-xs transition-all hover:opacity-70"
                  style={{ color: 'var(--muted)' }}
                  title="Edit categories"
                >
                  ✎
                </button>
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

        {/* View mode tabs + hide-completed toggle */}
        <div className="flex items-center gap-1.5 mb-3">
          {(['all', 'today', 'projects'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{ background: viewMode === v ? 'var(--foreground)' : 'var(--border)', color: viewMode === v ? 'var(--background)' : 'var(--muted)' }}>
              {VIEW_LABELS[v]}
            </button>
          ))}
          <button
            onClick={toggleHideCompleted}
            className="ml-auto text-xs px-3 py-1.5 rounded-full transition-all"
            style={{ background: hideCompleted ? 'var(--foreground)' : 'var(--border)', color: hideCompleted ? 'var(--background)' : 'var(--muted)' }}
          >
            {hideCompleted ? 'Show completed' : 'Hide completed'}
          </button>
        </div>

        {/* Status filter — shown in All + Today views */}
        {viewMode !== 'projects' && (
          <div className="flex gap-1.5 mb-5">
            {(['all', 'todo', 'in_progress', 'done'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: statusFilter === s ? 'var(--foreground)' : 'var(--border)', color: statusFilter === s ? 'var(--background)' : 'var(--muted)' }}>
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}

        {viewMode === 'all' && renderAllView()}
        {viewMode === 'today' && renderTodayView()}
        {viewMode === 'projects' && renderProjectsView()}
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

// ─── Task Row ─────────────────────────────────────────────────────────────────

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

  const statusIcon = task.status === 'done' ? '✓' : task.status === 'in_progress' ? '◐' : '○'
  const statusColor = task.status === 'done' ? '#7a9478' : task.status === 'in_progress' ? '#c4a06a' : 'var(--muted)'
  const isOverdue = task.due_date && task.status !== 'done' && task.due_date < TODAY

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group${isSelected ? ' ring-1' : ''}`}
      style={{ background: isSelected ? 'var(--cream-200)' : 'transparent', border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}` }}
      onClick={onClick}
    >
      <button onClick={e => { e.stopPropagation(); onCycleStatus() }}
        className="text-base shrink-0 hover:opacity-70 transition-opacity w-5 text-center"
        style={{ color: statusColor }} title={`Status: ${STATUS_LABELS[task.status]} — click to advance`}>
        {statusIcon}
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
      <button onClick={e => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-sm hover:opacity-60 transition-opacity shrink-0"
        style={{ color: 'var(--muted)' }}>
        ×
      </button>
    </div>
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
          <button
            onClick={() => { onDelete(task.id); onClose() }}
            className="w-full text-xs py-2 rounded-lg transition-all hover:opacity-80"
            style={{ background: '#c07a6a18', color: '#c07a6a', border: '1px solid #c07a6a30' }}
          >
            Delete task
          </button>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
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
                  <button
                    onClick={() => tryDelete(cat.name)}
                    className="text-xs hover:opacity-60 transition-opacity px-2 py-0.5 rounded"
                    style={{ color: 'var(--muted)' }}
                  >
                    ×
                  </button>
                )}
              </div>
              {pendingDelete === cat.name && (
                <div className="ml-6 mb-2 rounded-lg px-3 py-2.5 text-xs space-y-2" style={{ background: '#c07a6a12', border: '1px solid #c07a6a30' }}>
                  <p style={{ color: '#c07a6a' }}>
                    {tasks.filter(t => t.category === cat.name).length} task{tasks.filter(t => t.category === cat.name).length !== 1 ? 's' : ''} use this category. They'll keep the label but you won't be able to assign new tasks to it.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPendingDelete(null)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                      Cancel
                    </button>
                    <button onClick={() => confirmDelete(cat.name)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{ background: '#c07a6a', color: '#fff' }}>
                      Delete anyway
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>Add category</p>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
            placeholder="Category name…"
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_PRESETS.map(col => (
              <button key={col} onClick={() => setNewColor(col)}
                className="w-5 h-5 rounded-full transition-all"
                style={{ background: col, outline: newColor === col ? `2px solid ${col}` : 'none', outlineOffset: '2px' }}
              />
            ))}
          </div>
          <button
            onClick={addCategory}
            disabled={!newName.trim()}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: newColor, color: '#fff' }}
          >
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
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createProject()}
          autoFocus
          className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--background)', border: '1.5px solid var(--accent)', color: 'var(--foreground)' }}
          placeholder="Project name…"
        />
        <div className="flex gap-1">
          {(['content', 'client', 'general'] as Project['type'][]).map(t => (
            <button key={t} onClick={() => setNewType(t)}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize transition-all"
              style={{ background: newType === t ? TYPE_COLORS[t] : 'var(--border)', color: newType === t ? '#fff' : 'var(--muted)' }}>
              {t}
            </button>
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
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2"
        style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
      >
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
              placeholder="Search projects…"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {currentProject && (
              <button onMouseDown={() => { onSet(null); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity"
                style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                Remove project
              </button>
            )}
            {filtered.map(p => (
              <button key={p.id} onMouseDown={() => { onSet(p.id); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity flex items-center gap-2"
                style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize shrink-0" style={{ background: TYPE_COLORS[p.type] + '20', color: TYPE_COLORS[p.type] }}>
                  {p.type}
                </span>
                <span className="truncate">{p.title}</span>
              </button>
            ))}
          </div>
          <button onMouseDown={() => { setShowNew(true); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-xs font-medium"
            style={{ color: 'var(--foreground)', borderTop: '1px solid var(--border)' }}>
            + New project
          </button>
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
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
      style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: current ? 'var(--foreground)' : 'var(--muted)' }}
    >
      <option value=''>No focus area</option>
      {options.map(f => (
        <option key={f.id} value={f.id}>{f.title}</option>
      ))}
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
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => titleDraft.trim() && onPatch(project.id, { title: titleDraft.trim() })}
            onKeyDown={e => e.key === 'Enter' && titleDraft.trim() && onPatch(project.id, { title: titleDraft.trim() })}
            className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          />
        </FieldRow>

        <FieldRow label="Type">
          <div className="flex gap-1">
            {(['content', 'client', 'general'] as Project['type'][]).map(t => (
              <button key={t} onClick={() => onPatch(project.id, { type: t })}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                style={{ background: project.type === t ? TYPE_COLORS[t] : 'var(--border)', color: project.type === t ? '#fff' : 'var(--muted)' }}>
                {t}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Status">
          <div className="flex gap-1">
            {(['active', 'completed', 'archived'] as Project['status'][]).map(s => (
              <button key={s} onClick={() => onPatch(project.id, { status: s })}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
                style={{ background: project.status === s ? 'var(--foreground)' : 'var(--border)', color: project.status === s ? 'var(--background)' : 'var(--muted)' }}>
                {s}
              </button>
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
              <p className="text-xs" style={{ color: '#c07a6a' }}>
                Delete this project? Tasks will be unlinked but not deleted.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                  Cancel
                </button>
                <button onClick={() => { onDelete(project.id); onClose() }}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: '#c07a6a', color: '#fff' }}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full text-xs py-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: '#c07a6a18', color: '#c07a6a', border: '1px solid #c07a6a30' }}
            >
              Delete project
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DepSearch({ search, onSearch, candidates, onAdd, placeholder }: {
  search: string; onSearch: (v: string) => void
  candidates: Task[]; onAdd: (id: string) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <input
        value={search}
        onChange={e => { onSearch(e.target.value); setOpen(true) }}
        onFocus={e => { setOpen(true); e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; setTimeout(() => setOpen(false), 150) }}
        className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
        style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
        placeholder={placeholder}
      />
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
