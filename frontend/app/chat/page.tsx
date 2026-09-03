'use client'

import AppShell from '../../components/AppShell'
import { FormEvent, useEffect, useState } from 'react'
import { Menu, MessageCircle, Paperclip, Plus, Search, Shield, Users } from '../../components/icons'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'
import { Client, type IMessage } from '@stomp/stompjs'
import { useAuth, useUser } from '@clerk/nextjs'

type Channel = { id: string; name: string; type: string; team_id: string }
type Message = { id: string; content: string; sender_name: string; sender_id?: string; parent_id?: string | null; created_at: string; edited_at?: string | null; status?: string; scheduled_at?: string; pinned?: boolean; thread_count?: number; reactions?: Record<string, number> }
type Receipt = { user_id: string; name: string; last_read_at?: string | null }

export default function Chat() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { workspace } = useWorkspace()
  const { orgId, teamId } = workspaceIds(workspace)
  const [channels, setChannels] = useState<Channel[]>([])
  const [active, setActive] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [realtime, setRealtime] = useState<'connecting' | 'connected' | 'offline'>('offline')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [scheduleAt, setScheduleAt] = useState('')
  const [showChannels, setShowChannels] = useState(false)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const currentName = user?.fullName ?? user?.firstName ?? 'Nexus user'
  const canModerate = ['OWNER', 'ADMIN'].includes(workspace?.organization.role ?? '')

  useEffect(() => {
    if (orgId) void api<Channel[]>(`/orgs/${orgId}/channels`).then(items => {
      const requestedTeam = new URLSearchParams(window.location.search).get('team')
      setChannels(items)
      setActive((requestedTeam ? items.find(item => item.team_id === requestedTeam) : null) ?? items[0] ?? null)
    }).catch(err => setError(err instanceof Error ? err.message : 'Channels could not be loaded.'))
  }, [orgId])
  useEffect(() => {
    if (!active) return
    void Promise.all([api<Message[]>(`/channels/${active.id}/messages/enriched`), api<Receipt[]>(`/channels/${active.id}/read-receipts`)]).then(([items, readItems]) => { setMessages(items.map(item => item.sender_name === 'Clerk user' ? { ...item, sender_name: currentName } : item)); setReceipts(readItems); void api(`/channels/${active.id}/read`, { method: 'PUT' }) }).catch(err => setError(err instanceof Error ? err.message : 'Messages could not be loaded.'))
  }, [active, currentName])

  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'
    const wsUrl = `${apiUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, '')}/ws`
    const client = new Client({
      brokerURL: wsUrl,
      beforeConnect: async () => {
        const token = await getToken()
        if (!token) throw new Error('Your session has expired. Please sign in again.')
        client.connectHeaders = { Authorization: `Bearer ${token}` }
      },
      reconnectDelay: 5000,
      onConnect: () => {
        setRealtime('connected')
        client.subscribe(`/topic/channel.${active.id}`, (frame: IMessage) => {
          const incoming = JSON.parse(frame.body) as Message & { createdAt?: string; senderName?: string }
          setMessages(items => items.some(item => item.id === incoming.id) ? items : [...items, {
            id: incoming.id,
            content: incoming.content,
            created_at: incoming.created_at ?? incoming.createdAt ?? new Date().toISOString(),
            sender_name: incoming.sender_name ?? incoming.senderName ?? currentName,
          }])
        })
      },
      onWebSocketClose: () => setRealtime('offline'),
      onWebSocketError: () => setRealtime('offline'),
      onStompError: () => setRealtime('offline'),
    })
    setRealtime('connecting')
    client.activate()
    return () => { void client.deactivate(); setRealtime('offline') }
  }, [active, currentName, getToken])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!active || !text.trim()) return
    setError('')
    try {
      const message = scheduleAt ? await api<Message>(`/channels/${active.id}/messages/schedule`, { method: 'POST', body: JSON.stringify({ content: text.trim(), parentId: replyTo?.id, scheduledAt: new Date(scheduleAt).toISOString() }) }) : await api<Message>(`/channels/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ content: text.trim(), parentId: replyTo?.id }) })
      setMessages(items => items.some(item => item.id === message.id) ? items : [...items, { ...message, sender_name: message.sender_name === 'Clerk user' ? currentName : message.sender_name }])
      setText(''); setReplyTo(null); setScheduleAt('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be sent.') }
  }
  const create = async () => {
    if (!orgId || !name.trim()) return
    try {
      const channel = await api<Channel>(`/orgs/${orgId}/channels`, { method: 'POST', body: JSON.stringify({ name: name.trim().replace(/^#/, '').toLowerCase(), teamId, type: 'PUBLIC' }) })
      setChannels(items => [...items, channel]); setActive(channel); setName(''); setShow(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Channel could not be created.') }
  }
  const react = async (message: Message, emoji = '👍') => { if (!active) return; try { await api(`/channels/${active.id}/messages/${message.id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }); const updated = await api<Message[]>(`/channels/${active.id}/messages/enriched`); setMessages(updated.map(item => item.sender_name === 'Clerk user' ? { ...item, sender_name: currentName } : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Reaction could not be saved.') } }
  const pin = async (message: Message) => { if (!active) return; try { await api(`/channels/${active.id}/messages/${message.id}/${message.pinned ? 'unpin' : 'pin'}`, { method: message.pinned ? 'DELETE' : 'POST' }); setMessages(items => items.map(item => item.id === message.id ? { ...item, pinned: !item.pinned } : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Message pin could not be changed.') } }
  const edit = async (message: Message) => { const content = window.prompt('Edit message', message.content); if (!active || content === null || !content.trim()) return; try { const updated = await api<Message>(`/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ content: content.trim() }) }); setMessages(items => items.map(item => item.id === message.id ? { ...item, ...updated, content: updated.content ?? content.trim() } : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be edited.') } }
  const remove = async (message: Message) => { if (!window.confirm('Delete this message?')) return; try { await api(`/messages/${message.id}`, { method: 'DELETE' }); setMessages(items => items.filter(item => item.id !== message.id)) } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be deleted.') } }
  const moderate = async (message: Message) => { if (!active || !canModerate) return; const action = message.status === 'MODERATED' ? 'RESTORE' : 'HIDE'; const reason = window.prompt(action === 'HIDE' ? 'Reason for hiding this message' : 'Reason for restoring this message', '') ?? ''; try { await api(`/messages/${message.id}/moderate`, { method: 'POST', body: JSON.stringify({ action, reason }) }); setMessages(items => action === 'HIDE' ? items.filter(item => item.id !== message.id) : items.map(item => item.id === message.id ? { ...item, status: 'SENT' } : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Moderation action could not be saved.') } }

  return <AppShell><div className="chat-layout"><aside className={`chat-list ${showChannels ? 'mobile-visible' : ''}`}><div className="card-header"><h2>Messages</h2><button className="icon-button" onClick={() => setShow(true)} aria-label="New channel"><Plus size={16} /></button></div><div className="search" style={{ marginBottom: 14 }}><Search size={14} /><span>Find a channel</span></div>{channels.map(channel => <button className={`nav-item ${active?.id === channel.id ? 'active' : ''}`} key={channel.id} onClick={() => { setActive(channel); setShowChannels(false) }}><MessageCircle size={15} /><span># {channel.name}</span></button>)}</aside><section className="chat-main"><header className="chat-header"><div className="chat-header-title"><button className="icon-button mobile-chat-toggle" aria-label="Show channels" onClick={() => setShowChannels(true)}><Menu size={17} /></button><div><h2># {active?.name ?? 'general'}</h2><span className="muted">Organization channel · {realtime === 'connected' ? 'live' : realtime === 'connecting' ? 'connecting' : 'offline'} · {receipts.filter(item => item.last_read_at).length} read</span></div></div><div className="actions"><Users size={17} />{canModerate && <span aria-label="Moderation enabled" title="Moderation enabled"><Shield size={16} /></span>}</div></header>{error && <div className="form-error nexus-chat-error">{error}</div>}<div className="messages">{messages.length === 0 ? <div className="empty"><MessageCircle size={28} /><p>No messages in this channel yet.</p></div> : messages.map(message => <div className={`message ${message.parent_id ? 'thread-reply' : ''}`} key={message.id}><span className="avatar">{message.sender_name?.slice(0, 1).toUpperCase()}</span><div className="message-body"><div className="message-meta"><strong>{message.sender_name}</strong><time>{message.status === 'SCHEDULED' ? `Scheduled ${new Date(message.scheduled_at!).toLocaleString()}` : new Date(message.created_at).toLocaleTimeString()}</time>{message.pinned && <span className="badge">PINNED</span>}</div><p>{message.content} {message.edited_at && <small>(edited)</small>}</p><div className="message-actions">{Object.entries(message.reactions ?? {}).map(([emoji, count]) => <button className="button" key={emoji} onClick={() => void react(message, emoji)}>{emoji} {count}</button>)}<button className="button" type="button" onClick={() => void react(message)}>👍</button><button className="button" type="button" onClick={() => setReplyTo(message)}>Reply {message.thread_count ? `(${message.thread_count})` : ''}</button><button className="button" type="button" onClick={() => void pin(message)}>{message.pinned ? 'Unpin' : 'Pin'}</button>{canModerate && <button className="button" type="button" onClick={() => void moderate(message)}>Moderate</button>}{message.sender_id === workspace?.user.id && <><button className="button" type="button" onClick={() => void edit(message)}>Edit</button><button className="button" type="button" onClick={() => void remove(message)}>Delete</button></>}</div></div></div>)}</div><form className="composer nexus-composer" onSubmit={send}>{replyTo && <div className="composer-context">Replying to {replyTo.sender_name}<button type="button" onClick={() => setReplyTo(null)}>×</button></div>}<button type="button" className="icon-button" aria-label="Attach file" onClick={() => setError('Choose a file from File Drive to attach it to a message.')}><Paperclip size={17} /></button><input value={text} onChange={event => setText(event.target.value)} placeholder={`Message #${active?.name ?? 'general'} — use @Name to mention`} aria-label="Message" /><input className="schedule-input" type="datetime-local" aria-label="Schedule message" value={scheduleAt} onChange={event => setScheduleAt(event.target.value)} /><button className="button primary">{scheduleAt ? 'Schedule' : 'Send'}</button></form></section></div>{show && <div className="modal-backdrop" onClick={() => setShow(false)}><div className="card modal-card" onClick={event => event.stopPropagation()}><div className="card-header"><h2>New channel</h2><button className="icon-button" aria-label="Close new channel" onClick={() => setShow(false)}>×</button></div><div className="field"><label htmlFor="channel-name">Channel name</label><input id="channel-name" autoFocus value={name} onChange={event => setName(event.target.value)} /></div><button className="button primary" onClick={() => void create()}>Create channel</button></div></div>}</AppShell>
}
