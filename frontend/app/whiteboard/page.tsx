'use client'

import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Board = { id: string; name: string; data?: { url?: string }; created_at?: string }

export default function WhiteboardPage() {
  const { workspace } = useWorkspace(); const { orgId, teamId } = workspaceIds(workspace); const [boards, setBoards] = useState<Board[]>([]); const [selected, setSelected] = useState<Board | null>(null); const [name, setName] = useState(''); const [error, setError] = useState('')
  const load = async () => { if (orgId) setBoards(await api<Board[]>(`/orgs/${orgId}/whiteboards`)) }
  useEffect(() => { void load().catch(err => setError(err instanceof Error ? err.message : 'Whiteboards could not be loaded.')) }, [orgId])
  const create = async () => { if (!orgId || !name.trim()) return; try { const board = await api<Board>(`/orgs/${orgId}/whiteboards`, { method: 'POST', body: JSON.stringify({ name: name.trim(), teamId }) }); const url = `https://excalidraw.com/#room=${crypto.randomUUID()},nexus-${board.id}`; const saved = await api<Board>(`/orgs/${orgId}/whiteboards/${board.id}`, { method: 'PUT', body: JSON.stringify({ name: board.name, data: { provider: 'excalidraw', url } }) }); setBoards(items => [saved, ...items]); setSelected(saved); setName('') } catch (err) { setError(err instanceof Error ? err.message : 'Whiteboard could not be created.') } }
  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">COLLABORATION / CANVAS</div><h1>Whiteboard</h1><p className="muted">Persistent board records with a free Excalidraw canvas for visual collaboration.</p></div><div className="actions"><input value={name} onChange={event => setName(event.target.value)} placeholder="Board name" aria-label="Board name" /><button className="button primary" onClick={() => void create()}>New board</button></div></div>{error && <div className="form-error">{error}</div>}<div className="grid dashboard-grid"><section className="card"><div className="card-header"><h2>Your boards</h2></div>{boards.length ? boards.map(board => <button className={`nav-item ${selected?.id === board.id ? 'active' : ''}`} key={board.id} onClick={() => setSelected(board)} style={{ width: '100%' }}>{board.name}</button>) : <div className="empty">No boards yet. Create one to get started.</div>}</section><section className="card"><div className="card-header"><h2>{selected?.name ?? 'Select a board'}</h2></div>{selected?.data?.url ? <><p className="muted">Excalidraw is the free canvas provider. Open it in a new tab to avoid third-party iframe restrictions.</p><a className="button primary" href={selected.data.url} target="_blank" rel="noreferrer">Open in Excalidraw</a></> : <div className="empty">Select a board to open its canvas.</div>}</section></div></div></AppShell>
}
