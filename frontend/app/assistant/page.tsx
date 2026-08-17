'use client'

import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import AiAssistant from '../../components/AiAssistant'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Dashboard = { tasks: Array<{ title: string; status: string }>; meetings: Array<{ title: string; scheduled_at?: string }>; documents: Array<{ title: string }>; messages: Array<{ content: string; sender_name: string }> }

export default function AssistantPage() {
  const { workspace } = useWorkspace(); const { orgId } = workspaceIds(workspace); const [context, setContext] = useState('')
  useEffect(() => { if (orgId) void api<Dashboard>(`/orgs/${orgId}/dashboard`).then(data => setContext(JSON.stringify(data))).catch(() => setContext('Workspace context is temporarily unavailable.')) }, [orgId])
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">WORKSPACE INTELLIGENCE</div><h1>AI Assistant</h1><p className="muted">A private Nemotron assistant grounded in your organization’s current workspace context.</p></div></div><div className="grid dashboard-grid"><AiAssistant context={context} /><section className="card"><div className="eyebrow">SAFE BY DEFAULT</div><h2>What it can help with</h2><p className="muted">Summarize documents, identify overdue work, draft meeting follow-ups, and answer questions about workspace activity.</p><p className="muted">The API key stays on the backend. If it is not configured, the assistant reports that state instead of pretending a response was generated.</p></section></div></div></AppShell>
}
