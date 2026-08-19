'use client'

import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import { Moon, Plus, Shield, Sun, X } from '../../components/icons'
import { api } from '../../lib/api'
import { useWorkspace } from '../../lib/workspace'

type Org = { id: string; name: string; slug: string; role: string }

export default function Settings() {
  const { workspace, refresh } = useWorkspace()
  const [dark, setDark] = useState(true)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    setDark(localStorage.getItem('nexus_theme') !== 'light')
    const themeChanged = (event: Event) => setDark(Boolean((event as CustomEvent<{ dark?: boolean }>).detail?.dark))
    window.addEventListener('nexus:theme', themeChanged)
    return () => window.removeEventListener('nexus:theme', themeChanged)
  }, [])

  useEffect(() => {
    if (!workspace) return
    void api<Org[]>('/orgs').then(setOrgs).catch(err => setActionError(err instanceof Error ? err.message : 'Organizations could not be loaded.'))
  }, [workspace])

  const toggle = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('nexus_theme', next ? 'dark' : 'light')
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    window.dispatchEvent(new CustomEvent('nexus:theme', { detail: { dark: next } }))
  }
  const create = async () => {
    if (!name.trim()) return
    setActionError('')
    try {
      const org = await api<Org>('/orgs', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
      setOrgs(items => [...items, org]); setName(''); setShow(false); await refresh(true)
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Organization could not be created.') }
  }

  return <AppShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">ACCOUNT</div><h1>Settings</h1><p className="muted">Manage workspace appearance, organizations, and account security.</p></div></div>
    {actionError && <div className="form-error">{actionError}</div>}
    <div className="stacked content-narrow">
      <section className="card"><div className="card-header"><div><h2>Appearance</h2><p className="muted">Choose the theme for this workspace.</p></div>{dark ? <Moon size={18} /> : <Sun size={18} />}</div><button className="button" onClick={toggle}>{dark ? 'Switch to light mode' : 'Switch to dark mode'}</button></section>
      <section className="card"><div className="card-header"><div><h2>Organizations</h2><p className="muted">Switch workspace context or create another organization.</p></div><button className="button primary" onClick={() => setShow(true)}><Plus size={15} /> New organization</button></div>{orgs.length === 0 ? <div className="empty">No organizations available.</div> : orgs.map(org => <button className={`nav-item ${workspace?.organization.id === org.id ? 'active' : ''}`} key={org.id} onClick={() => { localStorage.setItem('nexus_org_id', org.id); location.reload() }}><span>{org.name}</span><small>{org.role}</small></button>)}</section>
      <section className="card"><div className="card-header"><div><h2>Profile and security</h2><p className="muted">Your identity, password, MFA, and sessions are managed by Clerk.</p></div><Shield size={18} /></div><a className="button" href="https://accounts.clerk.com/user">Open account security</a></section>
    </div>
    {show && <div className="modal-backdrop" onClick={() => setShow(false)}><div className="card modal-card" onClick={event => event.stopPropagation()}><div className="card-header"><h2>New organization</h2><button className="icon-button" aria-label="Close" onClick={() => setShow(false)}><X size={17} /></button></div><div className="field"><label htmlFor="org-name">Organization name</label><input id="org-name" autoFocus value={name} onChange={event => setName(event.target.value)} /></div><button className="button primary block" disabled={!name.trim()} onClick={() => void create()}>Create organization</button></div></div>}
  </div></AppShell>
}
