'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { Activity, Bell, BookOpen, CalendarDays, CircleHelp, FolderKanban, Home, Inbox, ListTodo, LogOut, MessageCircle, Search, Settings, Users, Video } from './icons'
import { useWorkspace } from '../lib/workspace'

const primary = [['/', 'Home', Home], ['/tasks', 'My Tasks', ListTodo], ['/chat', 'Inbox', Inbox]] as const
const workspace = [['/teams', 'Teams', Users], ['/projects', 'Projects', FolderKanban], ['/calendar', 'Calendar', CalendarDays], ['/meetings', 'Meetings', Video], ['/files', 'File Drive', FolderKanban], ['/knowledge', 'Knowledge Base', BookOpen], ['/directory', 'Directory', Users], ['/analytics', 'Analytics', Activity], ['/audit', 'Audit log', Activity]] as const
type Result = { id: string; title?: string; content?: string; type: string }

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const { signOut } = useClerk(); const { workspace: ws } = useWorkspace()
  const [name, setName] = useState('Nexus user'); const [dark, setDark] = useState(false); const [unread, setUnread] = useState(0); const [searchOpen, setSearchOpen] = useState(false); const [serverError, setServerError] = useState(''); const [q, setQ] = useState(''); const [results, setResults] = useState<Result[]>([])

  useEffect(() => {
    setName(localStorage.getItem('nexus_name') ?? 'Nexus user')
    const saved = localStorage.getItem('nexus_theme') === 'dark'; setDark(saved); document.documentElement.dataset.theme = saved ? 'dark' : 'light'
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true) } }
    const apiError = (event: Event) => setServerError((event as CustomEvent<{ message?: string }>).detail?.message ?? 'The server could not complete the request.')
    window.addEventListener('keydown', key); window.addEventListener('nexus:api-error', apiError)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('nexus:api-error', apiError) }
  }, [])
  useEffect(() => { const load = () => fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'}/notifications`, { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token') ?? ''}` } }).then(response => response.ok ? response.json() : []).then((items: Array<{ read_at?: string | null }>) => setUnread(items.filter(item => !item.read_at).length)).catch(() => {}); load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { if (!searchOpen || q.trim().length < 2 || !ws) return; const timer = setTimeout(() => fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'}/search?q=${encodeURIComponent(q)}&orgId=${ws.organization.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token') ?? ''}` } }).then(response => response.ok ? response.json() : null).then(data => data && setResults([...data.tasks, ...data.documents, ...data.messages])).catch(() => {}), 250); return () => clearTimeout(timer) }, [q, searchOpen, ws])

  const toggle = () => { const next = !dark; setDark(next); localStorage.setItem('nexus_theme', next ? 'dark' : 'light'); document.documentElement.dataset.theme = next ? 'dark' : 'light' }
  const nav = (items: readonly (readonly [string, string, typeof Home])[]) => items.map(([href, label, Icon]) => <Link key={href} href={href} className={`nav-item ${path === href ? 'active' : ''}`}><Icon size={17} /><span>{label}</span></Link>)
  const logout = async () => { localStorage.clear(); await signOut(); router.push('/login') }

  return <div className="shell"><header className="topbar"><Link href="/" className="brand"><div className="brand-mark">N</div><span>Nexus</span></Link><button className="search" onClick={() => setSearchOpen(true)}><Search size={15} /><span>Search everything</span><kbd>⌘ K</kbd></button><div className="top-actions"><button aria-label="Help" className="icon-button" onClick={() => router.push('/knowledge')}><CircleHelp size={17} /></button><Link aria-label="Notifications" className="icon-button" href="/notifications"><Bell size={17} />{unread > 0 && <span className="nav-count">{unread > 99 ? '99+' : unread}</span>}</Link><button aria-label="Toggle dark mode" className="icon-button" onClick={toggle}>{dark ? '☀' : '☾'}</button><button aria-label="Profile" className="avatar" onClick={() => router.push('/settings')}>{name.slice(0, 1).toUpperCase()}</button></div></header><aside className="sidebar"><nav>{nav(primary)}<div className="nav-section">TEAMS</div><Link href="/chat" className="nav-item"><MessageCircle size={17} /><span>Team channels</span></Link><div className="nav-section">WORKSPACE</div>{nav(workspace)}<div className="nav-section">ACCOUNT</div><Link href="/settings" className="nav-item"><Settings size={17} /><span>Settings</span></Link><button className="nav-item" onClick={() => void logout()}><LogOut size={17} /><span>Sign out</span></button></nav></aside><main className="main">{children}</main>{searchOpen && <div className="modal-backdrop" onClick={() => setSearchOpen(false)}><div className="card modal-card" onClick={event => event.stopPropagation()}><div className="card-header"><h2>Search workspace</h2><button className="icon-button" onClick={() => setSearchOpen(false)}>×</button></div><div className="search" style={{ background: 'var(--surface)', marginBottom: 12 }}><Search size={15} /><input autoFocus value={q} onChange={event => setQ(event.target.value)} placeholder="Search tasks, documents, messages" /></div>{results.length === 0 ? <p className="muted">Type at least two characters to search.</p> : results.map(result => <button className="nav-item" key={`${result.type}-${result.id}`} onClick={() => { setSearchOpen(false); router.push(result.type === 'task' ? '/tasks' : result.type === 'document' ? '/documents' : '/chat') }}><Search size={15} /><span>{result.title ?? result.content}</span><small className="muted">{result.type}</small></button>)}</div></div>}{serverError && <div className="forge-server-modal" role="alertdialog" aria-live="assertive"><div className="forge-server-dialog"><div className="eyebrow">SYSTEM / REQUEST FAILED</div><h2>Server connection interrupted.</h2><p>{serverError}</p><div className="actions"><button className="button primary" onClick={() => window.location.reload()}>Retry page</button><button className="button" onClick={() => setServerError('')}>Dismiss</button></div></div></div>}</div>
}
