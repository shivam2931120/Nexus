'use client'

import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronRight, Users } from '../../components/icons'
import { api } from '../../lib/api'
import { useWorkspace } from '../../lib/workspace'

const steps = ['Your workspace', 'Invite your team', 'Make it yours']

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { workspace, loading } = useWorkspace()
  const [step, setStep] = useState(0)
  const [workspaceName, setWorkspaceName] = useState('')
  const [invite, setInvite] = useState('')
  const [invites, setInvites] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (isLoaded && !isSignedIn) router.replace('/login?redirect_url=/onboarding') }, [isLoaded, isSignedIn, router])
  useEffect(() => { if (workspace && !workspaceName) setWorkspaceName(workspace.organization.name) }, [workspace, workspaceName])

  const addInvite = () => {
    const email = invite.trim().toLowerCase()
    if (!email || !email.includes('@')) { setError('Enter a valid work email.'); return }
    if (!invites.includes(email)) setInvites(items => [...items, email])
    setInvite(''); setError('')
  }

  const finish = async () => {
    if (!workspace || !workspaceName.trim()) return
    setBusy(true); setError('')
    try {
      await api(`/orgs/${workspace.organization.id}`, { method: 'PATCH', body: JSON.stringify({ name: workspaceName.trim() }) })
      await Promise.all(invites.map(email => api(`/orgs/${workspace.organization.id}/invitations`, { method: 'POST', body: JSON.stringify({ email, role: 'MEMBER' }) })))
      localStorage.setItem('nexus_onboarding_complete', 'true')
      router.replace('/')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Workspace setup could not be saved.') }
    finally { setBusy(false) }
  }

  if (!isLoaded || !isSignedIn || loading) return <main className="auth-loading">Loading secure setup…</main>
  return <div className="auth-page"><div className="auth-card" style={{ width: 'min(620px,100%)' }}><div className="brand"><div className="brand-mark">N</div><span>Nexus</span></div><div className="onboarding-steps">{steps.map((label, index) => <div className={`onboarding-step ${index <= step ? 'done' : ''}`} key={label}><span>{index < step ? <CheckCircle2 size={14}/> : index + 1}</span>{label}</div>)}</div>{error && <div className="form-error" role="alert">{error}</div>}{step === 0 && <><h1>Set up your workspace</h1><p>Give your team a home they’ll recognize.</p><div className="field"><label htmlFor="workspace-name">Workspace name</label><input id="workspace-name" value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} /></div><div className="field"><label htmlFor="workspace-purpose">What are you working on?</label><select id="workspace-purpose"><option>Product development</option><option>Marketing</option><option>Operations</option><option>Community</option></select></div></>}{step === 1 && <><h1>Invite your team</h1><p>Start with the people you collaborate with most. You can always invite more later.</p><div className="invite-row"><Users size={18} color="var(--brand)"/><input type="email" value={invite} onChange={event => setInvite(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addInvite() } }} placeholder="teammate@company.com"/><button className="button" type="button" onClick={addInvite}>Add</button></div>{invites.length ? <div className="onboarding-invites">{invites.map(email => <button type="button" className="button" key={email} onClick={() => setInvites(items => items.filter(item => item !== email))}>{email} ×</button>)}</div> : <div className="empty" style={{ paddingBottom: 5 }}>You can skip this for now.</div>}</>}{step === 2 && <><h1>Make Nexus yours</h1><p>Your workspace, default General team, and secure channels are ready.</p><div className="theme-choice"><div><strong>Use your saved theme</strong><small>You can switch it from the header or Settings.</small></div><CheckCircle2 size={18} color="var(--brand)"/></div><div className="theme-choice"><div><strong>Start with General</strong><small>Includes a default team and #general channel.</small></div><CheckCircle2 size={18} color="var(--brand)"/></div></>}<button className="button primary" disabled={busy || (step === 0 && !workspaceName.trim())} style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} onClick={() => step < 2 ? setStep(step + 1) : void finish()}>{busy ? 'Saving…' : step < 2 ? 'Continue' : 'Open workspace'} <ChevronRight size={15}/></button>{step > 0 && <button className="button" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setStep(step - 1)}>Back</button>}</div></div>
}
