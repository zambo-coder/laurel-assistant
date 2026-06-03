'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
}

export default function TagInput({ tags, onChange, suggestions = [], placeholder = 'Add tag…' }: Props) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = suggestions.filter(
    s => !tags.includes(s) && (input === '' || s.toLowerCase().includes(input.toLowerCase()))
  )

  function add(tag: string) {
    const t = tag.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }

  function remove(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      add(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      remove(tags[tags.length - 1])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 items-center px-2 py-1.5 rounded-lg min-h-[34px] cursor-text"
        style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'var(--border)', color: 'var(--foreground)' }}
          >
            {tag}
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); remove(tag) }}
              className="hover:opacity-60 leading-none text-sm"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="text-xs outline-none bg-transparent min-w-[60px] flex-1"
          style={{ color: 'var(--foreground)' }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg py-1 shadow-lg w-full max-h-36 overflow-y-auto"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {filtered.slice(0, 8).map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(s) }}
              className="w-full text-left px-3 py-1.5 text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--foreground)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
