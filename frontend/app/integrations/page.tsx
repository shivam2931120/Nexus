'use client'

import AppShell from '../../components/AppShell'
import { CalendarDays, CheckCircle2, CircleHelp, MessageCircle, Plus, RefreshCw, Shield, Video, X } from '../../components/icons'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Provider = { configured: boolean; guidance: string }
type Diagnostics = { providers: Record<string, Provider>; missing: string[]; frontendOrigin: string }

const labels: Record<string, string> = {
  database: 'Workspace database', clerk: 'Clerk authentication', supabaseStorage: 'Supabase Storage', nexusAI: 'NexusAI',
  livekit: 'LiveKit meetings', googleCalendar: 'Google Calendar OAuth', googleCalendarConnected: 'Google Calendar account',
  smtp: 'Email delivery', razorpayWebhook: 'Razorpay webhooks',
}

export default function IntegrationsPage() {
  const { workspace } = useWorkspace(); const { orgId } = workspaceIds(workspace)
  const [google, setGoogle] = useState(false); const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const load = async () => {
    if (!orgId) return
    setLoading(true); setError('')
    try {
      const [status, health] = await Promise.all([
        api<{ connected: boolean }>(`/integrations/google/status?orgId=${orgId}`),
        api<Diagnostics>(`/orgs/${orgId}/integrations/health`),
      ])
      setGoogle(status.connected); setDiagnostics(health)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Integration diagnostics could not be loaded.') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [orgId])
  const connectGoogle = async () => { if (!orgId) return; try { const x = await api<{ url: string }>(`/integrations/google/start?orgId=${orgId}`); location.href = x.url } catch (reason) { setError(reason instanceof Error ? reason.message : 'Google Calendar could not be connected.') } }
  const state = (key: string) => diagnostics?.providers[key]?.configured
  const status = (key: string) => state(key) ? <span className="connected"><CheckCircle2 size={14}/> Ready</span> : <span className="muted">Needs setup</span>
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">WORKSPACE SETTINGS</div><h1>Integrations</h1><p className="muted">Connect the tools your team relies on and verify server-side readiness.</p></div><div className="actions"><button className="button" disabled={loading} onClick={() => void load()}><RefreshCw size={15}/> {loading ? 'Checking…' : 'Run diagnostics'}</button><button className="button" onClick={() => setMessage('Nexus only lists integrations that have a supported backend contract. Provider setup is managed with server environment variables.') }><Plus size={15}/> Browse integrations</button></div></div>{error && <div className="form-error"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15}/></button></div>}{message && <div className="form-success"><span>{message}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setMessage('')}><X size={15}/></button></div>}<div className="integration-grid"><article className="card integration-card"><div className="integration-icon"><CalendarDays size={22}/></div><div><h2>Google Calendar</h2><p className="muted">Two-way event synchronization for the current workspace.</p></div><div className="integration-card-end">{status('googleCalendarConnected')}<button className="button" onClick={() => void connectGoogle()}>{google ? <><CheckCircle2 size={15}/> Connected</> : 'Connect'}</button></div></article><article className="card integration-card"><div className="integration-icon"><Video size={22}/></div><div><h2>LiveKit</h2><p className="muted">Video rooms for scheduled Nexus meetings.</p></div><div className="integration-card-end">{status('livekit')}<a className="button" href="/meetings">Open meetings</a></div></article><article className="card integration-card"><div className="integration-icon"><Shield size={22}/></div><div><h2>Supabase Storage</h2><p className="muted">Private file storage, signed downloads, versions, and shared links.</p></div><div className="integration-card-end">{status('supabaseStorage')}<a className="button" href="/files">Open files</a></div></article><article className="card integration-card"><div className="integration-icon"><MessageCircle size={22}/></div><div><h2>NexusAI</h2><p className="muted">Permission-aware workspace answers using the configured server model.</p></div><div className="integration-card-end">{status('nexusAI')}<a className="button" href="/assistant">Open NexusAI</a></div></article></div><section className="card diagnostics-card"><div className="card-header"><div><h2>Provider readiness</h2><p className="muted">These checks report configuration presence only. Secret values are never shown.</p></div><CircleHelp size={18}/></div><div className="diagnostics-list">{Object.entries(diagnostics?.providers ?? {}).map(([key, item]) => <div className="task-row" key={key}><div className="task-copy"><strong>{labels[key] ?? key}</strong><small>{item.configured ? 'Configured' : item.guidance}</small></div><span className={item.configured ? 'connected' : 'muted'}>{item.configured ? 'Ready' : 'Not ready'}</span></div>)}</div>{diagnostics && diagnostics.missing.length > 0 && <p className="muted diagnostics-note">Some optional capabilities will remain unavailable until their provider is configured. Core workspace data remains available.</p>}</section></div></AppShell>
}
