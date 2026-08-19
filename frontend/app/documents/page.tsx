'use client'

import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Client, type IMessage } from '@stomp/stompjs'
import AppShell from '../../components/AppShell'
import { Clock, Code2, Eye, FileText, FolderOpen, Italic, Link2, List, ListChecks, ListOrdered, Plus, Quote, Redo2, Save, Share2, Strikethrough, Table2, Trash2, Undo2, Upload, X } from '../../components/icons'
import { API, api, getAuthToken } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'

type Doc = { id: string; title: string; content: string; version: number; created_by?: string; can_manage?: boolean }
type Version = { id: string; version: number; title: string; created_at: string }
type Comment = { id: string; parent_id?: string | null; content: string; resolved: boolean; author_name: string; author_email: string; created_at: string; deleted?: boolean }
type NotifyResult = { recipients: number; sent: number; configured: boolean }
type EditorMode = 'edit' | 'split' | 'preview'

const MAX_IMPORT_BYTES = 2 * 1024 * 1024
const IMPORT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json']

export default function Documents() {
  const { workspace } = useWorkspace()
  const { orgId, teamId } = workspaceIds(workspace)
  const handledRoute = useRef(false)
  const uploadInput = useRef<HTMLInputElement>(null)
  const editorInput = useRef<HTMLTextAreaElement>(null)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [active, setActive] = useState<Doc | null>(null)
  const [saved, setSaved] = useState(true)
  const [history, setHistory] = useState<Version[]>([])
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [online, setOnline] = useState(true)
  const [realtime, setRealtime] = useState<'connecting' | 'connected' | 'offline'>('offline')
  const activeRef = useRef<Doc | null>(null)
  const savedRef = useRef(true)

  const documentStats = useMemo(() => {
    const content = active?.content ?? ''
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    return { words, characters: content.length, minutes: Math.max(1, Math.ceil(words / 220)) }
  }, [active?.content])

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { savedRef.current = saved }, [saved])

  useEffect(() => {
    const connected = () => setOnline(true)
    const disconnected = () => setOnline(false)
    setOnline(navigator.onLine)
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    return () => {
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
    }
  }, [])

  const create = useCallback(async (title = 'Untitled document', content = '') => {
    if (!orgId) return
    setBusy(true)
    setError('')
    try {
      const document = await api<Doc>(`/orgs/${orgId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ title, content, teamId })
      })
      setDocs(items => [document, ...items])
      setActive(document)
      setSaved(true)
      window.history.replaceState({}, '', `/documents?document=${document.id}`)
      return document
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document could not be created.')
      return null
    } finally {
      setBusy(false)
    }
  }, [orgId, teamId])

  useEffect(() => {
    if (!orgId) return
    void api<Doc[]>(`/orgs/${orgId}/documents`).then(items => {
      setDocs(items)
      const selected = new URLSearchParams(window.location.search).get('document')
      if (selected) setActive(items.find(item => item.id === selected) ?? null)
      if (!handledRoute.current && new URLSearchParams(window.location.search).get('new') === '1') {
        handledRoute.current = true
        void create()
      }
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Documents could not be loaded.'))
  }, [create, orgId])

  const update = (document: Doc) => {
    setActive(document)
    setDocs(items => items.map(item => item.id === document.id ? document : item))
    setSaved(false)
  }

  const selectDocument = (document: Doc) => {
    setActive(document)
    setSaved(true)
    setNotice('')
    undoStack.current = []
    redoStack.current = []
    setCanUndo(false)
    setCanRedo(false)
    window.history.replaceState({}, '', `/documents?document=${document.id}`)
  }

  useEffect(() => {
    if (!active?.id) {
      setComments([])
      return
    }
    void api<Comment[]>(`/documents/${active.id}/comments`)
      .then(setComments)
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Comments could not be loaded.'))
  }, [active?.id])

  useEffect(() => {
    if (!active?.id || !online) {
      setRealtime('offline')
      return
    }
    let client: Client | null = null
    let cancelled = false
    setRealtime('connecting')
    void getAuthToken().then(token => {
      if (!token || cancelled) return
      const wsUrl = `${API.replace(/^http/, 'ws').replace(/\/api\/?$/, '')}/ws`
      client = new Client({
        brokerURL: wsUrl,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        heartbeatIncoming: 15000,
        heartbeatOutgoing: 15000,
        onConnect: () => {
          setRealtime('connected')
          client?.subscribe(`/topic/document.${active.id}`, (frame: IMessage) => {
            const incoming = JSON.parse(frame.body) as Doc
            if (incoming.id !== activeRef.current?.id) return
            if (!savedRef.current) {
              setNotice('A teammate saved a newer version. Save is paused to protect both versions; reload this document to reconcile changes.')
              return
            }
            setActive(incoming)
            setDocs(items => items.map(item => item.id === incoming.id ? incoming : item))
          })
          client?.subscribe(`/topic/document.${active.id}.comments`, (frame: IMessage) => {
            const incoming = JSON.parse(frame.body) as Comment
            setComments(items => incoming.deleted
              ? items.filter(item => item.id !== incoming.id && item.parent_id !== incoming.id)
              : items.some(item => item.id === incoming.id)
                ? items.map(item => item.id === incoming.id ? incoming : item)
                : [...items, incoming])
          })
        },
        onWebSocketClose: () => setRealtime('offline'),
        onStompError: () => setRealtime('offline')
      })
      client.activate()
    })
    return () => {
      cancelled = true
      void client?.deactivate()
    }
  }, [active?.id, online])

  const setContent = (content: string, track = true) => {
    if (!active || content === active.content) return
    if (track) {
      undoStack.current = [...undoStack.current.slice(-99), active.content]
      redoStack.current = []
    }
    update({ ...active, content })
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }

  const restoreSelection = (start: number, end: number) => requestAnimationFrame(() => {
    editorInput.current?.focus()
    editorInput.current?.setSelectionRange(start, end)
  })

  const inline = (before: string, after = before, placeholder = 'text') => {
    if (!active) return
    const input = editorInput.current
    const start = input?.selectionStart ?? active.content.length
    const end = input?.selectionEnd ?? start
    const selected = active.content.slice(start, end) || placeholder
    setContent(`${active.content.slice(0, start)}${before}${selected}${after}${active.content.slice(end)}`)
    restoreSelection(start + before.length, start + before.length + selected.length)
  }

  const linePrefix = (prefix: string, placeholder: string) => {
    if (!active) return
    const input = editorInput.current
    const selectionStart = input?.selectionStart ?? active.content.length
    const selectionEnd = input?.selectionEnd ?? selectionStart
    const lineStart = active.content.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
    const nextBreak = active.content.indexOf('\n', selectionEnd)
    const lineEnd = nextBreak === -1 ? active.content.length : nextBreak
    const selected = active.content.slice(lineStart, lineEnd) || placeholder
    const replacement = selected.split('\n').map(line => `${prefix}${line}`).join('\n')
    setContent(`${active.content.slice(0, lineStart)}${replacement}${active.content.slice(lineEnd)}`)
    restoreSelection(lineStart + prefix.length, lineStart + replacement.length)
  }

  const insertBlock = (block: string) => {
    if (!active) return
    const input = editorInput.current
    const start = input?.selectionStart ?? active.content.length
    const spacer = start > 0 && !active.content.slice(0, start).endsWith('\n') ? '\n' : ''
    setContent(`${active.content.slice(0, start)}${spacer}${block}${active.content.slice(start)}`)
    restoreSelection(start + spacer.length, start + spacer.length + block.length)
  }

  const undo = () => {
    if (!active || undoStack.current.length === 0) return
    const previous = undoStack.current.pop()!
    redoStack.current.push(active.content)
    setContent(previous, false)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
  }

  const redo = () => {
    if (!active || redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(active.content)
    setContent(next, false)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
  }

  const editorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const command = event.metaKey || event.ctrlKey
    if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
    if (command && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
    if (command && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); return }
    if (command && event.key.toLowerCase() === 'b') { event.preventDefault(); inline('**'); return }
    if (command && event.key.toLowerCase() === 'i') { event.preventDefault(); inline('_'); return }
    if (command && event.key.toLowerCase() === 'k') { event.preventDefault(); inline('[', '](https://)', 'link text'); return }
    if (event.key === 'Tab') {
      event.preventDefault()
      const start = event.currentTarget.selectionStart
      const end = event.currentTarget.selectionEnd
      setContent(`${active?.content.slice(0, start) ?? ''}  ${active?.content.slice(end) ?? ''}`)
      restoreSelection(start + 2, start + 2)
    }
  }

  const save = async () => {
    if (!active || busy) return
    setBusy(true)
    setError('')
    try {
      const document = await api<Doc>(`/documents/${active.id}`, { method: 'PUT', body: JSON.stringify({ title: active.title, content: active.content, expectedVersion: active.version }) })
      setActive(document)
      setDocs(items => items.map(item => item.id === document.id ? document : item))
      setSaved(true)
      setNotice('Document saved successfully.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const importDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (file.size > MAX_IMPORT_BYTES) return setError('Documents must be 2 MB or smaller.')
    if (!IMPORT_TYPES.includes(file.type) && !['md', 'markdown', 'txt', 'csv', 'json'].includes(extension ?? '')) {
      return setError('Upload a Markdown, text, CSV, or JSON document.')
    }
    const title = file.name.replace(/\.(md|markdown|txt|csv|json)$/i, '').trim() || 'Imported document'
    try {
      const document = await create(title, await file.text())
      if (document) setNotice(`${file.name} was imported into the team workspace.`)
    } catch {
      setError('The selected document could not be read.')
    }
  }

  const removeDocument = async () => {
    if (!active || busy) return
    setBusy(true)
    setError('')
    try {
      await api<void>(`/documents/${active.id}`, { method: 'DELETE' })
      const remaining = docs.filter(item => item.id !== active.id)
      setDocs(remaining)
      setActive(remaining[0] ?? null)
      setDeleteOpen(false)
      setSaved(true)
      setNotice('Document deleted from the workspace.')
      window.history.replaceState({}, '', remaining[0] ? `/documents?document=${remaining[0].id}` : '/documents')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document could not be deleted.')
      setDeleteOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const notifyTeam = async () => {
    if (!active || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api<NotifyResult>(`/documents/${active.id}/notify`, { method: 'POST' })
      setShareOpen(false)
      setNotice(result.configured
        ? `Notification email sent to ${result.sent} of ${result.recipients} authorized team members.`
        : `The document is shared with ${result.recipients} authorized team members. SMTP email is not configured.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Team members could not be notified.')
      setShareOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const showHistory = async () => {
    if (!active) return
    try {
      setHistory(await api<Version[]>(`/documents/${active.id}/versions`))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'History could not be loaded.')
    }
  }

  const restoreVersion = async (version: Version) => {
    if (!active || busy) return
    if (!window.confirm(`Restore version ${version.version}? The current document will be preserved as history.`)) return
    setBusy(true)
    try {
      const document = await api<Doc>(`/documents/${active.id}/versions/${version.id}/restore`, { method: 'POST' })
      setActive(document)
      setDocs(items => items.map(item => item.id === document.id ? document : item))
      setHistory([])
      setSaved(true)
      setNotice(`Version ${version.version} restored as version ${document.version}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Version could not be restored.')
    } finally {
      setBusy(false)
    }
  }

  const addComment = async () => {
    if (!active || !commentBody.trim() || busy) return
    setBusy(true)
    try {
      const input = editorInput.current
      const comment = await api<Comment>(`/documents/${active.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: commentBody.trim(),
          parentId: replyTo?.parent_id ?? replyTo?.id ?? null,
          selectionStart: input?.selectionStart,
          selectionEnd: input?.selectionEnd
        })
      })
      setComments(items => items.some(item => item.id === comment.id) ? items : [...items, comment])
      setCommentBody('')
      setReplyTo(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Comment could not be added.')
    } finally {
      setBusy(false)
    }
  }

  const toggleComment = async (comment: Comment) => {
    if (!active) return
    try {
      const updated = await api<Comment>(`/documents/${active.id}/comments/${comment.id}`, {
        method: 'PATCH', body: JSON.stringify({ resolved: !comment.resolved })
      })
      setComments(items => items.map(item => item.id === updated.id ? updated : item))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Comment could not be updated.')
    }
  }

  const orderedComments = useMemo(() => comments.filter(comment => !comment.parent_id).flatMap(comment => [
    comment,
    ...comments.filter(reply => reply.parent_id === comment.id)
  ]), [comments])

  const exportMarkdown = () => {
    if (!active) return
    const blob = new Blob([`# ${active.title}\n\n${active.content}`], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${active.title || 'document'}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  const printDocument = () => {
    if (!active) return
    const popup = window.open('', '_blank', 'noopener,noreferrer')
    if (!popup) return
    const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character))
    popup.document.write(`<html><head><title>${escape(active.title)}</title></head><body><h1>${escape(active.title)}</h1><pre style="white-space:pre-wrap;font:14px sans-serif">${escape(active.content)}</pre></body></html>`)
    popup.document.close()
    popup.print()
  }

  return <AppShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">KNOWLEDGE BASE</div><h1>Documents</h1><p className="muted">Team-scoped documents with version history, controlled sharing, and Markdown export.</p></div><div className="actions"><input ref={uploadInput} type="file" hidden accept=".md,.markdown,.txt,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={event => void importDocument(event)} /><button className="button" disabled={busy} onClick={() => uploadInput.current?.click()}><Upload size={15} /> Upload</button><button className="button primary" disabled={busy} onClick={() => void create()}><Plus size={15} /> New document</button></div></div>
    {error && <div className="form-error"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
    {notice && <div className="form-success"><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}
    <div className="doc-editor">
      <aside className="card"><div className="card-header"><h2>Documents</h2><FolderOpen size={16} /></div>{docs.length === 0 ? <div className="empty">No documents yet.</div> : docs.map(document => <button className={`nav-item ${active?.id === document.id ? 'active' : ''}`} key={document.id} onClick={() => selectDocument(document)}><FileText size={15} /><span>{document.title || 'Untitled document'}</span>{document.can_manage && <small>MANAGE</small>}</button>)}</aside>
      {active ? <section className="card editor rich-editor">
        <div className="card-header">
          <div className="document-title-block"><input value={active.title} onChange={event => update({ ...active, title: event.target.value })} aria-label="Document title" /><div className="muted">{saved ? 'Saved to workspace' : 'Unsaved changes'} · Version {active.version} · {online ? realtime === 'connected' ? 'Live collaboration connected' : 'Connecting collaboration…' : 'Offline'}</div></div>
          <div className="actions"><button className="button" onClick={() => setShowComments(value => !value)}>Comments ({comments.filter(comment => !comment.resolved).length})</button><button className="button" onClick={() => void showHistory()}><Clock size={15} /> History</button><button className="button" onClick={exportMarkdown}>Markdown</button><button className="button" onClick={printDocument}>Print / PDF</button>{active.can_manage && <button className="button" onClick={() => setShareOpen(true)}><Share2 size={15} /> Notify team</button>}{active.can_manage && <button className="button" aria-label="Delete document" onClick={() => setDeleteOpen(true)}><Trash2 size={15} /> Delete</button>}<button className="button primary" disabled={busy || saved || !online} onClick={() => void save()}><Save size={15} /> Save</button></div>
        </div>
        <div className="editor-commandbar" aria-label="Document formatting toolbar">
          <div className="editor-tool-group"><button className="editor-tool" title="Undo" aria-label="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={15} /></button><button className="editor-tool" title="Redo" aria-label="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={15} /></button></div>
          <div className="editor-tool-group"><button className="editor-tool text-tool" title="Heading 1" onClick={() => linePrefix('# ', 'Heading')}>H1</button><button className="editor-tool text-tool" title="Heading 2" onClick={() => linePrefix('## ', 'Heading')}>H2</button><button className="editor-tool text-tool" title="Heading 3" onClick={() => linePrefix('### ', 'Heading')}>H3</button></div>
          <div className="editor-tool-group"><button className="editor-tool text-tool" title="Bold (Ctrl+B)" onClick={() => inline('**')}>B</button><button className="editor-tool" title="Italic (Ctrl+I)" aria-label="Italic" onClick={() => inline('_')}><Italic size={15} /></button><button className="editor-tool" title="Strikethrough" aria-label="Strikethrough" onClick={() => inline('~~')}><Strikethrough size={15} /></button><button className="editor-tool" title="Inline code" aria-label="Inline code" onClick={() => inline('`')}><Code2 size={15} /></button><button className="editor-tool" title="Link (Ctrl+K)" aria-label="Insert link" onClick={() => inline('[', '](https://)', 'link text')}><Link2 size={15} /></button></div>
          <div className="editor-tool-group"><button className="editor-tool" title="Bulleted list" aria-label="Bulleted list" onClick={() => linePrefix('- ', 'List item')}><List size={15} /></button><button className="editor-tool" title="Numbered list" aria-label="Numbered list" onClick={() => linePrefix('1. ', 'List item')}><ListOrdered size={15} /></button><button className="editor-tool" title="Task list" aria-label="Task list" onClick={() => linePrefix('- [ ] ', 'Task')}><ListChecks size={15} /></button><button className="editor-tool" title="Quote" aria-label="Quote" onClick={() => linePrefix('> ', 'Quote')}><Quote size={15} /></button></div>
          <div className="editor-tool-group"><button className="editor-tool" title="Code block" aria-label="Code block" onClick={() => insertBlock('```\ncode\n```\n')}><Code2 size={15} /></button><button className="editor-tool" title="Table" aria-label="Insert table" onClick={() => insertBlock('| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n')}><Table2 size={15} /></button></div>
          <div className="editor-view-switch" aria-label="Editor view"><button className={`editor-view ${editorMode === 'edit' ? 'selected' : ''}`} onClick={() => setEditorMode('edit')}>Edit</button><button className={`editor-view ${editorMode === 'split' ? 'selected' : ''}`} onClick={() => setEditorMode('split')}>Split</button><button className={`editor-view ${editorMode === 'preview' ? 'selected' : ''}`} onClick={() => setEditorMode('preview')}><Eye size={14} /> Preview</button></div>
        </div>
        <div className={`editor-workspace mode-${editorMode}`}>
          {editorMode !== 'preview' && <textarea ref={editorInput} value={active.content} onChange={event => setContent(event.target.value)} onKeyDown={editorKeyDown} aria-label="Document content" placeholder="Start writing in Markdown…" spellCheck />}
          {editorMode !== 'edit' && <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{active.content || '*Nothing to preview yet.*'}</ReactMarkdown></article>}
        </div>
        <div className="editor-statusbar"><span>{documentStats.words} words</span><span>{documentStats.characters} characters</span><span>{documentStats.minutes} min read</span><span className="shortcut-hint">Ctrl/⌘ + S to save</span></div>
        {showComments && <aside className="card" aria-label="Document comments">
          <div className="card-header"><div><h2>Editorial comments</h2><p className="muted">Threaded feedback stays inside this Nexus workspace.</p></div><button className="icon-button" aria-label="Close comments" onClick={() => setShowComments(false)}><X size={15} /></button></div>
          {replyTo && <div className="form-success"><span>Replying to {replyTo.author_name || replyTo.author_email}</span><button className="icon-button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={14} /></button></div>}
          <div className="actions"><input value={commentBody} onChange={event => setCommentBody(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void addComment() } }} placeholder="Comment or @mention a teammate…" aria-label="Comment" /><button className="button primary" disabled={busy || !commentBody.trim()} onClick={() => void addComment()}>Add comment</button></div>
          {orderedComments.length === 0 ? <div className="empty">No comments yet.</div> : orderedComments.map(comment => <div className="task-row" key={comment.id} style={{ marginLeft: comment.parent_id ? 24 : 0, opacity: comment.resolved ? .65 : 1 }}><div className="task-copy"><strong>{comment.author_name || comment.author_email}</strong><span>{comment.content}</span><small>{new Date(comment.created_at).toLocaleString()} {comment.parent_id ? '· Reply' : ''}</small></div><div className="actions"><button className="button" onClick={() => { setReplyTo(comment); setCommentBody(`@${comment.author_email} `) }}>Reply</button><button className="button" onClick={() => void toggleComment(comment)}>{comment.resolved ? 'Reopen' : 'Resolve'}</button></div></div>)}
        </aside>}
      </section> : <section className="card empty"><FileText size={32} /><p>Select a document, create one, or upload a compatible text file.</p><div className="actions"><button className="button" onClick={() => uploadInput.current?.click()}><Upload size={15} /> Upload</button><button className="button primary" onClick={() => void create()}><Plus size={15} /> New document</button></div></section>}
    </div>
    {history.length > 0 && <div className="modal-backdrop" onClick={() => setHistory([])}><div className="card modal-card" onClick={event => event.stopPropagation()}><div className="card-header"><h2>Version history</h2><button className="icon-button" aria-label="Close history" onClick={() => setHistory([])}><X size={16} /></button></div>{history.map(version => <div className="task-row" key={version.id}><Clock size={15} /><div className="task-copy"><strong>Version {version.version}</strong><small>{version.title} · {new Date(version.created_at).toLocaleString()}</small></div>{active?.can_manage && <button className="button" disabled={busy || version.version === active.version} onClick={() => void restoreVersion(version)}>Restore</button>}</div>)}</div></div>}
    {deleteOpen && active && <div className="modal-backdrop" onClick={() => setDeleteOpen(false)}><div className="card modal-card confirmation-card" role="alertdialog" aria-modal="true" onClick={event => event.stopPropagation()}><div className="eyebrow">DOCUMENT / DELETE</div><h2>Delete “{active.title}”?</h2><p className="muted">This removes the document from the workspace for every team member. Its audit record is retained.</p><div className="actions"><button className="button" onClick={() => setDeleteOpen(false)}>Cancel</button><button className="button danger" disabled={busy} onClick={() => void removeDocument()}><Trash2 size={15} /> Delete document</button></div></div></div>}
    {shareOpen && active && <div className="modal-backdrop" onClick={() => setShareOpen(false)}><div className="card modal-card confirmation-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><div className="eyebrow">DOCUMENT / TEAM ACCESS</div><h2>Notify authorized team members?</h2><p className="muted">The document is already available to members of its Nexus team. Google SMTP will send each authorized member a direct link; it does not bypass workspace permissions.</p><div className="actions"><button className="button" onClick={() => setShareOpen(false)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void notifyTeam()}><Share2 size={15} /> Send notification</button></div></div></div>}
  </div></AppShell>
}
