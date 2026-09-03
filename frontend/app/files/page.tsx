'use client'

import AppShell from '../../components/AppShell'
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Grid2X2, List, MoreHorizontal, RefreshCw, Search, Upload, X } from '../../components/icons'
import { api, uploadFile } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type FileItem = { id: string; name: string; mime_type: string; size_bytes: number; created_at: string; current_version:number; folder_id?:string|null }
type FolderItem = { id:string; name:string; parent_id?:string|null }
type Version = {id:string;version_number:number;size_bytes:number;created_at:string}
type SharedLink = {id:string;token:string;expires_at?:string|null;download_count:number;revoked_at?:string|null}
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
  const [folders,setFolders]=useState<FolderItem[]>([]); const [folderId,setFolderId]=useState<string|null>(null); const [folderName,setFolderName]=useState(''); const [versions,setVersions]=useState<Version[]>([]); const [links,setLinks]=useState<SharedLink[]>([]); const [previewUrl,setPreviewUrl]=useState(''); const [notice,setNotice]=useState(''); const [pendingDelete,setPendingDelete]=useState<FileItem|null>(null); const [openError,setOpenError]=useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    if (orgId) { const [fileItems,folderItems]=await Promise.all([api<FileItem[]>(`/orgs/${orgId}/files${folderId?`?folderId=${folderId}`:''}`),api<FolderItem[]>(`/orgs/${orgId}/folders${folderId?`?parentId=${folderId}`:''}`)]);setFiles(fileItems);setFolders(folderItems) }
  }
  useEffect(() => { void load().catch(err => setNotice(err instanceof Error ? err.message : 'Files could not be loaded.')) }, [orgId,folderId])

  const upload = async (incoming: File[]) => {
    if (!orgId || incoming.length === 0) return
    setBusy(true)
    try {
      for (const file of incoming) {
        const item = await uploadFile<FileItem>(`/orgs/${orgId}/files/upload`, file, { ...(teamId?{teamId}:{}), ...(folderId?{folderId}:{}) })
        setFiles(current => [item, ...current])
      }
    } catch (err) { setNotice(err instanceof Error ? err.message : 'The upload could not be completed.') } finally { setBusy(false) }
  }
  const choose = (event: ChangeEvent<HTMLInputElement>) => { void upload(Array.from(event.target.files ?? [])); event.target.value = '' }
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)) }
  const remove = async () => {
    if (!pendingDelete) return
    const file = pendingDelete
    try { await api(`/files/${file.id}`, { method: 'DELETE' }); setFiles(current => current.filter(item => item.id !== file.id)); if (selected?.id === file.id) setSelected(null); setPendingDelete(null); setNotice('File deleted.') } catch (err) { setNotice(err instanceof Error ? err.message : 'File could not be deleted.') }
  }
  const openFile = async (file: FileItem) => {
    try {
      const result = await api<{ url: string }>(`/files/${file.id}/download`)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : 'The file could not be opened.')
    }
  }
  const createFolder=async()=>{if(!orgId||!folderName.trim())return;try{const item=await api<FolderItem>(`/orgs/${orgId}/folders`,{method:'POST',body:JSON.stringify({name:folderName.trim(),parentId:folderId,teamId})});setFolders(current=>[...current,item]);setFolderName('');setNotice('Folder created.')}catch(err){setNotice(err instanceof Error?err.message:'Folder could not be created.')}}
  const inspect=async(file:FileItem)=>{setSelected(file);setPreviewUrl('');try{const [history,download,shared]=await Promise.all([api<Version[]>(`/files/${file.id}/versions`),api<{url:string}>(`/files/${file.id}/download`),api<SharedLink[]>(`/files/${file.id}/shared-links`)]);setVersions(history);setLinks(shared);if(file.mime_type.startsWith('image/')||file.mime_type==='application/pdf')setPreviewUrl(download.url)}catch{setVersions([]);setLinks([])}}
  const share=async(file:FileItem)=>{try{const link=await api<{path:string}>(`/files/${file.id}/share`,{method:'POST',body:JSON.stringify({expiresAt:new Date(Date.now()+7*86400000).toISOString(),maxDownloads:100})});const url=`${window.location.origin}${link.path}`;try{await navigator.clipboard.writeText(url);setNotice('A seven-day shared link was copied to the clipboard.')}catch{setNotice(`Shared link created: ${url}`)}setLinks(await api<SharedLink[]>(`/files/${file.id}/shared-links`))}catch(err){setNotice(err instanceof Error?err.message:'A shared link could not be created.')}}
  const revokeLink=async(link:SharedLink)=>{try{await api(`/shared-links/${link.id}`,{method:'DELETE'});setLinks(items=>items.map(item=>item.id===link.id?{...item,revoked_at:new Date().toISOString()}:item));setNotice('Shared link revoked.')}catch(err){setNotice(err instanceof Error?err.message:'Shared link could not be revoked.')}}
  const uploadVersion=async(file:File,original:FileItem)=>{setBusy(true);try{const updated=await uploadFile<FileItem>(`/files/${original.id}/versions`,file);setFiles(items=>items.map(item=>item.id===original.id?{...item,...updated}:item));await inspect({...original,...updated});setNotice(`Version ${updated.current_version} uploaded.`)}catch(err){setNotice(err instanceof Error?err.message:'Version could not be uploaded.')}finally{setBusy(false)}}

  const visible = useMemo(() => files.filter(file => file.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || typeOf(file) === filter)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.size_bytes - a.size_bytes : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [files, filter, query, sort])
  const totalBytes = files.reduce((sum, file) => sum + file.size_bytes, 0)
  const filters: Array<[Filter, string]> = [['all', 'All files'], ['documents', 'Documents'], ['images', 'Images'], ['archives', 'Archives'], ['other', 'Other']]

  return <AppShell><div className="page nexus-files-page">
    <div className="page-heading nexus-files-heading"><div><div className="eyebrow">TEAM STORAGE / OBJECTS</div><h1>File Drive</h1><p className="muted">Organization-scoped files with secure uploads and a clear audit trail.</p></div><div className="actions"><button className="button" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button><label className="button primary" htmlFor="file-upload"><Upload size={15} />{busy ? 'Uploading…' : 'Upload files'}</label><input ref={inputRef} id="file-upload" type="file" multiple hidden onChange={choose} /></div></div>
    {notice&&<div className="form-success">{notice}</div>}<div className="nexus-file-metrics"><div><strong>{files.length}</strong><span>FILES IN FOLDER</span></div><div><strong>{formatSize(totalBytes)}</strong><span>STORAGE USED</span></div><div><strong>{folders.length}</strong><span>FOLDERS</span></div></div>
    <div className={`card nexus-file-surface ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <div className="nexus-file-toolbar"><div className="search nexus-file-search"><Search size={15} /><input aria-label="Search files" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search files" />{query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div><div className="actions"><select aria-label="Sort files" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="size">Largest first</option></select><button className={`icon-button ${view === 'grid' ? 'selected' : ''}`} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={16} /></button><button className={`icon-button ${view === 'list' ? 'selected' : ''}`} onClick={() => setView('list')} aria-label="List view"><List size={16} /></button></div></div>
      <div className="nexus-file-filters">{folderId&&<button onClick={()=>setFolderId(null)}>← Root</button>}{folders.map(folder=><button key={folder.id} onClick={()=>setFolderId(folder.id)}>📁 {folder.name}</button>)}<div className="inline-form"><input value={folderName} onChange={event=>setFolderName(event.target.value)} placeholder="New folder"/><button className="button" onClick={()=>void createFolder()}>Create</button></div></div><div className="nexus-file-filters">{filters.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}<span>{value === 'all' ? files.length : files.filter(file => typeOf(file) === value).length}</span></button>)}</div>
      {visible.length === 0 ? <div className="nexus-file-empty"><Upload size={30} /><strong>{files.length === 0 ? 'Drop files here to begin.' : 'No matching files.'}</strong><p>{files.length === 0 ? 'Upload documents, images, or archives to your workspace.' : 'Try another search or filter.'}</p>{files.length === 0 && <label className="button primary" htmlFor="file-upload"><Upload size={15} /> Choose files</label>}</div> : view === 'grid' ? <div className="file-grid nexus-file-grid">{visible.map(file => <article className={`file-card nexus-file-card ${selected?.id === file.id ? 'selected' : ''}`} key={file.id} onClick={() => void inspect(file)}><div className="file-icon"><FileText size={28} /></div><strong title={file.name}>{file.name}</strong><small className="muted">{file.mime_type} · {formatSize(file.size_bytes)} · v{file.current_version||1}</small><button className="icon-button file-menu" onClick={event => { event.stopPropagation(); setPendingDelete(file) }} aria-label={`Delete ${file.name}`}><MoreHorizontal size={16} /></button></article>)}</div> : <div className="nexus-file-list">{visible.map(file => <div className={`task-row nexus-file-row ${selected?.id === file.id ? 'selected' : ''}`} key={file.id} onClick={() => void inspect(file)}><div className="file-icon small"><FileText size={18} /></div><div className="task-copy"><strong>{file.name}</strong><small>{file.mime_type} · {formatSize(file.size_bytes)} · v{file.current_version||1}</small></div><button className="icon-button" onClick={event => { event.stopPropagation(); setPendingDelete(file) }} aria-label={`Delete ${file.name}`}><MoreHorizontal size={16} /></button></div>)}</div>}
      {dragging && <div className="nexus-drop-overlay"><Upload size={24} /><strong>Release to upload</strong></div>}
    </div>
    {selected && <aside className="nexus-file-inspector card"><div className="card-header"><h2>Object details</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={16} /></button></div>{previewUrl&&(selected.mime_type.startsWith('image/')?<img className="file-preview" src={previewUrl} alt={selected.name}/>:<iframe className="file-preview" src={previewUrl} title={selected.name}/>)}<strong>{selected.name}</strong><dl><div><dt>TYPE</dt><dd>{selected.mime_type}</dd></div><div><dt>SIZE</dt><dd>{formatSize(selected.size_bytes)}</dd></div><div><dt>VERSIONS</dt><dd>{versions.length||selected.current_version||1}</dd></div></dl><div className="actions"><button className="button primary" onClick={() => void openFile(selected)}>Open / download</button><button className="button" onClick={() => void share(selected)}>Share link</button><label className="button" htmlFor="version-upload"><Upload size={14}/> New version</label><input id="version-upload" type="file" hidden onChange={event => {const file=event.target.files?.[0];if(file)void uploadVersion(file,selected);event.target.value=''}}/><button className="button" onClick={() => setPendingDelete(selected)}>Delete</button></div><section className="file-history"><h3>Version history</h3>{versions.map(version=><div className="task-row" key={version.id}><div className="task-copy"><strong>Version {version.version_number}</strong><small>{formatSize(version.size_bytes)} · {new Date(version.created_at).toLocaleString()}</small></div></div>)}</section><section className="file-history"><h3>Shared links</h3>{links.length===0?<p className="muted">No active links.</p>:links.map(link=><div className="task-row" key={link.id}><div className="task-copy"><strong>{link.revoked_at?'Revoked':'Active link'}</strong><small>{link.download_count} downloads · {link.expires_at?`Expires ${new Date(link.expires_at).toLocaleDateString()}`:'No expiry'}</small></div>{!link.revoked_at&&<button className="button" onClick={()=>void revokeLink(link)}>Revoke</button>}</div>)}</section></aside>}
    {openError && <div className="modal-backdrop" onClick={() => setOpenError('')}><div className="card modal-card confirmation-card" role="alertdialog" aria-modal="true" onClick={event => event.stopPropagation()}><div className="eyebrow">FILE DRIVE / ERROR</div><h2>File could not be opened</h2><p className="muted">{openError}</p><button className="button primary" onClick={() => setOpenError('')}>Close</button></div></div>}
    {pendingDelete && <div className="modal-backdrop" onClick={() => setPendingDelete(null)}><div className="card modal-card confirmation-card" role="alertdialog" aria-modal="true" onClick={event => event.stopPropagation()}><div className="eyebrow">FILE DRIVE / DELETE</div><h2>Delete “{pendingDelete.name}”?</h2><p className="muted">This removes the file from the current workspace view. Existing signed links will stop working.</p><div className="actions"><button className="button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="button danger" onClick={() => void remove()}>Delete file</button></div></div></div>}
  </div></AppShell>
}
