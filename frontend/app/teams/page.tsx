'use client'

import AppShell from '../../components/AppShell'
import { MessageCircle, Plus, Users } from '../../components/icons'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Team = { id: string; name: string; description?: string }

export default function TeamsPage() {
  const { workspace } = useWorkspace(); const { orgId } = workspaceIds(workspace); const [teams, setTeams] = useState<Team[]>([]); const [show, setShow] = useState(false); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [error, setError] = useState('')
  useEffect(() => { if (orgId) void api<Team[]>(`/orgs/${orgId}/teams`).then(setTeams).catch(err => setError(err instanceof Error ? err.message : 'Teams could not be loaded.')) }, [orgId])
  const create = async () => { if (!orgId || !name.trim()) return; try { const team = await api<Team>(`/orgs/${orgId}/teams`, { method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim() }) }); setTeams(items => [...items, team]); setName(''); setDescription(''); setShow(false) } catch (err) { setError(err instanceof Error ? err.message : 'Team could not be created.') } }
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">ORGANIZATION</div><h1>Teams</h1><p className="muted">Create focused teams with their own channels and work.</p></div><button className="button primary" onClick={() => setShow(true)}><Plus size={15} /> New team</button></div>{error && <div className="form-error">{error}</div>}<div className="grid dashboard-grid">{teams.length === 0 ? <div className="card empty"><Users size={32} /><p>No teams yet.</p></div> : teams.map(team => <article className="card" key={team.id}><div className="card-header"><h2>{team.name}</h2><Users size={18} /></div><p className="muted">{team.description || 'No description'}</p><div className="actions"><a className="button" href={`/chat?team=${team.id}`}><MessageCircle size={15} /> Channels</a><a className="button" href={`/tasks?team=${team.id}`}>Tasks</a></div></article>)}</div>{show && <div className="modal-backdrop"><div className="card modal-card"><div className="card-header"><h2>New team</h2><button className="icon-button" onClick={() => setShow(false)}>×</button></div><div className="field"><label htmlFor="team-name">Team name</label><input id="team-name" autoFocus value={name} onChange={e => setName(e.target.value)} /></div><div className="field"><label htmlFor="team-description">Description</label><textarea id="team-description" value={description} onChange={e => setDescription(e.target.value)} /></div><button className="button primary" onClick={() => void create()}>Create team</button></div></div>}</div></AppShell>
}
