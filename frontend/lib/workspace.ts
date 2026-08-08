'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export type Workspace = { user: { id: string; email: string; name: string }; organization: { id: string; name: string; role: string }; team: { id: string; name: string }; channels: Array<{ id: string; name: string; type: string; team_id: string }> }

export function useWorkspace() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) { setLoading(false); return null }
    setLoading(true); setError('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Please sign in again.')
      const selectedOrg = localStorage.getItem('nexus_org_id')
      const result = await api<Workspace>(selectedOrg ? `/bootstrap?orgId=${encodeURIComponent(selectedOrg)}` : '/bootstrap', { token })
      setWorkspace(result)
      localStorage.setItem('nexus_org_id', result.organization.id)
      localStorage.setItem('nexus_team_id', result.team.id)
      return { result, token }
    } catch (err) { setError(err instanceof Error ? err.message : 'Workspace could not be loaded.'); return null }
    finally { setLoading(false) }
  }, [getToken, isLoaded, isSignedIn])
  useEffect(() => { void refresh() }, [refresh])
  return { workspace, loading, error, refresh }
}

export function workspaceIds(workspace: Workspace | null) { return { orgId: workspace?.organization.id ?? '', teamId: workspace?.team.id ?? '' } }
