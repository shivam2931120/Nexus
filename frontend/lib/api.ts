export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'
export type ApiOptions = RequestInit & { token?: string }
type ClerkWindow = Window & { Clerk?: { session?: { getToken: () => Promise<string | null> } } }
export async function api<T>(path:string, options:ApiOptions={}):Promise<T>{
  const headers = new Headers(options.headers); headers.set('Content-Type','application/json');
  const token = options.token ?? (typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null); if(token) headers.set('Authorization',`Bearer ${token}`)
  let res = await fetch(`${API}${path}`,{...options,headers})
  if ((res.status === 401 || res.status === 403) && typeof window !== 'undefined' && !options.token) {
    const freshToken = await (window as ClerkWindow).Clerk?.session?.getToken()
    if (freshToken && freshToken !== token) {
      localStorage.setItem('nexus_token', freshToken)
      headers.set('Authorization', `Bearer ${freshToken}`)
      res = await fetch(`${API}${path}`,{...options,headers})
    }
  }
  if(!res.ok){const body=await res.json().catch(()=>({})); throw new Error(body.message ?? `Request failed (${res.status}).`)} return res.status===204?undefined as T:res.json()
}
export async function uploadFile<T>(path:string,file:File,fields:Record<string,string>={}):Promise<T>{
  const form=new FormData();form.append('file',file);Object.entries(fields).forEach(([key,value])=>form.append(key,value));
  const token=typeof window!=='undefined'?localStorage.getItem('nexus_token'):null;const headers=new Headers();if(token)headers.set('Authorization',`Bearer ${token}`);
  const res=await fetch(`${API}${path}`,{method:'POST',headers,body:form});if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.message??'Upload failed.')}return res.json()
}
