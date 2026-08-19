'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect } from 'react'
import { api, registerTokenProvider } from '../lib/api'

export default function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      localStorage.removeItem('nexus_name')
      registerTokenProvider(null)
      return
    }
    registerTokenProvider(getToken)
    const sync = () => void getToken().then((token) => {
      const displayName = user?.fullName ?? user?.firstName ?? 'Nexus user'
      if (user) {
        localStorage.setItem('nexus_name', displayName)
        if (token && displayName !== 'Nexus user') void api('/me/profile', { method: 'PUT', body: JSON.stringify({ name: displayName }), token })
      }
    })
    sync()
    return () => registerTokenProvider(null)
  }, [getToken, isLoaded, isSignedIn, user])

  return null
}
