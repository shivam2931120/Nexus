'use client'

import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, FileText, FolderKanban, ListTodo, MessageCircle, Search, Shield, Sparkles, Users, Video } from '../components/icons'
import { api } from '../lib/api'
import { useWorkspace, workspaceIds } from '../lib/workspace'
import './home.css'

type DashboardData = {
  tasks: Array<{ id: string; title: string; status: string; due_date?: string }>
  meetings: Array<{ id: string; title: string; scheduled_at?: string }>
  documents: Array<{ id: string; title: string; updated_at: string }>
  messages: Array<{ id: string; content: string; sender_name: string; channel_name: string }>
}

const capabilities = [
  { title: 'Team communication', body: 'Channels, direct conversations, mentions, reactions, and searchable message history.', Icon: MessageCircle },
  { title: 'Projects and tasks', body: 'Plan initiatives, assign ownership, track priorities, and move work from idea to done.', Icon: ListTodo },
  { title: 'Documents and knowledge', body: 'Create living documents, preserve versions, and turn decisions into shared knowledge.', Icon: BookOpen },
  { title: 'Meetings and calendar', body: 'Schedule work, launch secure video rooms, and keep team events in one calendar.', Icon: Video },
  { title: 'Files and workspace data', body: 'Store organization files securely and keep every asset connected to the team that owns it.', Icon: FolderKanban },
  { title: 'NexusAI', body: 'Ask questions across workspace context, summarize information, and move from knowledge to action.', Icon: Sparkles },
]

