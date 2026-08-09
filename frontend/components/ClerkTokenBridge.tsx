'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect } from 'react'
import { api } from '../lib/api'

export default function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      localStorage.removeItem('nexus_token')
      localStorage.removeItem('nexus_name')
      return
    }
    const sync = () => void getToken().then((token) => {
      if (token) localStorage.setItem('nexus_token', token)
      const displayName = user?.fullName ?? user?.firstName ?? 'Nexus user'
      if (user) {
        localStorage.setItem('nexus_name', displayName)
        if (token && displayName !== 'Nexus user') void api('/me/profile', { method: 'PUT', body: JSON.stringify({ name: displayName }), token })
      }
    })
    sync()
    const timer = window.setInterval(sync, 45000)
    return () => window.clearInterval(timer)
  }, [getToken, isLoaded, isSignedIn, user])

  return null
}
