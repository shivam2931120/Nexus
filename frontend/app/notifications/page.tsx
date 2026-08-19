'use client'

import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import { Bell, Save, X } from '../../components/icons'
import { api } from '../../lib/api'

type Notice = { id: string; title: string; body: string; read_at?: string | null; created_at: string }
type Preferences = { emailEnabled: boolean; pushEnabled: boolean; taskEnabled: boolean; mentionEnabled: boolean; meetingEnabled: boolean; documentEnabled: boolean; doNotDisturb: boolean }

const defaults: Preferences = { emailEnabled: true, pushEnabled: true, taskEnabled: true, mentionEnabled: true, meetingEnabled: true, documentEnabled: true, doNotDisturb: false }
const options: Array<[keyof Preferences, string]> = [['emailEnabled', 'Email notifications'], ['pushEnabled', 'Browser push notifications'], ['taskEnabled', 'Task assignments and deadlines'], ['mentionEnabled', 'Mentions'], ['meetingEnabled', 'Meetings and reminders'], ['documentEnabled', 'Document activity'], ['doNotDisturb', 'Do Not Disturb mode']]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notice[]>([])
  const [preferences, setPreferences] = useState(defaults)
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void Promise.all([api<Notice[]>('/notifications'), api<Preferences>('/notifications/preferences')])
      .then(([items, prefs]) => { setNotifications(items); setPreferences({ ...defaults, ...prefs }) })
      .catch(err => setError(err instanceof Error ? err.message : 'Notifications could not be loaded.'))
  }, [])

  const mark = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications(items => items.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Notification could not be updated.') }
  }
  const markAll = async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' })
      setNotifications(items => items.map(item => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })))
    } catch (err) { setError(err instanceof Error ? err.message : 'Notifications could not be updated.') }
  }
  const savePreferences = async () => {
    try { await api('/notifications/preferences', { method: 'PUT', body: JSON.stringify(preferences) }); setSaved(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'Preferences could not be saved.') }
  }
  const update = (key: keyof Preferences, value: boolean) => { setSaved(false); setPreferences(current => ({ ...current, [key]: value })) }
  const unread = notifications.filter(item => !item.read_at)

  return <AppShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">INBOX</div><h1>Notifications</h1><p className="muted">Workspace activity, delivery controls, and focus settings.</p></div><button className="button" disabled={!unread.length} onClick={() => void markAll()}>Mark all read</button></div>
    {error && <div className="form-error"><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button><span>{error}</span></div>}
    <div className="grid dashboard-grid">
      <section className="card"><div className="card-header"><h2>Notification center</h2><Bell size={18} /></div>{notifications.length === 0 ? <div className="empty"><Bell size={32} /><p>You’re all caught up.</p></div> : notifications.map(item => <button className={`notification-row ${item.read_at ? '' : 'unread'}`} key={item.id} onClick={() => void mark(item.id)}><span className="notification-icon"><Bell size={15} /></span><span className="task-copy"><strong>{item.title}</strong><small>{item.body}</small><small>{new Date(item.created_at).toLocaleString()}</small></span></button>)}</section>
      <section className="card"><div className="card-header"><h2>Preferences</h2><button className="button primary" disabled={saved} onClick={() => void savePreferences()}><Save size={15} /> {saved ? 'Saved' : 'Save'}</button></div>{options.map(([key, label]) => <label className="task-row preference-row" key={key}><span className="task-copy"><strong>{label}</strong><small>{key === 'doNotDisturb' ? 'Pause non-critical alerts.' : 'Receive this notification category.'}</small></span><input type="checkbox" checked={preferences[key]} onChange={event => update(key, event.target.checked)} /></label>)}</section>
    </div>
  </div></AppShell>
}
