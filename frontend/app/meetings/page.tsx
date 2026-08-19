'use client'

import AppShell from '../../components/AppShell'
import { useEffect, useState } from 'react'
import { CalendarDays, Copy, Plus, Video } from '../../components/icons'
import Link from 'next/link'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Meeting = { id: string; title: string; room_name: string; scheduled_at?: string | null; duration_minutes: number }

export default function MeetingsPage() {
  const { workspace } = useWorkspace()
  const { orgId, teamId } = workspaceIds(workspace)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [show, setShow] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!orgId) return
    void api<Meeting[]>(`/orgs/${orgId}/meetings`).then(setMeetings).catch(reason => setError(reason instanceof Error ? reason.message : 'Meetings could not be loaded.'))
    if (new URLSearchParams(window.location.search).get('new') === '1') setShow(true)
  }, [orgId])

  const create = async (meetingTitle = title.trim(), join = false) => {
    if (!orgId || !meetingTitle || busy) return
    setBusy(true); setError('')
    try {
      const meeting = await api<Meeting>(`/orgs/${orgId}/meetings`, { method: 'POST', body: JSON.stringify({ title: meetingTitle, teamId }) })
      setMeetings(items => [meeting, ...items]); setTitle(''); setShow(false)
      if (join) window.location.assign(`/meetings/room?room=${encodeURIComponent(meeting.room_name)}&meetingId=${meeting.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Meeting could not be created.') }
    finally { setBusy(false) }
  }

  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">COLLABORATION</div><h1>Meetings</h1><p className="muted">Create secure LiveKit rooms and keep attendance history.</p></div><div className="actions"><button className="button" disabled={busy} onClick={() => void create('Instant meeting', true)}><Video size={15}/> Start instant meeting</button><button className="button primary" onClick={() => setShow(true)}><Plus size={15}/> Schedule meeting</button></div></div>{error && <div className="form-error" role="alert">{error}</div>}<section className="card"><div className="card-header"><h2>Meetings</h2><Video size={17} className="muted"/></div>{meetings.length === 0 ? <div className="empty"><Video size={30}/><p>No meetings scheduled.</p><button className="button" disabled={busy} onClick={() => void create('Instant meeting', true)}>Start instant meeting</button></div> : meetings.map(meeting => <div className="task-row" key={meeting.id}><Video size={17} color="var(--brand)"/><div className="task-copy"><strong>{meeting.title}</strong><small>{meeting.scheduled_at ? new Date(meeting.scheduled_at).toLocaleString() : 'Instant room'} · {meeting.duration_minutes} min</small></div><Link className="button primary" href={`/meetings/room?room=${encodeURIComponent(meeting.room_name)}&meetingId=${meeting.id}`}>Join</Link><button className="icon-button" aria-label="Copy invite link" onClick={() => navigator.clipboard?.writeText(`${location.origin}/meetings/room?room=${encodeURIComponent(meeting.room_name)}&meetingId=${meeting.id}`)}><Copy size={15}/></button></div>)}</section><section className="card" style={{marginTop:16}}><div className="card-header"><h2>Calendar</h2><CalendarDays size={17}/></div><Link className="button" href="/calendar">View workspace calendar</Link></section>{show && <div className="modal-backdrop" onClick={() => setShow(false)}><div className="card modal-card" onClick={event => event.stopPropagation()}><div className="card-header"><h2>Schedule meeting</h2><button className="icon-button" onClick={() => setShow(false)}>×</button></div><div className="field"><label htmlFor="meeting-title">Title</label><input id="meeting-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="Weekly team sync"/></div><button className="button primary" disabled={busy || !title.trim()} onClick={() => void create()}>{busy ? 'Creating…' : 'Create meeting'}</button></div></div>}</div></AppShell>
}
