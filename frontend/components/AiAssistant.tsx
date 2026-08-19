'use client'

import { FormEvent, useState } from 'react'
import { api } from '../lib/api'
import { Sparkles } from './icons'

type Props = { title?: string; context?: string; compact?: boolean }
type Answer = { configured: boolean; answer: string }

export default function AiAssistant({ title = 'NexusAI', context = '', compact = false }: Props) {
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim() || busy) return
    setBusy(true); setError('')
    try {
      const result = await api<Answer>('/ai/chat', { method: 'POST', body: JSON.stringify({ message: message.trim(), context }) })
      setAnswer(result.answer); setMessage('')
    } catch (err) { setError(err instanceof Error ? err.message : 'The assistant could not respond.') }
    finally { setBusy(false) }
  }

  return <section className={`card ai-assistant ${compact ? 'ai-assistant-compact' : ''}`}>
    <div className="card-header"><div><div className="eyebrow">NEXUSAI / WORKSPACE INTELLIGENCE</div><h2>{title}</h2></div><Sparkles size={18} /></div>
    <p className="muted">Ask about your workspace, summarize context, or turn discussion into next steps.</p>
    {answer && <div className="ai-answer" aria-live="polite"><strong>Assistant</strong><p>{answer}</p></div>}
    {error && <div className="form-error">{error}</div>}
    <form className="ai-form" onSubmit={submit}><input value={message} onChange={event => setMessage(event.target.value)} placeholder="Ask NexusAI…" aria-label="Ask NexusAI" /><button className="button primary" disabled={busy || !message.trim()}>{busy ? 'Thinking…' : 'Ask'}</button></form>
  </section>
}
