export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'
export type ApiOptions = RequestInit & { token?: string }
export async function api<T>(path:string, options:ApiOptions={}):Promise<T>{
  const headers = new Headers(options.headers); headers.set('Content-Type','application/json');
  const token = options.token ?? (typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null); if(token) headers.set('Authorization',`Bearer ${token}`)
  const res = await fetch(`${API}${path}`,{...options,headers}); if(!res.ok){const body=await res.json().catch(()=>({})); throw new Error(body.message ?? 'Something went wrong.')} return res.status===204?undefined as T:res.json()
}
