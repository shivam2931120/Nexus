'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'
import { api, ApiRequestError } from './api'

export type Workspace = { user: { id: string; email: string; name: string }; organization: { id: string; name: string; role: string }; team: { id: string; name: string }; channels: Array<{ id: string; name: string; type: string; team_id: string }> }

let cachedWorkspace: Workspace | null = null
let cachedOrganizationId = ''
let bootstrapRequest: Promise<{ result: Workspace; token: string }> | null = null

async function bootstrap(getToken: () => Promise<string | null>, selectedOrg: string, force = false) {
  if (!force && cachedWorkspace && cachedOrganizationId === selectedOrg) {
    const token = await getToken()
    if (!token) throw new Error('Your session has expired. Please sign in again.')
    return { result: cachedWorkspace, token }
  }
  if (!force && bootstrapRequest) return bootstrapRequest
  bootstrapRequest = (async () => {
    const token = await getToken()
    if (!token) throw new Error('Your session has expired. Please sign in again.')
    let result: Workspace
    try {
      result = await api<Workspace>(selectedOrg ? `/bootstrap?orgId=${encodeURIComponent(selectedOrg)}` : '/bootstrap', { token })
    } catch (error) {
      if (!selectedOrg || !(error instanceof ApiRequestError) || ![403, 404].includes(error.status)) throw error
      localStorage.removeItem('nexus_org_id')
      localStorage.removeItem('nexus_team_id')
      cachedWorkspace = null
      cachedOrganizationId = ''
      result = await api<Workspace>('/bootstrap', { token })
    }
    cachedWorkspace = result
    cachedOrganizationId = result.organization.id
    return { result, token }
  })()
  try {
    return await bootstrapRequest
  } finally {
    bootstrapRequest = null
  }
}

export function useWorkspace() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async (force = false) => {
    if (!isLoaded || !isSignedIn) { setLoading(false); return null }
    setLoading(true); setError('')
    try {
      const selectedOrg = localStorage.getItem('nexus_org_id')
      const { result, token } = await bootstrap(getToken, selectedOrg ?? '', force)
      setWorkspace(result)
      localStorage.setItem('nexus_org_id', result.organization.id)
      localStorage.setItem('nexus_team_id', result.team.id)
      return { result, token }
    } catch (err) { setError(err instanceof Error ? err.message : 'Workspace could not be loaded.'); return null }
    finally { setLoading(false) }
  }, [getToken, isLoaded, isSignedIn])
  useEffect(() => { void refresh(false) }, [refresh])
  return { workspace, loading, error, refresh }
}

export function workspaceIds(workspace: Workspace | null) { return { orgId: workspace?.organization.id ?? '', teamId: workspace?.team.id ?? '' } }
