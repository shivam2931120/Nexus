'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect } from 'react'

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
      if (user) localStorage.setItem('nexus_name', user.fullName ?? user.firstName ?? 'Nexus user')
    })
    sync()
    const timer = window.setInterval(sync, 45000)
    return () => window.clearInterval(timer)
  }, [getToken, isLoaded, isSignedIn, user])

  return null
}
