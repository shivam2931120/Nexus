'use client'

import AppShell from '../../components/AppShell'
import { CalendarDays, Copy, Plus, Video } from '../../components/icons'
import Link from 'next/link'

const room = 'nexus-team-room'

export default function MeetingsPage() {
  const link = `/meetings/room?room=${room}`
  return <AppShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">COLLABORATION</div><h1>Meetings</h1><p className="muted">Schedule focused conversations and keep the outcomes close to the work.</p></div><div className="actions"><Link className="button primary" href={link}><Video size={15}/> Start instant meeting</Link><button className="button" type="button"><Plus size={15}/> Schedule meeting</button></div></div>
    <div className="grid dashboard-grid"><section className="card"><div className="card-header"><h2>Next up</h2><span className="badge">Today</span></div><div className="meeting-hero"><Video size={24} color="var(--brand)"/><div><h2>Sprint standup</h2><p className="muted">10:00 AM · 30 minutes · Engineering</p><div className="actions" style={{ marginTop: 15 }}><Link className="button primary" href={link}>Join meeting</Link><button className="button" type="button"><CalendarDays size={15}/> Add to calendar</button></div></div></div></section><section className="card"><div className="card-header"><h2>Quick room</h2><Video size={17} className="muted"/></div><p className="muted" style={{ fontSize: 13 }}>Start a room and invite your team with one link.</p><div className="room-link"><code>{typeof window !== 'undefined' ? `${window.location.origin}${link}` : link}</code><button className="icon-button" aria-label="Copy meeting link" type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${link}`)}><Copy size={15}/></button></div><Link className="button" href={link}>Open room</Link></section></div>
    <section className="card" style={{ marginTop: 16 }}><div className="card-header"><h2>Upcoming meetings</h2><Link className="button" href="/calendar">View calendar</Link></div>{[['Product planning','Friday, Aug 8 · 11:30 AM','Product'],['Design review','Wednesday, Aug 6 · 2:00 PM','Design'],['1:1 with Priya','Monday, Aug 10 · 4:00 PM','People']].map(([title,meta,team]) => <div className="task-row" key={title}><span className="avatar" style={{ background: '#6366f1' }}><Video size={14}/></span><div className="task-copy"><strong>{title}</strong><small>{meta} · {team}</small></div><Link className="button" href={link}>Join</Link></div>)}</section>
  </div></AppShell>
}
