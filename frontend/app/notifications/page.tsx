'use client'

import AppShell from '../../components/AppShell'
import { Bell, Save } from '../../components/icons'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

type Notice = { id: string; title: string; body: string; read_at?: string | null; created_at: string }
type Preferences = { emailEnabled: boolean; pushEnabled: boolean; taskEnabled: boolean; mentionEnabled: boolean; meetingEnabled: boolean; documentEnabled: boolean; doNotDisturb: boolean }

const defaults: Preferences = { emailEnabled: true, pushEnabled: true, taskEnabled: true, mentionEnabled: true, meetingEnabled: true, documentEnabled: true, doNotDisturb: false }

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notice[]>([]); const [preferences, setPreferences] = useState(defaults); const [saved, setSaved] = useState(true); const [error, setError] = useState('')
  useEffect(() => { void Promise.all([api<Notice[]>('/notifications'), api<Preferences>('/notifications/preferences')]).then(([items, prefs]) => { setNotifications(items); setPreferences({ ...defaults, ...prefs }) }).catch(err => setError(err instanceof Error ? err.message : 'Notifications could not be loaded.')) }, [])
  const mark = async (id: string) => { try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); setNotifications(items => items.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Notification could not be updated.') } }
  const savePreferences = async () => { try { await api('/notifications/preferences', { method: 'PUT', body: JSON.stringify(preferences) }); setSaved(true) } catch (err) { setError(err instanceof Error ? err.message : 'Preferences could not be saved.') } }
  const update = (key: keyof Preferences, value: boolean) => { setSaved(false); setPreferences(current => ({ ...current, [key]: value })) }
  const unread = notifications.filter(item => !item.read_at)
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">INBOX</div><h1>Notifications</h1><p className="muted">Workspace activity, delivery controls, and focus settings.</p></div><button className="button" disabled={!unread.length} onClick={() => void Promise.all(unread.map(item => mark(item.id)))}>Mark all read</button></div>{error && <div className="form-error">{error}</div>}<div className="grid dashboard-grid"><section className="card"><div className="card-header"><h2>Notification center</h2><Bell size={18} /></div>{notifications.length === 0 ? <div className="empty"><Bell size={32} /><p>You’re all caught up.</p></div> : notifications.map(item => <button className="notification-row" key={item.id} onClick={() => void mark(item.id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: item.read_at ? 'transparent' : 'var(--brand-soft)', border: 0, borderBottom: '1px solid var(--border)', padding: 16, color: 'var(--text)' }}><strong>{item.title}</strong><p className="muted">{item.body}</p><small className="muted">{new Date(item.created_at).toLocaleString()}</small></button>)}</section><section className="card"><div className="card-header"><h2>Preferences</h2><button className="button primary" disabled={saved} onClick={() => void savePreferences()}><Save size={15} /> {saved ? 'Saved' : 'Save'}</button></div>{([['emailEnabled','Email notifications'],['pushEnabled','Browser push notifications'],['taskEnabled','Task assignments and deadlines'],['mentionEnabled','Mentions'],['meetingEnabled','Meetings and reminders'],['documentEnabled','Document activity'],['doNotDisturb','Do Not Disturb mode']] as Array<[keyof Preferences,string]>).map(([key,label]) => <label className="task-row" key={key} style={{ cursor: 'pointer' }}><span className="task-copy"><strong>{label}</strong><small className="muted">{key === 'doNotDisturb' ? 'Pause non-critical alerts.' : 'Receive this notification category.'}</small></span><input type="checkbox" checked={preferences[key]} onChange={event => update(key, event.target.checked)} /></label>)}</section></div></div></AppShell>
}
