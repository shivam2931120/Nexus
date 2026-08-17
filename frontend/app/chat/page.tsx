'use client'

import AppShell from '../../components/AppShell'
import { FormEvent, useEffect, useState } from 'react'
import { MessageCircle, Paperclip, Plus, Search, Users } from '../../components/icons'
import { api } from '../../lib/api'
import { useWorkspace, workspaceIds } from '../../lib/workspace'
import { Client, type IMessage } from '@stomp/stompjs'

type Channel = { id: string; name: string; type: string; team_id: string }
type Message = { id: string; content: string; sender_name: string; created_at: string }

export default function Chat() {
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
  const currentName = typeof window === 'undefined' ? 'Nexus user' : localStorage.getItem('nexus_name') ?? 'Nexus user'

  useEffect(() => {
    if (orgId) void api<Channel[]>(`/orgs/${orgId}/channels`).then(items => { setChannels(items); setActive(items[0] ?? null) }).catch(err => setError(err instanceof Error ? err.message : 'Channels could not be loaded.'))
  }, [orgId])
  useEffect(() => {
    if (!active) return
    void api<Message[]>(`/channels/${active.id}/messages`).then(items => setMessages(items.map(item => item.sender_name === 'Clerk user' ? { ...item, sender_name: currentName } : item))).catch(err => setError(err instanceof Error ? err.message : 'Messages could not be loaded.'))
  }, [active, currentName])

  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const token = localStorage.getItem('nexus_token')
    if (!token) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'
    const wsUrl = `${apiUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, '')}/ws`
    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
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
  }, [active, currentName])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!active || !text.trim()) return
    setError('')
    try {
      const message = await api<Message>(`/channels/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ content: text.trim() }) })
      setMessages(items => items.some(item => item.id === message.id) ? items : [...items, { ...message, sender_name: message.sender_name === 'Clerk user' ? currentName : message.sender_name }])
      setText('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be sent.') }
  }
  const create = async () => {
    if (!orgId || !name.trim()) return
    try {
      const channel = await api<Channel>(`/orgs/${orgId}/channels`, { method: 'POST', body: JSON.stringify({ name: name.trim().replace(/^#/, '').toLowerCase(), teamId, type: 'PUBLIC' }) })
      setChannels(items => [...items, channel]); setActive(channel); setName(''); setShow(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Channel could not be created.') }
  }
  const react = async (message: Message) => { if (!active) return; try { await api(`/channels/${active.id}/messages/${message.id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji: '👍' }) }) } catch (err) { setError(err instanceof Error ? err.message : 'Reaction could not be saved.') } }
  const pin = async (message: Message) => { if (!active) return; try { await api(`/channels/${active.id}/messages/${message.id}/pin`, { method: 'POST' }); setError('Message pinned for this channel.') } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be pinned.') } }
  const edit = async (message: Message) => { const content = window.prompt('Edit message', message.content); if (!active || content === null || !content.trim()) return; try { const updated = await api<Message>(`/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ content: content.trim() }) }); setMessages(items => items.map(item => item.id === message.id ? { ...item, ...updated, content: updated.content ?? content.trim() } : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be edited.') } }
  const remove = async (message: Message) => { if (!window.confirm('Delete this message?')) return; try { await api(`/messages/${message.id}`, { method: 'DELETE' }); setMessages(items => items.filter(item => item.id !== message.id)) } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be deleted.') } }

  return <AppShell><div className="chat-layout"><aside className="chat-list"><div className="card-header"><h2>Messages</h2><button className="icon-button" onClick={() => setShow(true)} aria-label="New channel"><Plus size={16} /></button></div><div className="search" style={{ marginBottom: 14 }}><Search size={14} /><span>Find a channel</span></div>{channels.map(channel => <button className={`nav-item ${active?.id === channel.id ? 'active' : ''}`} key={channel.id} onClick={() => setActive(channel)}><MessageCircle size={15} /><span># {channel.name}</span></button>)}</aside><section className="chat-main"><header className="chat-header"><div><h2># {active?.name ?? 'general'}</h2><span className="muted">Organization channel · {realtime === 'connected' ? 'live' : realtime === 'connecting' ? 'connecting' : 'offline'}</span></div><Users size={17} /></header>{error && <div className="form-error forge-chat-error">{error}</div>}<div className="messages">{messages.length === 0 ? <div className="empty"><MessageCircle size={28} /><p>No messages in this channel yet.</p></div> : messages.map(message => <div className="message" key={message.id}><span className="avatar">{message.sender_name?.slice(0, 1).toUpperCase()}</span><div className="message-body"><div className="message-meta"><strong>{message.sender_name}</strong><time>{new Date(message.created_at).toLocaleTimeString()}</time></div><p>{message.content}</p><div className="message-actions"><button className="button" type="button" onClick={() => void react(message)}>👍</button><button className="button" type="button" onClick={() => void pin(message)}>Pin</button><button className="button" type="button" onClick={() => void edit(message)}>Edit</button><button className="button" type="button" onClick={() => void remove(message)}>Delete</button></div></div></div>)}</div><form className="composer" onSubmit={send}><button type="button" className="icon-button" aria-label="Attach file" onClick={() => setError('Choose a file from File Drive to attach it to a message.')}><Paperclip size={17} /></button><input value={text} onChange={event => setText(event.target.value)} placeholder={`Message #${active?.name ?? 'general'}`} aria-label="Message" /><button className="button primary">Send</button></form></section></div>{show && <div className="modal-backdrop"><div className="card modal-card"><div className="card-header"><h2>New channel</h2><button className="icon-button" onClick={() => setShow(false)}>×</button></div><div className="field"><label htmlFor="channel-name">Channel name</label><input id="channel-name" autoFocus value={name} onChange={event => setName(event.target.value)} /></div><button className="button primary" onClick={() => void create()}>Create channel</button></div></div>}</AppShell>
}
