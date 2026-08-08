'use client'
import AppShell from '../../components/AppShell'; import { Bell } from '../../components/icons'
export default function NotificationsPage() { return <AppShell><div className="page"><div className="page-heading"><div><div className="eyebrow">INBOX</div><h1>Notifications</h1><p className="muted">Your workspace notifications will appear here.</p></div><button className="button" type="button" disabled>Mark all read</button></div><div className="card empty"><Bell size={32}/><p>You’re all caught up.</p></div></div></AppShell> }
