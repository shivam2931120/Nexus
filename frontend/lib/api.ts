export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'
export type ApiOptions = RequestInit & { token?: string }
export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code = '') {
    super(message)
    this.name = 'ApiRequestError'
  }
}
type TokenOptions = { skipCache?: boolean }
type ClerkWindow = Window & { Clerk?: { session?: { getToken: (options?: TokenOptions) => Promise<string | null> } } }
type TokenProvider = (options?: TokenOptions) => Promise<string | null>
let tokenProvider: TokenProvider | null = null

export function registerTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider
}

export async function getAuthToken(explicit?: string, options?: TokenOptions) {
  if (explicit) return explicit
  if (tokenProvider) return tokenProvider(options)
  if (typeof window !== 'undefined') return (window as ClerkWindow).Clerk?.session?.getToken(options) ?? null
  return null
}

function responseMessage(status: number, body: { message?: string; code?: string }) {
  if (body.message) return body.message
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to access this workspace item. Ask a workspace administrator if you need access.'
  if (status === 404) return 'The requested workspace item could not be found.'
  if (status >= 500) return 'The workspace service could not complete this request. Please retry.'
  return 'The request could not be completed.'
}

export async function api<T>(path:string, options:ApiOptions={}):Promise<T>{
  const headers = new Headers(options.headers); headers.set('Content-Type','application/json');
  const token = await getAuthToken(options.token); if(token) headers.set('Authorization',`Bearer ${token}`)
  let res: Response
  try { res = await fetch(`${API}${path}`,{...options,headers}) } catch (error) {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:api-error', { detail: { message: 'The server could not be reached. Check your connection and retry.', path } }))
    throw error
  }
  if (res.status === 401 && typeof window !== 'undefined') {
    const freshToken = await getAuthToken(undefined, { skipCache: true })
    if (freshToken && freshToken !== token) {
      headers.set('Authorization', `Bearer ${freshToken}`)
      res = await fetch(`${API}${path}`,{...options,headers})
    }
  }
  if(res.status===401&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('nexus:auth-expired'))
  if(!res.ok){const body=await res.json().catch(()=>({})) as {message?:string;code?:string}; throw new ApiRequestError(responseMessage(res.status,body),res.status,body.code)} return res.status===204?undefined as T:res.json()
}
export async function uploadFile<T>(path:string,file:File,fields:Record<string,string>={}):Promise<T>{
  const form=new FormData();form.append('file',file);Object.entries(fields).forEach(([key,value])=>form.append(key,value));
  const token=await getAuthToken();const headers=new Headers();if(token)headers.set('Authorization',`Bearer ${token}`);
  let res:Response;try{res=await fetch(`${API}${path}`,{method:'POST',headers,body:form})}catch(error){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('nexus:api-error',{detail:{message:'The server could not be reached. Check your connection and retry.',path}}));throw error}if(!res.ok){const body=await res.json().catch(()=>({})) as {message?:string;code?:string};throw new ApiRequestError(responseMessage(res.status,body),res.status,body.code)}return res.json()
}
