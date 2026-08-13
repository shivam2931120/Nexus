'use client'

import AppShell from '../../components/AppShell'
import { useEffect, useState } from 'react'
import { Activity } from '../../components/icons'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Audit = { id: string; actor_id: string; action: string; entity_type: string; entity_id?: string; created_at: string }

export default function AuditPage() {
  const { workspace } = useWorkspace()
  const { orgId } = workspaceIds(workspace)
  const [events, setEvents] = useState<Audit[]>([])
  const [error, setError] = useState('')
  useEffect(() => { if (orgId) void api<Audit[]>(`/orgs/${orgId}/audit`).then(setEvents).catch(err => setError(err instanceof Error ? err.message : 'Audit log could not be loaded.')) }, [orgId])
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">GOVERNANCE</div><h1>Audit log</h1><p className="muted">Administrative activity recorded for this organization.</p></div><Activity size={22} /></div>{error && <div className="form-error">{error}</div>}<section className="card">{events.length === 0 ? <div className="empty"><Activity size={30} /><p>No audit events recorded yet.</p></div> : events.map(event => <div className="task-row" key={event.id}><Activity size={16} color="var(--brand)" /><div className="task-copy"><strong>{event.action}</strong><small>{event.entity_type}{event.entity_id ? ` · ${event.entity_id}` : ''}</small></div><time className="muted">{new Date(event.created_at).toLocaleString()}</time></div>)}</section></div></AppShell>
}
