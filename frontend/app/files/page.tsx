'use client'

import AppShell from '../../components/AppShell'
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Grid2X2, List, MoreHorizontal, RefreshCw, Search, Upload, X } from '../../components/icons'
import { api, uploadFile } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type FileItem = { id: string; name: string; mime_type: string; size_bytes: number; created_at: string }
type Filter = 'all' | 'documents' | 'images' | 'archives' | 'other'

function typeOf(file: FileItem): Filter {
  if (file.mime_type.startsWith('image/')) return 'images'
  if (file.mime_type.includes('zip') || file.mime_type.includes('compressed') || /\.(zip|tar|gz|rar)$/i.test(file.name)) return 'archives'
  if (file.mime_type.startsWith('text/') || file.mime_type.includes('pdf') || file.mime_type.includes('document') || /\.(md|docx?|xlsx?|pptx?)$/i.test(file.name)) return 'documents'
  return 'other'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FilesPage() {
  const { workspace } = useWorkspace()
  const { orgId, teamId } = workspaceIds(workspace)
  const [files, setFiles] = useState<FileItem[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<'newest' | 'name' | 'size'>('newest')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<FileItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    if (orgId) setFiles(await api<FileItem[]>(`/orgs/${orgId}/files`))
  }
  useEffect(() => { void load().catch(() => {}) }, [orgId])

  const upload = async (incoming: File[]) => {
    if (!orgId || incoming.length === 0) return
    setBusy(true)
    try {
      for (const file of incoming) {
        const item = await uploadFile<FileItem>(`/orgs/${orgId}/files/upload`, file, { teamId })
        setFiles(current => [item, ...current])
      }
    } finally { setBusy(false) }
  }
  const choose = (event: ChangeEvent<HTMLInputElement>) => { void upload(Array.from(event.target.files ?? [])); event.target.value = '' }
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)) }
  const remove = async (file: FileItem) => {
    if (!window.confirm(`Delete ${file.name}?`)) return
    await api(`/files/${file.id}`, { method: 'DELETE' })
    setFiles(current => current.filter(item => item.id !== file.id))
    if (selected?.id === file.id) setSelected(null)
  }
  const openFile = async (file: FileItem) => {
    try {
      const result = await api<{ url: string }>(`/files/${file.id}/download`)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'The file could not be opened.')
    }
  }

  const visible = useMemo(() => files.filter(file => file.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || typeOf(file) === filter)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.size_bytes - a.size_bytes : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [files, filter, query, sort])
  const totalBytes = files.reduce((sum, file) => sum + file.size_bytes, 0)
  const filters: Array<[Filter, string]> = [['all', 'All files'], ['documents', 'Documents'], ['images', 'Images'], ['archives', 'Archives'], ['other', 'Other']]

  return <AppShell><div className="page forge-files-page">
    <div className="page-heading forge-files-heading"><div><div className="eyebrow">TEAM STORAGE / OBJECTS</div><h1>File Drive</h1><p className="muted">Organization-scoped files with secure uploads and a clear audit trail.</p></div><div className="actions"><button className="button" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button><label className="button primary" htmlFor="file-upload"><Upload size={15} />{busy ? 'Uploading…' : 'Upload files'}</label><input ref={inputRef} id="file-upload" type="file" multiple hidden onChange={choose} /></div></div>
    <div className="forge-file-metrics"><div><strong>{files.length}</strong><span>FILES IN WORKSPACE</span></div><div><strong>{formatSize(totalBytes)}</strong><span>STORAGE USED</span></div><div><strong>{files.filter(file => typeOf(file) === 'documents').length}</strong><span>DOCUMENT OBJECTS</span></div></div>
    <div className={`card forge-file-surface ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <div className="forge-file-toolbar"><div className="search forge-file-search"><Search size={15} /><input aria-label="Search files" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search files" />{query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div><div className="actions"><select aria-label="Sort files" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="size">Largest first</option></select><button className={`icon-button ${view === 'grid' ? 'selected' : ''}`} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={16} /></button><button className={`icon-button ${view === 'list' ? 'selected' : ''}`} onClick={() => setView('list')} aria-label="List view"><List size={16} /></button></div></div>
      <div className="forge-file-filters">{filters.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}<span>{value === 'all' ? files.length : files.filter(file => typeOf(file) === value).length}</span></button>)}</div>
      {visible.length === 0 ? <div className="forge-file-empty"><Upload size={30} /><strong>{files.length === 0 ? 'Drop files here to begin.' : 'No matching files.'}</strong><p>{files.length === 0 ? 'Upload documents, images, or archives to your workspace.' : 'Try another search or filter.'}</p>{files.length === 0 && <label className="button primary" htmlFor="file-upload"><Upload size={15} /> Choose files</label>}</div> : view === 'grid' ? <div className="file-grid forge-file-grid">{visible.map(file => <article className={`file-card forge-file-card ${selected?.id === file.id ? 'selected' : ''}`} key={file.id} onClick={() => setSelected(file)}><div className="file-icon"><FileText size={28} /></div><strong title={file.name}>{file.name}</strong><small className="muted">{file.mime_type} · {formatSize(file.size_bytes)}</small><button className="icon-button file-menu" onClick={event => { event.stopPropagation(); void remove(file) }} aria-label={`Delete ${file.name}`}><MoreHorizontal size={16} /></button></article>)}</div> : <div className="forge-file-list">{visible.map(file => <div className={`task-row forge-file-row ${selected?.id === file.id ? 'selected' : ''}`} key={file.id} onClick={() => setSelected(file)}><div className="file-icon small"><FileText size={18} /></div><div className="task-copy"><strong>{file.name}</strong><small>{file.mime_type} · {formatSize(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString()}</small></div><button className="icon-button" onClick={event => { event.stopPropagation(); void remove(file) }} aria-label={`Delete ${file.name}`}><MoreHorizontal size={16} /></button></div>)}</div>}
      {dragging && <div className="forge-drop-overlay"><Upload size={24} /><strong>Release to upload</strong></div>}
    </div>
    {selected && <aside className="forge-file-inspector card"><div className="card-header"><h2>Object details</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={16} /></button></div><div className="forge-inspector-icon"><FileText size={30} /></div><strong>{selected.name}</strong><dl><div><dt>TYPE</dt><dd>{selected.mime_type}</dd></div><div><dt>SIZE</dt><dd>{formatSize(selected.size_bytes)}</dd></div><div><dt>ADDED</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div></dl><div className="actions"><button className="button primary" onClick={() => void openFile(selected)}>Open / download</button><button className="button" onClick={() => void remove(selected)}>Delete object</button></div></aside>}
  </div></AppShell>
}
