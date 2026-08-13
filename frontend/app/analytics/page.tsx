'use client'

import AppShell from '../../components/AppShell'
import { Activity, BarChart3, CheckCircle2, MessageCircle, TrendingUp, Users } from '../../components/icons'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Summary = { members: number; messages: number; tasks: number; completedTasks: number; documents: number; files: number; meetings: number; events: number }

export default function AnalyticsPage() {
  const { workspace } = useWorkspace()
  const { orgId } = workspaceIds(workspace)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (orgId) void api<Summary>(`/orgs/${orgId}/analytics/summary`).then(setSummary).catch(err => setError(err instanceof Error ? err.message : 'Analytics could not be loaded.'))
  }, [orgId])

  const metrics = [
    { label: 'Active members', value: summary?.members ?? '—', Icon: Users },
    { label: 'Messages sent', value: summary?.messages ?? '—', Icon: MessageCircle },
    { label: 'Tasks completed', value: summary?.completedTasks ?? '—', Icon: CheckCircle2 },
    { label: 'Documents created', value: summary?.documents ?? '—', Icon: TrendingUp },
  ]

  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">INSIGHTS</div><h1>Analytics</h1><p className="muted">Live organization totals from persisted workspace activity.</p></div><span className="badge">ALL TIME</span></div>{error && <div className="form-error">{error}</div>}<div className="metric-grid">{metrics.map(({ label, value, Icon }) => <div className="card metric-card" key={label}><Icon size={18} color="var(--brand)" /><span className="muted">{label}</span><strong>{value}</strong><small className="muted">Organization total</small></div>)}</div><div className="grid dashboard-grid" style={{ marginTop: 16 }}><section className="card"><Activity size={28} /><h2>Workspace activity</h2><p className="muted">{summary ? `${summary.events} calendar events, ${summary.meetings} meetings, and ${summary.files} files recorded.` : 'Loading activity…'}</p></section><section className="card"><BarChart3 size={28} /><h2>Work health</h2><p className="muted">{summary ? `${summary.completedTasks} of ${summary.tasks} tasks are complete.` : 'Loading task health…'}</p></section></div></div></AppShell>
}
