'use client'

import Link from 'next/link'
import { Task } from '@/types'

const PRIORITY_COLORS: Record<string, string> = { high: '#c07a6a', medium: '#c4a06a', low: '#7a9478' }
const STATUS_ICON: Record<string, string> = { todo: '○', in_progress: '◐', done: '✓' }

export default function TasksWidget({ tasks }: { tasks: Task[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done')
  const upcoming = tasks.filter(t => !overdue.includes(t)).slice(0, 5)
  const display = [...overdue, ...upcoming].slice(0, 5)

  return (
    <div>
      <div className="px-2 pt-2 pb-1 mb-3 flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Tasks</p>
        <Link href="/tasks" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted)' }}>View all →</Link>
      </div>
      {display.length > 0 ? (
        <ul className="space-y-2 px-2 pb-2">
          {display.map(t => {
            const isOverdue = t.due_date && t.due_date < today && t.status !== 'done'
            return (
              <li key={t.id} className="flex items-start gap-2">
                <span className="text-xs mt-0.5 shrink-0" style={{ color: t.status === 'done' ? '#7a9478' : t.status === 'in_progress' ? '#c4a06a' : 'var(--muted)' }}>
                  {STATUS_ICON[t.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-tight truncate${t.status === 'done' ? ' line-through opacity-50' : ''}`} style={{ color: 'var(--foreground)' }}>
                    {t.title}
                  </p>
                  {t.due_date && (
                    <p className="text-[10px]" style={{ color: isOverdue ? '#c07a6a' : 'var(--muted)' }}>
                      {isOverdue ? '⚠ ' : ''}{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: PRIORITY_COLORS[t.priority] }} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs px-2 pb-2" style={{ color: 'var(--muted)' }}>
          <Link href="/tasks" className="underline underline-offset-2">Add your first task →</Link>
        </p>
      )}
    </div>
  )
}
