'use client'
import AppShell from '../../components/AppShell'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Video } from '../../components/icons'
import { useState } from 'react'

const events = [
  { day: 5, time: '10:00', title: 'Sprint standup', kind: 'meeting' },
  { day: 6, time: '14:00', title: 'Design review', kind: 'work' },
  { day: 8, time: '11:30', title: 'Product planning', kind: 'meeting' },
  { day: 12, time: '16:00', title: 'Release milestone', kind: 'deadline' },
]

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [showForm, setShowForm] = useState(false)
  const days = Array.from({ length: 35 }, (_, i) => i - 3)
  return <AppShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE</div><h1>Calendar</h1><p className="muted">Meetings, deadlines, and team events in one view.</p></div><button className="button primary" onClick={() => setShowForm(true)}><Plus size={15}/> New event</button></div>
    <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><div className="actions"><button className="button"><ChevronLeft size={15}/></button><button className="button"><ChevronRight size={15}/></button><strong style={{ fontSize: 16 }}>August 2026</strong></div><div className="actions"><button className={`button ${view === 'month' ? 'primary' : ''}`} onClick={() => setView('month')}>Month</button><button className={`button ${view === 'week' ? 'primary' : ''}`} onClick={() => setView('week')}>Week</button></div></div>
      {view === 'month' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 1, background: 'var(--border)' }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} style={{ background: 'var(--surface-muted)', padding: 10, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{d}</div>)}{days.map(day => <div key={day} style={{ background: 'var(--surface)', minHeight: 96, padding: 9, opacity: day < 1 || day > 31 ? .4 : 1 }}><span style={{ fontSize: 12, fontWeight: 600 }}>{day > 0 && day < 32 ? day : ''}</span>{events.filter(e => e.day === day).map(event => <div key={event.title} style={{ marginTop: 7, padding: '5px 6px', borderRadius: 5, fontSize: 11, background: event.kind === 'meeting' ? 'var(--brand-soft)' : event.kind === 'deadline' ? '#fef3c7' : '#dcfce7', color: event.kind === 'meeting' ? 'var(--brand)' : 'var(--text)' }}><strong>{event.time}</strong> {event.title}</div>)}</div>)}</div> : <div className="grid" style={{ gridTemplateColumns: 'repeat(7, minmax(120px,1fr))', overflowX: 'auto' }}>{['Mon 3','Tue 4','Wed 5','Thu 6','Fri 7','Sat 8','Sun 9'].map((day, i) => <div className="card" key={day} style={{ minHeight: 280 }}><h2>{day}</h2>{events.filter(e => (i === 2 && e.day === 5) || (i === 3 && e.day === 6) || (i === 5 && e.day === 8)).map(e => <div className="task-row" key={e.title}><CalendarDays size={15} color="var(--brand)"/><div className="task-copy"><strong>{e.title}</strong><small>{e.time}</small></div></div>)}</div>)}</div>}
    </div>
    <div className="grid dashboard-grid"><div className="card"><div className="card-header"><h2>Upcoming meetings</h2><Video size={17} className="muted"/></div>{events.filter(e => e.kind === 'meeting').map(e => <div className="event-row task-row" key={e.title}><CalendarDays size={16} color="var(--brand)"/><div className="task-copy"><strong>{e.title}</strong><small>Aug {e.day}, 2026 · {e.time} · Engineering</small></div><button className="button">Open</button></div>)}</div><div className="card"><div className="card-header"><h2>Deadlines</h2></div><div className="task-row"><span className="status-dot progress"/><div className="task-copy"><strong>Release milestone</strong><small>Aug 12 · Nexus MVP</small></div><span className="badge">On track</span></div><div className="task-row"><span className="status-dot"/><div className="task-copy"><strong>Marketing site review</strong><small>Aug 15 · Marketing</small></div><span className="badge">Upcoming</span></div></div></div>
    {showForm && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="card modal-card"><div className="card-header"><h2>Create event</h2><button className="icon-button" onClick={() => setShowForm(false)}>×</button></div><div className="field"><label htmlFor="event-title">Event title</label><input id="event-title" placeholder="Team sync" /></div><div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><div className="field"><label htmlFor="event-date">Date</label><input id="event-date" type="date" /></div><div className="field"><label htmlFor="event-time">Time</label><input id="event-time" type="time" /></div></div><button className="button primary" onClick={() => setShowForm(false)}>Create event</button></div></div>}
  </div></AppShell>
}
