'use client'

import AppShell from '../../components/AppShell'
import { Activity, BarChart3, CheckCircle2, MessageCircle, TrendingUp, Users } from '../../components/icons'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Summary = { members: number; messages: number; tasks: number; completedTasks: number; documents: number; files: number; meetings: number; events: number }
type Trends = { tasksByStatus: Array<{ status: string; value: number }>; messagesByDay: Array<{ day: string; value: number }>; eventsByDay: Array<{ day: string; value: number }>; storageByType: Array<{ type: string; bytes: number; files: number }> }

export default function AnalyticsPage() {
  const { workspace } = useWorkspace()
  const { orgId } = workspaceIds(workspace)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [trends, setTrends] = useState<Trends | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orgId) return
    setError('')
    void Promise.allSettled([
      api<Summary>(`/orgs/${orgId}/analytics/summary`),
      api<Trends>(`/orgs/${orgId}/analytics/trends`),
    ]).then(([totals, series]) => {
      if (totals.status === 'fulfilled') setSummary(totals.value)
      if (series.status === 'fulfilled') setTrends(series.value)
      const failed = [totals, series].find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : 'Some analytics could not be loaded.')
    })
  }, [orgId])

  const metrics = [
    { label: 'Active members', value: summary?.members ?? '—', Icon: Users },
    { label: 'Messages sent', value: summary?.messages ?? '—', Icon: MessageCircle },
    { label: 'Tasks completed', value: summary?.completedTasks ?? '—', Icon: CheckCircle2 },
    { label: 'Documents created', value: summary?.documents ?? '—', Icon: TrendingUp },
  ]

  const list = (title: string, items: Array<{ label: string; value: string }>) => <section className="card"><div className="card-header"><h2>{title}</h2></div>{items.length ? items.map(item => <div className="task-row" key={`${title}-${item.label}`}><div className="task-copy"><strong>{item.label}</strong><small>{item.value}</small></div></div>) : <div className="empty">No recent data.</div>}</section>
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">INSIGHTS</div><h1>Analytics</h1><p className="muted">Live organization totals and recent activity from persisted workspace data.</p></div><span className="badge">ALL TIME + 30 DAYS</span></div>{error && <div className="form-error">{error}</div>}<div className="metric-grid">{metrics.map(({ label, value, Icon }) => <div className="card metric-card" key={label}><Icon size={18} color="var(--brand)" /><span className="muted">{label}</span><strong>{value}</strong><small className="muted">Organization total</small></div>)}</div><div className="grid dashboard-grid" style={{ marginTop: 16 }}>{list('Tasks by status', trends?.tasksByStatus.map(item => ({ label: item.status, value: `${item.value} tasks` })) ?? [])}{list('Messages by day', trends?.messagesByDay.slice(-7).map(item => ({ label: new Date(item.day).toLocaleDateString(), value: `${item.value} messages` })) ?? [])}{list('Events by day', trends?.eventsByDay.slice(-7).map(item => ({ label: new Date(item.day).toLocaleDateString(), value: `${item.value} events` })) ?? [])}{list('Storage by type', trends?.storageByType.map(item => ({ label: item.type || 'Unknown', value: `${item.files} files · ${Math.round(Number(item.bytes) / 1024)} KB` })) ?? [])}</div><div className="grid dashboard-grid" style={{ marginTop: 16 }}><section className="card"><Activity size={28} /><h2>Workspace activity</h2><p className="muted">{summary ? `${summary.events} calendar events, ${summary.meetings} meetings, and ${summary.files} files recorded.` : 'Loading activity…'}</p></section><section className="card"><BarChart3 size={28} /><h2>Work health</h2><p className="muted">{summary ? `${summary.completedTasks} of ${summary.tasks} tasks are complete.` : 'Loading task health…'}</p></section></div></div></AppShell>
}
