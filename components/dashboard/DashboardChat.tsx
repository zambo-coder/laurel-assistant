'use client'

import { useState, useRef, useEffect } from 'react'
import { BrandProfile } from '@/types'
import Button from '@/components/ui/Button'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--border)' }}>{children}</code>,
  h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2">{children}</h3>,
  h2: ({ children }) => <h2 className="font-semibold mb-1 mt-2">{children}</h2>,
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'What should I focus on this week?',
  'Give me a caption idea for a flat-lay photo',
  'How can I attract more inquiries?',
  'Draft an out-of-office reply',
]

export default function DashboardChat({ brand }: { brand: BrandProfile | null }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages([...newMessages, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages([...newMessages, { role: 'assistant', content: accumulated }])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages([...newMessages, { role: 'assistant', content: `⚠ ${message}` }])
    } finally {
      setStreaming(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col" style={{ height: '420px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="text-2xl mb-3">✦</div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              Hi{brand?.business_name ? `, ${brand.business_name.split(' ')[0]}` : ''}
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
              What can I help you with today?
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-2 rounded-lg text-left transition-all hover:opacity-80"
                  style={{ background: 'var(--cream-200)', color: 'var(--stone-600)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? { background: 'var(--foreground)', color: 'var(--background)' }
                    : { background: 'var(--cream-200)', color: 'var(--foreground)' }
                }
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
                {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content === '' && (
                  <span className="inline-flex gap-1">
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
                {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content !== '' && (
                  <span className="streaming-cursor" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me anything…"
            rows={1}
            className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              background: 'var(--background)',
              border: '1.5px solid var(--border)',
              color: 'var(--foreground)',
              maxHeight: '120px',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <Button size="sm" onClick={() => send()} disabled={!input.trim() || streaming}>
            ↑
          </Button>
        </div>
        <p className="text-[10px] mt-1.5 ml-1" style={{ color: 'var(--muted)' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
