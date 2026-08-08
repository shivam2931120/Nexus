'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Activity, Bell, BookOpen, CalendarDays, CircleHelp, FolderKanban, Home, Inbox, ListTodo, LogOut, MessageCircle, Search, Settings, Users, Video } from './icons'

const primary = [['/', 'Home', Home], ['/tasks', 'My Tasks', ListTodo], ['/chat', 'Inbox', Inbox]] as const
const workspace = [['/projects', 'Projects', FolderKanban], ['/calendar', 'Calendar', CalendarDays], ['/meetings', 'Meetings', Video], ['/files', 'File Drive', FolderKanban], ['/knowledge', 'Knowledge Base', BookOpen], ['/directory', 'Directory', Users], ['/analytics', 'Analytics', Activity]] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter()
  const [name, setName] = useState('Nexus user'); const [dark, setDark] = useState(false)
  useEffect(() => { setName(localStorage.getItem('nexus_name') ?? 'Nexus user'); const saved = localStorage.getItem('nexus_theme') === 'dark'; setDark(saved); document.documentElement.dataset.theme = saved ? 'dark' : 'light' }, [])
  const toggleTheme = () => { const next = !dark; setDark(next); localStorage.setItem('nexus_theme', next ? 'dark' : 'light'); document.documentElement.dataset.theme = next ? 'dark' : 'light' }
  const nav = (items: readonly (readonly [string, string, typeof Home])[]) => items.map(([href, label, Icon]) => <Link key={href} href={href} className={`nav-item ${path === href ? 'active' : ''}`}><Icon size={17}/><span>{label}</span></Link>)
  const signOut = () => { localStorage.removeItem('nexus_token'); localStorage.removeItem('nexus_name'); router.push('/login') }
  const initials = name.slice(0, 1).toUpperCase()
  return <div className="shell"><header className="topbar"><div className="brand"><div className="brand-mark">N</div><span>Nexus</span></div><button className="search" type="button" onClick={() => router.push('/tasks')}><Search size={15}/><span>Search everything</span><kbd>⌘ K</kbd></button><div className="top-actions"><button aria-label="Help" className="icon-button" type="button" onClick={() => router.push('/knowledge')}><CircleHelp size={17}/></button><Link aria-label="Notifications" className="icon-button" href="/notifications"><Bell size={17}/></Link><button aria-label="Toggle dark mode" className="icon-button" type="button" onClick={toggleTheme}>{dark ? '☀' : '☾'}</button><button aria-label="Profile" className="avatar" type="button" onClick={() => router.push('/settings')}>{initials}</button></div></header><aside className="sidebar"><nav>{nav(primary)}<div className="nav-section">TEAMS</div><Link href="/chat" className="nav-item"><MessageCircle size={17}/><span>Team channels</span></Link><div className="nav-section">WORKSPACE</div>{nav(workspace)}<div className="nav-section">ACCOUNT</div><Link href="/settings" className="nav-item"><Settings size={17}/><span>Settings</span></Link><button className="nav-item" type="button" onClick={signOut}><LogOut size={17}/><span>Sign out</span></button></nav></aside><main className="main">{children}</main></div>
}
