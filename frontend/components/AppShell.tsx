'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { Activity, Bell, BookOpen, CalendarDays, ChevronLeft, ChevronRight, CircleHelp, FileText, FolderKanban, Home, Inbox, ListChecks, ListTodo, LogOut, Menu, MessageCircle, Moon, Search, Settings, Sparkles, Sun, Users, Video, X } from './icons'
import { useWorkspace } from '../lib/workspace'
import { api } from '../lib/api'

const primary = [['/', 'Home', Home], ['/tasks', 'My Tasks', ListTodo], ['/chat', 'Inbox', Inbox]] as const
const workspace = [['/teams', 'Teams', Users], ['/projects', 'Projects', FolderKanban], ['/calendar', 'Calendar', CalendarDays], ['/meetings', 'Meetings', Video], ['/forms', 'Forms', ListChecks], ['/documents', 'Documents', FileText], ['/files', 'File Drive', FolderKanban], ['/knowledge', 'Knowledge Base', BookOpen], ['/whiteboard', 'Whiteboard', FolderKanban], ['/assistant', 'NexusAI', Sparkles], ['/directory', 'Directory', Users], ['/analytics', 'Analytics', Activity], ['/audit', 'Audit log', Activity]] as const
type Result = { id: string; title?: string; content?: string; type: string; href?: string }
type SearchResponse = Record<'tasks' | 'documents' | 'messages' | 'files' | 'projects' | 'forms' | 'events', Result[]>

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const { signOut } = useClerk(); const { isLoaded, isSignedIn, getToken } = useAuth(); const { user } = useUser(); const { workspace: ws } = useWorkspace()
  const [name, setName] = useState('Nexus user'); const [dark, setDark] = useState(true); const [mobileViewport, setMobileViewport] = useState(false); const [mobileNavOpen, setMobileNavOpen] = useState(false); const [sidebarCollapsed, setSidebarCollapsed] = useState(false); const [unread, setUnread] = useState(0); const [searchOpen, setSearchOpen] = useState(false); const [serverError, setServerError] = useState(''); const [q, setQ] = useState(''); const [results, setResults] = useState<Result[]>([])

  useEffect(() => {
    setName(user?.fullName ?? user?.firstName ?? localStorage.getItem('nexus_name') ?? 'Nexus user')
    const saved = localStorage.getItem('nexus_theme') !== 'light'; setDark(saved); document.documentElement.dataset.theme = saved ? 'dark' : 'light'
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true) } }
    const apiError = (event: Event) => setServerError((event as CustomEvent<{ message?: string }>).detail?.message ?? 'The server could not complete the request.')
    const themeChanged = (event: Event) => setDark(Boolean((event as CustomEvent<{ dark?: boolean }>).detail?.dark))
    let handlingExpiredSession = false
    const authExpired = () => {
      if (handlingExpiredSession) return
      handlingExpiredSession = true
      void signOut().catch(() => undefined).finally(() => {
        router.replace(`/login?redirect_url=${encodeURIComponent(path)}&reason=session`)
      })
    }
    window.addEventListener('keydown', key); window.addEventListener('nexus:api-error', apiError); window.addEventListener('nexus:auth-expired', authExpired); window.addEventListener('nexus:theme', themeChanged)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('nexus:api-error', apiError); window.removeEventListener('nexus:auth-expired', authExpired); window.removeEventListener('nexus:theme', themeChanged) }
  }, [path, router, signOut, user])
  useEffect(() => { if (isLoaded && !isSignedIn) router.replace(`/login?redirect_url=${encodeURIComponent(path)}`) }, [isLoaded, isSignedIn, path, router])
  useEffect(() => { setMobileNavOpen(false) }, [path])
  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1100px)')
    const saved = localStorage.getItem('nexus_sidebar_collapsed')
    setSidebarCollapsed(saved === null ? compact.matches : saved === 'true')
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setSidebarCollapsed(true)
    }
    compact.addEventListener('change', onChange)
    return () => compact.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)')
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setMobileViewport(event.matches)
      if (!event.matches) setMobileNavOpen(false)
    }
    onChange(mobile)
    mobile.addEventListener('change', onChange)
    return () => mobile.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    if (!mobileNavOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileNavOpen])
  useEffect(() => { if (!isSignedIn) return; const load = () => void getToken().then(token => token ? api<Array<{ read_at?: string | null }>>('/notifications', { token }) : []).then(items => setUnread(items.filter(item => !item.read_at).length)).catch(() => {}); load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer) }, [getToken, isSignedIn])
  useEffect(() => { if (!searchOpen || q.trim().length < 2 || !ws || !isSignedIn) { setResults([]); return }; const timer = setTimeout(() => void getToken().then(token => token ? api<SearchResponse>(`/search?q=${encodeURIComponent(q)}&orgId=${ws.organization.id}`, { token }) : null).then(data => data && setResults(Object.values(data).flat())).catch(() => setResults([])), 250); return () => clearTimeout(timer) }, [getToken, isSignedIn, q, searchOpen, ws])

  const toggle = () => { const next = !dark; setDark(next); localStorage.setItem('nexus_theme', next ? 'dark' : 'light'); document.documentElement.dataset.theme = next ? 'dark' : 'light'; window.dispatchEvent(new CustomEvent('nexus:theme', { detail: { dark: next } })) }
  const isActive = (href: string) => path === href || (href !== '/' && path.startsWith(`${href}/`))
  const closeMobileNav = () => setMobileNavOpen(false)
  const nav = (items: readonly (readonly [string, string, typeof Home])[]) => items.map(([href, label, Icon]) => <Link key={href} href={href} title={sidebarCollapsed ? label : undefined} aria-current={isActive(href) ? 'page' : undefined} onClick={closeMobileNav} className={`nav-item ${isActive(href) ? 'active' : ''}`}><Icon size={17} /><span>{label}</span></Link>)
  const toggleNavigation = () => {
    if (mobileViewport) {
      setMobileNavOpen(open => !open)
      return
    }
    setSidebarCollapsed(collapsed => {
      const next = !collapsed
      localStorage.setItem('nexus_sidebar_collapsed', String(next))
      return next
    })
  }
  const logout = async () => { localStorage.removeItem('nexus_name'); localStorage.removeItem('nexus_org_id'); localStorage.removeItem('nexus_team_id'); await signOut(); router.push('/login') }

  if (!isLoaded || !isSignedIn) return <main className="auth-loading" aria-live="polite">Loading secure workspace…</main>

  return <div className={`shell ${mobileNavOpen ? 'mobile-nav-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}><header className="topbar"><div className="topbar-brand-area"><button className="icon-button navigation-toggle" aria-label={mobileNavOpen ? 'Close navigation' : mobileViewport ? 'Open navigation' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={mobileViewport ? mobileNavOpen : !sidebarCollapsed} aria-controls="workspace-navigation" onClick={toggleNavigation}>{mobileNavOpen ? <X size={18} /> : mobileViewport ? <Menu size={18} /> : sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button><Link href="/" className="brand" onClick={closeMobileNav}><div className="brand-mark">N</div><span>Nexus</span></Link></div><button className="search" onClick={() => setSearchOpen(true)}><Search size={15} /><span>Search everything</span><kbd>⌘ K</kbd></button><div className="top-actions"><button aria-label="Help" className="icon-button" onClick={() => router.push('/knowledge')}><CircleHelp size={17} /></button><Link aria-label="Notifications" className="icon-button" href="/notifications"><Bell size={17} />{unread > 0 && <span className="nav-count">{unread > 99 ? '99+' : unread}</span>}</Link><button aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="icon-button" onClick={toggle}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button aria-label="Open profile settings" title={name} className="avatar" onClick={() => router.push('/settings')}>{name.slice(0, 1).toUpperCase()}</button></div></header><button className="sidebar-backdrop" aria-label="Close navigation" tabIndex={mobileNavOpen ? 0 : -1} onClick={closeMobileNav} /><aside id="workspace-navigation" className="sidebar" aria-label="Workspace navigation"><nav>{nav(primary)}<div className="nav-section">TEAMS</div><Link href="/chat" title={sidebarCollapsed ? 'Team channels' : undefined} aria-current={isActive('/chat') ? 'page' : undefined} onClick={closeMobileNav} className={`nav-item ${isActive('/chat') ? 'active' : ''}`}><MessageCircle size={17} /><span>Team channels</span></Link><div className="nav-section">WORKSPACE</div>{nav(workspace)}<div className="nav-section">ACCOUNT</div><Link href="/settings" title={sidebarCollapsed ? 'Settings' : undefined} aria-current={isActive('/settings') ? 'page' : undefined} onClick={closeMobileNav} className={`nav-item ${isActive('/settings') ? 'active' : ''}`}><Settings size={17} /><span>Settings</span></Link><button className="nav-item" title={sidebarCollapsed ? 'Sign out' : undefined} onClick={() => void logout()}><LogOut size={17} /><span>Sign out</span></button></nav></aside><main className="main">{children}</main>{searchOpen && <div className="modal-backdrop" onClick={() => setSearchOpen(false)}><div className="card modal-card" onClick={event => event.stopPropagation()}><div className="card-header"><h2>Search workspace</h2><button className="icon-button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={17} /></button></div><div className="search section-gap"><Search size={15} /><input autoFocus value={q} onChange={event => setQ(event.target.value)} placeholder="Search workspace records" /></div>{results.length === 0 ? <p className="muted section-gap">Type at least two characters to search.</p> : <div className="section-gap">{results.map(result => <button className="nav-item" key={`${result.type}-${result.id}`} onClick={() => { setSearchOpen(false); router.push(result.href ?? '/'); }}><Search size={15} /><span>{result.title ?? result.content}</span><small>{result.type}</small></button>)}</div>}</div></div>}{serverError && <div className="nexus-server-modal" role="alertdialog" aria-live="assertive"><div className="nexus-server-dialog"><div className="eyebrow">SYSTEM / REQUEST FAILED</div><h2>Server connection interrupted.</h2><p>{serverError}</p><div className="actions"><button className="button primary" onClick={() => window.location.reload()}>Retry page</button><button className="button" onClick={() => setServerError('')}>Dismiss</button></div></div></div>}</div>
}
