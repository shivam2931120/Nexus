'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Room, RoomEvent, Track, type RemoteTrack, type LocalTrack } from 'livekit-client'
import { api } from '../../../lib/api'
import { Copy, Mic, PhoneOff, Video, VideoOff } from '../../../components/icons'

type MeetingToken = { serverUrl: string; token: string; room: string; identity: string }
type AttachedTrack = { id: string; track: RemoteTrack | LocalTrack; label: string }
type RoomMessage = { id: string; content: string; user_name?: string; created_at: string }

function TrackView({ item }: { item: AttachedTrack }) {
  const ref = useRef<HTMLVideoElement | HTMLAudioElement>(null)
  useEffect(() => {
    if (!ref.current) return
    item.track.attach(ref.current)
    return () => { item.track.detach(ref.current!) }
  }, [item.track])
  return <div className="livekit-tile">{item.track.kind === Track.Kind.Video ? <video ref={ref as React.RefObject<HTMLVideoElement>} autoPlay playsInline /> : <audio ref={ref as React.RefObject<HTMLAudioElement>} autoPlay /> }<span>{item.label}</span></div>
}

export default function MeetingRoomPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [roomName, setRoomName] = useState('nexus-team-room')
  const [meetingId, setMeetingId] = useState('')
  const liveRoom = useRef<Room | null>(null)
  const [tracks, setTracks] = useState<AttachedTrack[]>([])
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [status, setStatus] = useState('Connecting…')
  const [error, setError] = useState('')
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([])
  const [notes, setNotes] = useState<RoomMessage[]>([])
  const [draftMessage, setDraftMessage] = useState('')
  const [draftNote, setDraftNote] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setRoomName(params.get('room') || 'nexus-team-room')
    setMeetingId(params.get('meetingId') || '')
  }, [])

  const leave = useCallback(() => {
    liveRoom.current?.disconnect()
    liveRoom.current = null
    router.push('/meetings')
  }, [router])

  useEffect(() => {
    let cancelled = false
    const room = new Room()
    liveRoom.current = room
    const addTrack = (track: RemoteTrack | LocalTrack, id: string, label: string) => setTracks(current => current.some(item => item.id === id) ? current : [...current, { id, track, label }])
    const removeTrack = (track: RemoteTrack | LocalTrack) => setTracks(current => current.filter(item => item.track !== track))
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => addTrack(track, publication.trackSid, participant.name || participant.identity))
    room.on(RoomEvent.TrackUnsubscribed, track => removeTrack(track))
    room.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus('Disconnected') })
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Your sign-in session has expired. Please sign in again.')
        if (meetingId) await api(`/meetings/${meetingId}/join`, { method: 'POST', token })
        const data = await api<MeetingToken>(`/meetings/token?room=${encodeURIComponent(roomName)}`, { token })
        if (cancelled) return
        await room.connect(data.serverUrl, data.token)
        await room.localParticipant.enableCameraAndMicrophone()
        room.localParticipant.trackPublications.forEach(publication => { if (publication.track) addTrack(publication.track, publication.trackSid, 'You') })
        setStatus(`Live · ${roomName}`)
      } catch (reason) {
        if (!cancelled) { setStatus('Unable to join'); setError(reason instanceof Error ? reason.message : 'The meeting could not be started.') }
      }
    })()
    return () => { cancelled = true; room.disconnect(); liveRoom.current = null }
  }, [getToken, meetingId, roomName])

  useEffect(() => { if (!meetingId) return; void Promise.all([api<RoomMessage[]>(`/meetings/${meetingId}/chat`), api<RoomMessage[]>(`/meetings/${meetingId}/notes`)]).then(([chat, noteItems]) => { setRoomMessages(chat); setNotes(noteItems) }).catch(() => {}) }, [meetingId])

  const toggleMic = async () => { const next = !mic; setMic(next); await liveRoom.current?.localParticipant.setMicrophoneEnabled(next) }
  const toggleCamera = async () => { const next = !camera; setCamera(next); await liveRoom.current?.localParticipant.setCameraEnabled(next) }
  const toggleScreen = async () => { const next = !sharing; try { await liveRoom.current?.localParticipant.setScreenShareEnabled(next); setSharing(next) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Screen sharing could not be started.') } }
  const copyLink = () => navigator.clipboard?.writeText(window.location.href)
  const sendRoomMessage = async () => { if (!meetingId || !draftMessage.trim()) return; try { const item = await api<RoomMessage>(`/meetings/${meetingId}/chat`, { method: 'POST', body: JSON.stringify({ content: draftMessage.trim() }) }); setRoomMessages(items => [...items, item]); setDraftMessage('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Meeting message could not be sent.') } }
  const addNote = async () => { if (!meetingId || !draftNote.trim()) return; try { const item = await api<RoomMessage>(`/meetings/${meetingId}/notes`, { method: 'POST', body: JSON.stringify({ content: draftNote.trim() }) }); setNotes(items => [...items, item]); setDraftNote('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Meeting note could not be saved.') } }

  return <main className="meeting-room-page"><header className="meeting-room-header"><div className="meeting-brand"><span className="brand-mark">N</span> Nexus room <span className="meeting-status">{status}</span></div><button className="meeting-text-button" type="button" onClick={copyLink}><Copy size={15}/> Copy invite link</button></header><div className="meeting-content"><section className="livekit-stage">{error ? <div className="meeting-error"><Video size={36}/><h1>Couldn’t join this meeting</h1><p>{error}</p><div className="actions"><button className="button" type="button" onClick={() => location.reload()}>Try again</button><button className="button" type="button" onClick={leave}>Back to meetings</button></div></div> : tracks.length ? tracks.map(item => <TrackView item={item} key={item.id}/>) : <div className="meeting-empty"><Video size={42}/><h2>{status}</h2><p>Allow camera and microphone access when your browser asks.</p></div>}</section>{meetingId && <aside className="meeting-sidebar"><section><h2>Meeting chat</h2><div className="meeting-sidebar-list">{roomMessages.map(item => <p key={item.id}><strong>{item.user_name ?? 'Participant'}</strong><br />{item.content}</p>)}</div><div className="meeting-sidebar-form"><input value={draftMessage} onChange={event => setDraftMessage(event.target.value)} placeholder="Message participants" /><button className="button primary" onClick={() => void sendRoomMessage()}>Send</button></div></section><section><h2>Notes</h2><div className="meeting-sidebar-list">{notes.map(item => <p key={item.id}>{item.content}</p>)}</div><div className="meeting-sidebar-form"><textarea value={draftNote} onChange={event => setDraftNote(event.target.value)} placeholder="Capture an action item" /><button className="button" onClick={() => void addNote()}>Add note</button></div></section></aside>}</div><footer className="meeting-controls"><button className={`button ${mic ? 'primary' : ''}`} type="button" onClick={toggleMic}><Mic size={16}/> {mic ? 'Mute' : 'Unmute'}</button><button className={`button ${camera ? 'primary' : ''}`} type="button" onClick={toggleCamera}>{camera ? <Video size={16}/> : <VideoOff size={16}/>} {camera ? 'Camera' : 'Camera off'}</button><button className={`button ${sharing ? 'primary' : ''}`} type="button" onClick={() => void toggleScreen()}><Video size={16}/> {sharing ? 'Stop sharing' : 'Share screen'}</button><button className="button danger" type="button" onClick={leave}><PhoneOff size={16}/> Leave</button></footer></main>
}
