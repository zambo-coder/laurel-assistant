interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}
