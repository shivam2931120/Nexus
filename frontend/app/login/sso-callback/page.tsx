'use client'
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
export default function SsoCallback() { return <main className="auth-page"><div className="auth-card"><p>Completing secure sign-in…</p><AuthenticateWithRedirectCallback /></div></main> }
