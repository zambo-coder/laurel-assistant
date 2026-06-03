'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import Button from '@/components/ui/Button'
import TagInput from '@/components/ui/TagInput'
import { Conversation } from '@/types'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
}

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--border)' }}>{children}</code>,
  h2: ({ children }) => <h2 className="font-semibold mb-1 mt-3">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2">{children}</h3>,
}

const STARTERS = [
  'What should I focus on this week?',
  'Give me a caption idea for a flat-lay photo',
  'How can I attract more inquiries?',
  'Draft an out-of-office reply for the holidays',
  'Suggest 3 reel ideas for this month',
  'Help me price a custom stationery suite',
]

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const activeConv = conversations.find(c => c.id === activeId) ?? null
  const allTags = [...new Set(conversations.flatMap(c => c.tags))]

  // Init: load conversations
  useEffect(() => {
    async function init() {
      setLoadingConvs(true)
      const res = await fetch('/api/conversations')
      const data = await res.json()
      const convs: Conversation[] = Array.isArray(data) ? data : []

      if (convs.length === 0) {
        const newRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New conversation' }),
        })
        const newConv = await newRes.json()
        setConversations([newConv])
        setActiveId(newConv.id)
      } else {
        setConversations(convs)
        setActiveId(convs[0].id)
      }
      setLoadingConvs(false)
    }
    init()
  }, [])

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeId) return
    setLoadingMsgs(true)
    setMessages([])
    fetch(`/api/chat?conversation_id=${activeId}`)
      .then(r => r.json())
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .finally(() => setLoadingMsgs(false))
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  async function createConversation() {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New conversation' }),
    })
    const conv = await res.json()
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
    setMessages([])
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    const remaining = conversations.filter(c => c.id !== id)
    setConversations(remaining)
    if (activeId === id) {
      if (remaining.length > 0) {
        setActiveId(remaining[0].id)
      } else {
        createConversation()
      }
    }
  }

  async function saveRename() {
    if (!activeId || !nameInput.trim()) { setEditingName(false); return }
    const name = nameInput.trim()
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, name } : c))
    setEditingName(false)
    await fetch(`/api/conversations/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  const updateTags = useCallback(async (tags: string[]) => {
    if (!activeId) return
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, tags } : c))
    await fetch(`/api/conversations/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
  }, [activeId])

  async function clearMessages() {
    if (!activeId || !confirm('Clear messages in this conversation?')) return
    await fetch(`/api/chat?conversation_id=${activeId}`, { method: 'DELETE' })
    setMessages([])
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming || !activeId) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const newHistory = [...history, { role: 'user' as const, content }]

    setMessages(prev => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    let accumulated = ''

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: accumulated }])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `⚠ ${message}` }])
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }

    // Save messages explicitly via PATCH (client-controlled, no async server-side magic)
    if (accumulated) {
      try {
        await fetch('/api/chat', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: activeId, user_content: content, assistant_content: accumulated }),
        })

        // Update local updated_at
        setConversations(prev => prev.map(c =>
          c.id === activeId ? { ...c, updated_at: new Date().toISOString() } : c
        ))

        // Auto-name on first message
        const isFirst = messages.length === 0
        const conv = conversations.find(c => c.id === activeId)
        if (isFirst && conv?.name === 'New conversation') {
          const autoName = content.length > 45 ? content.slice(0, 45).trim() + '…' : content.trim()
          setConversations(prev => prev.map(c => c.id === activeId ? { ...c, name: autoName } : c))
          await fetch(`/api/conversations/${activeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: autoName }),
          })
        }
      } catch { /* save failed silently */ }
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex gap-0" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Chat area ── */}
      <div className="flex flex-col flex-1 min-w-0 pr-6">

        {/* Header */}
        <div className="shrink-0 mb-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditingName(false) }}
                onBlur={saveRename}
                className="text-xl font-semibold outline-none bg-transparent w-full"
                style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--accent)' }}
              />
            ) : (
              <button
                onClick={() => { setEditingName(true); setNameInput(activeConv?.name ?? '') }}
                className="text-xl font-semibold text-left hover:opacity-70 transition-opacity truncate max-w-full"
                style={{ color: 'var(--foreground)' }}
                title="Click to rename"
              >
                {loadingConvs ? '…' : (activeConv?.name ?? 'AI Assistant')}
              </button>
            )}
            {activeConv && (
              <div className="mt-1.5 max-w-sm">
                <TagInput
                  tags={activeConv.tags}
                  onChange={updateTags}
                  suggestions={allTags}
                  placeholder="Add tags…"
                />
              </div>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs mt-1 hover:opacity-70 transition-opacity shrink-0"
              style={{ color: 'var(--muted)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto rounded-2xl mb-4 px-4 py-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {loadingConvs || loadingMsgs ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
            </div>
          ) : isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="text-3xl mb-4">✦</div>
              <p className="text-base font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                What can I help you with?
              </p>
              <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
                Ask me anything about your business — content, strategy, pricing, copy.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-80"
                    style={{ background: 'var(--cream-200)', color: 'var(--stone-600)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <div key={msg.id ?? i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mr-2 mt-0.5"
                      style={{ background: 'var(--foreground)', color: 'var(--background)' }}
                    >
                      ✦
                    </div>
                  )}
                  <div
                    className="max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                    style={
                      msg.role === 'user'
                        ? { background: 'var(--foreground)', color: 'var(--background)' }
                        : { background: 'var(--cream-200)', color: 'var(--foreground)' }
                    }
                  >
                    {msg.role === 'assistant' ? (
                      <>
                        <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                        {streaming && i === messages.length - 1 && msg.content === '' && (
                          <span className="inline-flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                        {streaming && i === messages.length - 1 && msg.content !== '' && (
                          <span className="streaming-cursor" />
                        )}
                      </>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0">
          <div
            className="flex items-end gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask me anything…"
              rows={1}
              className="flex-1 text-sm outline-none resize-none bg-transparent"
              style={{ color: 'var(--foreground)', maxHeight: '160px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
              }}
            />
            <Button size="sm" onClick={() => send()} disabled={!input.trim() || streaming}>↑</Button>
          </div>
          <p className="text-[10px] mt-1.5 ml-1" style={{ color: 'var(--muted)' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* ── Conversations sidebar ── */}
      <div
        className="w-56 shrink-0 flex flex-col"
        style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}
      >
        <button
          onClick={createConversation}
          className="w-full text-left text-xs px-3 py-2 rounded-lg mb-3 font-medium transition-all hover:opacity-80"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}
        >
          + New conversation
        </button>

        <div className="flex-1 overflow-y-auto space-y-1">
          {loadingConvs ? (
            <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>Loading…</p>
          ) : (
            conversations.map(conv => {
              const active = conv.id === activeId
              return (
                <div
                  key={conv.id}
                  className="group rounded-lg px-3 py-2.5 cursor-pointer transition-all"
                  style={{
                    background: active ? 'var(--sidebar-active)' : 'transparent',
                  }}
                  onClick={() => setActiveId(conv.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p
                      className="text-xs font-medium leading-snug line-clamp-2 flex-1"
                      style={{ color: active ? 'var(--foreground)' : 'var(--stone-500, #7c6e5e)' }}
                    >
                      {active && <span className="mr-1" style={{ color: 'var(--accent)' }}>●</span>}
                      {conv.name}
                    </p>
                    <button
                      onClick={e => { e.stopPropagation(); deleteConversation(conv.id) }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] shrink-0 hover:opacity-70 transition-opacity mt-0.5"
                      style={{ color: 'var(--muted)' }}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                  {conv.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {conv.tags.map(t => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded-full text-[9px]"
                          style={{ background: 'var(--border)', color: 'var(--muted)' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                    {relativeTime(conv.updated_at)}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