function WorkspaceHome() {
  const { workspace } = useWorkspace()
  const { orgId } = workspaceIds(workspace)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (orgId) void api<DashboardData>(`/orgs/${orgId}/dashboard`).then(setData).catch(err => setError(err instanceof Error ? err.message : 'Dashboard could not be loaded.'))
  }, [orgId])

  return <AppShell><div className="page dashboard-page">
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / HOME</div><h1>Workspace dashboard</h1><p className="muted">A live view of work, meetings, documents, and team activity.</p></div><div className="actions"><Link className="button primary" href="/tasks?new=1">New task</Link><Link className="button" href="/documents?new=1">New document</Link><Link className="button" href="/meetings?new=1">Schedule meeting</Link></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="grid dashboard-grid">
      <section className="card"><div className="card-header"><h2>My work</h2><Link className="button" href="/tasks">View tasks</Link></div>{data?.tasks?.length ? data.tasks.map(task => <div className="task-row" key={task.id}><span className={`status-dot ${task.status === 'DONE' ? 'done' : 'progress'}`} /><div className="task-copy"><strong>{task.title}</strong><small>{task.status}{task.due_date ? ` · due ${new Date(task.due_date).toLocaleDateString()}` : ''}</small></div></div>) : <div className="empty"><p>{data ? 'No assigned tasks yet.' : 'Loading assigned work…'}</p><Link className="button primary" href="/tasks?new=1">Create task</Link></div>}</section>
      <section className="card"><div className="card-header"><h2>Upcoming meetings</h2><Link className="button" href="/calendar">Calendar</Link></div>{data?.meetings?.length ? data.meetings.map(meeting => <div className="task-row" key={meeting.id}><span className="status-dot progress" /><div className="task-copy"><strong>{meeting.title}</strong><small>{meeting.scheduled_at ? new Date(meeting.scheduled_at).toLocaleString() : 'Room ready'}</small></div><Link className="button" href={`/meetings/room?meetingId=${meeting.id}`}>Join</Link></div>) : <div className="empty"><p>{data ? 'No upcoming meetings.' : 'Loading meetings…'}</p><Link className="button primary" href="/meetings?new=1">Schedule one</Link></div>}</section>
      <section className="card"><div className="card-header"><h2>Recent documents</h2><Link className="button" href="/documents">Open docs</Link></div>{data?.documents?.length ? data.documents.map(document => <div className="task-row" key={document.id}><div className="task-copy"><strong>{document.title}</strong><small>Updated {new Date(document.updated_at).toLocaleDateString()}</small></div></div>) : <div className="empty"><p>{data ? 'No documents yet.' : 'Loading documents…'}</p><Link className="button" href="/documents?new=1">Create document</Link></div>}</section>
      <section className="card"><div className="card-header"><h2>Team activity</h2><Link className="button" href="/chat">Open chat</Link></div>{data?.messages?.length ? data.messages.slice(0, 5).map(message => <div className="task-row" key={message.id}><div className="task-copy"><strong>{message.sender_name} · #{message.channel_name}</strong><small>{message.content}</small></div></div>) : <div className="empty"><p>{data ? 'No recent messages.' : 'Loading activity…'}</p></div>}</section>
    </div>
  </div></AppShell>
}

function NexusHome() {
  return <main className="home-site">
    <header className="home-nav">
      <Link className="home-brand" href="/"><img src="/logo.jpg" alt="" /><span>Nexus</span></Link>
      <nav aria-label="Main navigation"><a href="#product">Product</a><a href="#workflows">Workflows</a><a href="#security">Security</a></nav>
      <div className="home-nav-actions"><Link className="home-link" href="/login">Sign in</Link><Link className="home-button" href="/login?signup=true">Create workspace <ChevronRight size={16} /></Link></div>
    </header>

    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="home-kicker"><span /> THE CONNECTED WORKSPACE</div>
        <h1>One place for your team to move work forward.</h1>
        <p>Nexus brings communication, projects, documents, files, meetings, calendars, knowledge, and AI into one secure workspace.</p>
        <div className="home-actions"><Link className="home-button" href="/login?signup=true">Create your workspace <ChevronRight size={16} /></Link><Link className="home-secondary" href="/login">Sign in to Nexus</Link></div>
        <div className="home-proof"><span><CheckCircle2 size={15} /> One account</span><span><CheckCircle2 size={15} /> One search</span><span><CheckCircle2 size={15} /> One workspace</span></div>
      </div>

      <div className="home-product-preview" aria-label="Nexus product overview">
        <div className="home-preview-bar"><span className="home-preview-brand"><img src="/logo.jpg" alt="" /> Nexus workspace</span><span className="home-live"><i /> CONNECTED</span></div>
        <div className="home-preview-body">
          <aside className="home-preview-sidebar"><strong>WORKSPACE</strong>{[['Inbox', MessageCircle], ['My tasks', ListTodo], ['Projects', FolderKanban], ['Calendar', CalendarDays], ['Documents', FileText], ['NexusAI', Sparkles]].map(([label, Icon], index) => { const Glyph = Icon as typeof MessageCircle; return <span className={index === 0 ? 'active' : ''} key={label as string}><Glyph size={16} /> {label as string}</span> })}</aside>
          <div className="home-preview-main"><div className="home-preview-heading"><div><small>TEAM OVERVIEW</small><strong>Everything connected</strong></div><Search size={18} /></div><div className="home-preview-grid"><div><MessageCircle size={20} /><strong>Communication</strong><span>Channels and decisions stay with the work.</span></div><div><ListTodo size={20} /><strong>Execution</strong><span>Projects, tasks, owners, and deadlines.</span></div><div><BookOpen size={20} /><strong>Knowledge</strong><span>Documents and answers your team can find.</span></div><div><Video size={20} /><strong>Collaboration</strong><span>Meetings, events, files, and shared context.</span></div></div></div>
        </div>
      </div>
    </section>

    <section className="home-section" id="product">
      <div className="home-section-heading"><div><div className="home-kicker"><span /> BUILT AS ONE PRODUCT</div><h2>Replace scattered tools with a connected operating system.</h2></div><p>Every Nexus module shares the same organization, permissions, search, notifications, and audit trail—so context does not disappear between apps.</p></div>
      <div className="home-capabilities">{capabilities.map(({ title, body, Icon }, index) => <article key={title}><span className="home-feature-number">0{index + 1}</span><Icon size={22} /><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="home-workflow" id="workflows">
      <div><div className="home-kicker"><span /> ONE CONTINUOUS WORKFLOW</div><h2>From conversation to completed work without losing context.</h2><p>A decision in chat becomes a task. The task links to a document. The document is reviewed in a meeting. The outcome stays searchable for the whole organization.</p><Link className="home-secondary" href="/login?signup=true">Start with your team <ChevronRight size={16} /></Link></div>
      <ol><li><span>01</span><div><strong>Discuss</strong><small>Channels and messages</small></div></li><li><span>02</span><div><strong>Plan</strong><small>Projects and tasks</small></div></li><li><span>03</span><div><strong>Create</strong><small>Documents and files</small></div></li><li><span>04</span><div><strong>Align</strong><small>Calendar and meetings</small></div></li><li><span>05</span><div><strong>Find</strong><small>Knowledge and AI</small></div></li></ol>
    </section>

    <section className="home-security" id="security"><div><Shield size={26} /><div><div className="home-kicker">SECURITY / ORGANIZATION CONTROL</div><h2>Your workspace stays organized, permissioned, and accountable.</h2></div></div><div className="home-security-points"><span><Users size={18} /> Organization roles and teams</span><span><Search size={18} /> Workspace-wide discovery</span><span><Shield size={18} /> Audit-ready activity history</span></div></section>

    <section className="home-final"><div className="home-kicker"><span /> READY WHEN YOUR TEAM IS</div><h2>Bring your work together in Nexus.</h2><p>Create a workspace, invite your team, and start with the tools you already need.</p><div className="home-actions"><Link className="home-button" href="/login?signup=true">Create workspace <ChevronRight size={16} /></Link><Link className="home-secondary" href="/login">Sign in</Link></div></section>

    <footer className="home-footer"><Link className="home-brand" href="/"><img src="/logo.jpg" alt="" /><span>Nexus</span></Link><span>THE CONNECTED WORKSPACE</span><span>Communication · Work · Knowledge · Collaboration</span></footer>
  </main>
}

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <main className="auth-loading">Loading Nexus…</main>
  return isSignedIn ? <WorkspaceHome /> : <NexusHome />
}
