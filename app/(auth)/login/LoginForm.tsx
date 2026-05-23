'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm px-8">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#fdf8f0', border: '1.5px solid #e8dfd0' }}>
            <span className="text-2xl">✦</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Studio Co-pilot
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>
            Your personal business assistant
          </p>
        </div>

        {urlError === 'unauthorized' && (
          <div className="mb-5 p-3.5 rounded-lg text-sm text-center"
            style={{ background: '#fdf0f0', border: '1px solid #f5c6c6', color: '#8b3030' }}>
            This account is not authorized to access this app.
          </div>
        )}

        {urlError === 'auth_failed' && (
          <div className="mb-5 p-3.5 rounded-lg text-sm text-center"
            style={{ background: '#fdf0f0', border: '1px solid #f5c6c6', color: '#8b3030' }}>
            Authentication failed. Please try again.
          </div>
        )}

        {sent ? (
          <div className="text-center">
            <div className="text-3xl mb-4">✉️</div>
            <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Check your email
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              We sent a magic link to <strong>{email}</strong>.<br />
              Click the link to sign in.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-6 text-sm underline underline-offset-2"
              style={{ color: 'var(--muted)' }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: '#ffffff',
                  border: '1.5px solid var(--border)',
                  color: 'var(--foreground)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#8b3030' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--foreground)', color: '#faf8f4' }}
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
