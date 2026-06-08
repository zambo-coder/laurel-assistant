'use client'

import { useState, useEffect } from 'react'
import { Project, Task, FocusArea, Goal } from '@/types'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

const TYPE_COLORS: Record<string, string> = {
  content: '#5a8fbe',
  client: '#7a9478',
  general: '#c4a06a',
}

const TASK_STATUS_ICON: Record<string, string> = { todo: '○', in_progress: '◐', done: '✓' }
const TASK_STATUS_COLOR: Record<string, string> = { todo: '#9e9e9e', in_progress: '#c4a06a', done: '#7a9478' }

interface ProposedTask {
  title: string
  category: string
  priority: string
  batch_group: string
  selected: boolean
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
  const [form, setForm] = useState({ ...project })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [linkedTasks, setLinkedTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [generatingTasks, setGeneratingTasks] = useState(false)
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[]>([])
  const [addingTasks, setAddingTasks] = useState(false)

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

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          status: form.status,
          due_date: form.due_date ?? null,
          focus_area_id: form.focus_area_id ?? null,
          goal_id: form.goal_id ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      onUpdate(form)
      toast.success('Project saved')
      onClose()
    } catch {
      toast.error('Could not save project')
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

  async function generateTasks() {
    setGeneratingTasks(true)
    setProposedTasks([])
    try {
      const res = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_idea: project.title, theme: project.title, format: 'general' }),
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
            source: 'manual',
            project_id: project.id,
            focus_area_id: project.focus_area_id ?? null,
            goal_id: project.goal_id ?? null,
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

  const doneCount = linkedTasks.filter(t => t.status === 'done').length

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
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
              style={{ background: (TYPE_COLORS[project.type] ?? 'var(--muted)') + '20', color: TYPE_COLORS[project.type] ?? 'var(--muted)' }}
            >
              {project.type}
            </span>
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>Project</p>
          </div>
          <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity" style={{ color: 'var(--muted)' }}>×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
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

          {/* Tasks section */}
          <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3 pt-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Tasks
                  {!tasksLoading && linkedTasks.length > 0 && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                      {doneCount}/{linkedTasks.length} done
                    </span>
                  )}
                </p>
              </div>
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
                {linkedTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                    <span className="text-xs shrink-0" style={{ color: TASK_STATUS_COLOR[t.status] }}>{TASK_STATUS_ICON[t.status]}</span>
                    <span className={`text-xs flex-1 truncate${t.status === 'done' ? ' line-through opacity-50' : ''}`} style={{ color: 'var(--foreground)' }}>{t.title}</span>
                    {t.due_date && <span className="text-[10px] shrink-0" style={{ color: 'var(--muted)' }}>{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>No tasks yet.</p>
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
