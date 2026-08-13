'use client'

import AppShell from '../../components/AppShell'
import { FolderKanban, Plus } from '../../components/icons'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Project = { id: string; name: string; description: string }

export default function Projects() {
  const { workspace } = useWorkspace(); const { orgId, teamId } = workspaceIds(workspace)
  const [items, setItems] = useState<Project[]>([]); const [show, setShow] = useState(false); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { if (orgId) void api<Project[]>(`/orgs/${orgId}/projects`).then(setItems).catch(err => setError(err instanceof Error ? err.message : 'Projects could not be loaded.')) }, [orgId])
  const create = async () => { if (!name.trim() || !orgId) return; setSaving(true); try { const item = await api<Project>(`/orgs/${orgId}/projects`, { method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim(), teamId }) }); setItems(x => [item, ...x]); setName(''); setDescription(''); setShow(false) } catch (err) { setError(err instanceof Error ? err.message : 'Project could not be created.') } finally { setSaving(false) } }
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">WORKSPACE</div><h1>Projects</h1><p className="muted">Create and organize your team’s work.</p></div><button className="button primary" onClick={() => setShow(true)}><Plus size={15} /> New project</button></div>{error && <div className="form-error">{error}</div>}{items.length === 0 ? <div className="card empty"><FolderKanban size={32} /><p>No projects yet.</p><button className="button primary" onClick={() => setShow(true)}><Plus size={15} /> Create project</button></div> : <div className="grid dashboard-grid">{items.map(p => <div className="card" key={p.id}><div className="card-header"><h2>{p.name}</h2><FolderKanban size={17} /></div><p className="muted">{p.description || 'No description'}</p><a className="button" href={`/tasks?project=${p.id}`}>View tasks</a></div>)}</div>}{show && <div className="modal-backdrop"><div className="card modal-card"><div className="card-header"><h2>New project</h2><button className="icon-button" onClick={() => setShow(false)}>×</button></div><div className="field"><label htmlFor="project-name">Project name</label><input id="project-name" autoFocus value={name} onChange={e => setName(e.target.value)} /></div><div className="field"><label htmlFor="project-description">Description</label><textarea id="project-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this project responsible for?" /></div><button className="button primary" disabled={saving} onClick={() => void create()}>{saving ? 'Creating…' : 'Create project'}</button></div></div>}</div></AppShell>
}
