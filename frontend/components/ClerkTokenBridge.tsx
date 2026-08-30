'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { api, registerTokenProvider } from '../lib/api'

export default function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const pathname = usePathname()

  useEffect(() => {
    // Auth pages must be able to recover an expired Clerk session without
    // starting workspace requests or attempting a profile sync in the
    // background. Those requests otherwise create a 401 loop on /login.
    if (pathname === '/login' || pathname === '/login/sso-callback') {
      registerTokenProvider(null)
      return () => registerTokenProvider(null)
    }
    if (!isLoaded) return
    if (!isSignedIn) {
      localStorage.removeItem('nexus_name')
      registerTokenProvider(null)
      return
    }
    registerTokenProvider(getToken)
    const sync = () => void getToken({ skipCache: true }).then((token) => {
      const displayName = user?.fullName ?? user?.firstName ?? 'Nexus user'
      if (user) {
        localStorage.setItem('nexus_name', displayName)
        if (token && displayName !== 'Nexus user') void api('/me/profile', { method: 'PUT', body: JSON.stringify({ name: displayName }), token })
      }
    })
    sync()
    return () => registerTokenProvider(null)
  }, [getToken, isLoaded, isSignedIn, pathname, user])

  return null
}
