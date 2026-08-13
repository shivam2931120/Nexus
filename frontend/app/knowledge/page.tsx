'use client'

import AppShell from '../../components/AppShell'
import { BookOpen, ChevronRight, FileText, Plus, Save, Search } from '../../components/icons'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type PageItem = { id: string; title: string; content: string; parent_id?: string | null; visibility: string; updated_at: string }

export default function KnowledgePage() {
  const { workspace } = useWorkspace()
  const { orgId, teamId } = workspaceIds(workspace)
  const [pages, setPages] = useState<PageItem[]>([])
  const [selected, setSelected] = useState<PageItem | null>(null)
  const [show, setShow] = useState(false)
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => { if (orgId) setPages(await api<PageItem[]>(`/orgs/${orgId}/knowledge`)) }
  useEffect(() => { void load().catch(err => setError(err instanceof Error ? err.message : 'Knowledge pages could not be loaded.')) }, [orgId])
  const visible = useMemo(() => pages.filter(page => `${page.title} ${page.content}`.toLowerCase().includes(query.toLowerCase())), [pages, query])
  const create = async () => { if (!orgId || !title.trim()) return; setSaving(true); setError(''); try { const page = await api<PageItem>(`/orgs/${orgId}/knowledge`, { method: 'POST', body: JSON.stringify({ title: title.trim(), content: '', teamId, visibility: 'ORG' }) }); setPages(items => [page, ...items]); setSelected(page); setTitle(''); setShow(false) } catch (err) { setError(err instanceof Error ? err.message : 'Page could not be created.') } finally { setSaving(false) } }
  const save = async () => { if (!selected) return; setSaving(true); try { const page = await api<PageItem>(`/knowledge/${selected.id}`, { method: 'PUT', body: JSON.stringify({ title: selected.title, content: selected.content, parentId: selected.parent_id, visibility: selected.visibility }) }); setSelected(page); setPages(items => items.map(item => item.id === page.id ? page : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Page could not be saved.') } finally { setSaving(false) } }
  const remove = async () => { if (!selected || !window.confirm(`Delete ${selected.title}?`)) return; try { await api(`/knowledge/${selected.id}`, { method: 'DELETE' }); setPages(items => items.filter(item => item.id !== selected.id)); setSelected(null) } catch (err) { setError(err instanceof Error ? err.message : 'Page could not be deleted.') } }

  return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">KNOWLEDGE BASE</div><h1>Knowledge Base</h1><p className="muted">Persisted workspace pages with search and organization visibility.</p></div><button className="button primary" type="button" onClick={() => setShow(true)}><Plus size={15} /> New page</button></div>{error && <div className="form-error">{error}</div>}<div className="knowledge-layout"><aside className="card"><div className="search" style={{ marginBottom: 16, background: 'var(--surface)' }}><Search size={15} /><input aria-label="Search knowledge" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search knowledge" /></div>{visible.length === 0 ? <div className="empty">No pages yet.</div> : visible.map(page => <button key={page.id} className={`nav-item ${selected?.id === page.id ? 'active' : ''}`} style={{ width: '100%' }} onClick={() => setSelected(page)}><BookOpen size={15} /><span>{page.title}</span><ChevronRight size={14} /></button>)}</aside><article className="card knowledge-article">{selected ? <><div className="card-header"><div><div className="eyebrow">WORKSPACE PAGE</div><input value={selected.title} onChange={event => setSelected({ ...selected, title: event.target.value })} aria-label="Page title" style={{ fontSize: 24, fontWeight: 600, border: 0, outline: 0, background: 'transparent', color: 'var(--text)', width: '100%' }} /></div><div className="actions"><button className="button" onClick={() => void remove()}>Delete</button><button className="button primary" disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button></div></div><select value={selected.visibility} onChange={event => setSelected({ ...selected, visibility: event.target.value })} aria-label="Page visibility"><option value="PRIVATE">Private</option><option value="ORG">Organization</option><option value="PUBLIC">Public link</option></select><textarea value={selected.content} onChange={event => setSelected({ ...selected, content: event.target.value })} aria-label="Page content" placeholder="Write practical guidance, decisions, and links for your team." style={{ width: '100%', minHeight: 360, marginTop: 18, resize: 'vertical' }} /><small className="muted">Updated {new Date(selected.updated_at).toLocaleString()}</small></> : <div className="empty"><FileText size={32} /><p>Select a page or create one.</p><button className="button primary" type="button" onClick={() => setShow(true)}><Plus size={15} /> New page</button></div>}</article></div>{show && <div className="modal-backdrop"><div className="card modal-card"><div className="card-header"><h2>New knowledge page</h2><button className="icon-button" type="button" onClick={() => setShow(false)}>×</button></div><div className="field"><label htmlFor="page-title">Page title</label><input id="page-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => event.key === 'Enter' && void create()} placeholder="Engineering handbook" /></div><button className="button primary" disabled={saving} type="button" onClick={() => void create()}>{saving ? 'Creating…' : 'Create page'}</button></div></div>}</div></AppShell>
}
