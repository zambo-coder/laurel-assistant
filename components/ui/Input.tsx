import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export default function Input({ label, hint, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all ${className}`}
        style={{
          background: 'var(--background)',
          border: `1.5px solid ${error ? '#dc3545' : 'var(--border)'}`,
          color: 'var(--foreground)',
        }}
        onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--accent)' }}
        onBlur={(e) => { if (!error) e.target.style.borderColor = 'var(--border)' }}
        {...props}
      />
      {hint && !error && <p className="text-xs" style={{ color: 'var(--muted)' }}>{hint}</p>}
      {error && <p className="text-xs" style={{ color: '#8b3030' }}>{error}</p>}
    </div>
  )
}
