'use client'

import AppShell from '../../components/AppShell'
import { CalendarDays, Copy, Plus, Video } from '../../components/icons'
import Link from 'next/link'

const room = 'nexus-team-room'

export default function MeetingsPage() {
  const link = `/meetings/room?room=${room}`
  return <AppShell><div className="page">
    <div className="grid dashboard-grid"><section className="card"><div className="card-header"><h2>Start a room</h2><Video size={17} className="muted"/></div><div className="meeting-hero"><Video size={24} color="var(--brand)"/><div><h2>Instant meeting</h2><p className="muted">Create a secure room and invite your team.</p><div className="actions" style={{ marginTop: 15 }}><Link className="button primary" href={link}>Join meeting</Link><Link className="button" href="/calendar"><CalendarDays size={15}/> Schedule event</Link></div></div></div></section><section className="card"><div className="card-header"><h2>Quick room</h2><Video size={17} className="muted"/></div><p className="muted" style={{ fontSize: 13 }}>Share this link after opening the room.</p><div className="room-link"><code>{typeof window !== 'undefined' ? `${window.location.origin}${link}` : link}</code><button className="icon-button" aria-label="Copy meeting link" type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${link}`)}><Copy size={15}/></button></div><Link className="button" href={link}>Open room</Link></section></div>
    <section className="card" style={{ marginTop: 16 }}><div className="card-header"><h2>Upcoming meetings</h2><Link className="button" href="/calendar">View calendar</Link></div><div className="empty"><Video size={30}/><p>No meetings scheduled yet.</p><Link className="button primary" href="/calendar">Create an event</Link></div></section>
  </div></AppShell>
}
