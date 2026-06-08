'use client'

import { useState } from 'react'
import { Project, FocusArea, Goal } from '@/types'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import ProjectModal from '@/components/projects/ProjectModal'
import toast from 'react-hot-toast'

const TYPE_COLORS: Record<string, string> = {
  content: '#5a8fbe',
  client: '#7a9478',
  general: '#c4a06a',
}

const STATUS_COLORS: Record<Project['status'], string> = {
  active: '#7a9478',
  completed: '#5a8fbe',
  archived: '#9e9e9e',
}

interface Props {
  initialProjects: Project[]
  taskCounts: Record<string, { total: number; done: number }>
  focusAreas: Pick<FocusArea, 'id' | 'title'>[]
  goals: Pick<Goal, 'id' | 'title'>[]
}

export default function ProjectsClient({ initialProjects, taskCounts, focusAreas, goals }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [counts, setCounts] = useState(taskCounts)

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

  function handleUpdate(updated: Project) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handleDelete(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id))
    setCounts(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const activeProjects = projects.filter(p => p.status === 'active')
  const otherProjects = projects.filter(p => p.status !== 'active')

  const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
  const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

  function renderCard(project: Project) {
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
        {/* Top row: type badge + status */}
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

        {/* Title */}
        <h3 className="text-sm font-semibold leading-tight mb-2" style={{ color: 'var(--foreground)' }}>{project.title}</h3>

        {/* Due date */}
        {project.due_date && (
          <p className="text-[11px] mb-1.5" style={{ color: new Date(project.due_date + 'T00:00:00') < new Date() && project.status === 'active' ? '#c07a6a' : 'var(--muted)' }}>
            Due {new Date(project.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}

        {/* Focus area + goal */}
        {(focusArea || goal) && (
          <div className="mb-3 space-y-0.5">
            {focusArea && (
              <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                <span className="opacity-60">Focus: </span>{focusArea.title}
              </p>
            )}
            {goal && (
              <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                <span className="opacity-60">Goal: </span>{goal.title}
              </p>
            )}
          </div>
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

  return (
    <div>
      <PageHeader
        title="Projects"
        description="All your content, client, and general projects in one place"
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

      {projects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No projects yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Create your first project to start organising tasks.</p>
          <Button size="sm" onClick={() => setShowCreate(true)}>+ New project</Button>
        </div>
      ) : (
        <div className="space-y-8">
          {activeProjects.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
                Active <span className="font-normal normal-case">({activeProjects.length})</span>
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {activeProjects.map(renderCard)}
              </div>
            </section>
          )}

          {otherProjects.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
                Completed / Archived <span className="font-normal normal-case">({otherProjects.length})</span>
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {otherProjects.map(renderCard)}
              </div>
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
