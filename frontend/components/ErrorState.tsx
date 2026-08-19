'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ErrorState({ kind = 'error', reset, digest }: { kind?: 'not-found' | 'error'; reset?: () => void; digest?: string }) {
  const router = useRouter()
  const notFound = kind === 'not-found'
  return <main className="nexus-error-page">
    <div className="nexus-error-rule"><span>NEXUS / RECOVERY</span><i /></div>
    <section className="nexus-error-card">
      <div className="nexus-error-code">{notFound ? '404' : 'ERR'}</div>
      <div className="eyebrow">{notFound ? 'ROUTE NOT FOUND' : 'RUNTIME FAILURE'}</div>
      <h1>{notFound ? 'This page is not in the manifest.' : 'The workbench hit an unexpected state.'}</h1>
      <p>{notFound ? 'The address may be incorrect, or this module has not been enabled for the current workspace.' : 'Your data is safe. Retry the operation or return to the workspace while the system recovers.'}</p>
      {digest && <code className="nexus-error-reference">REFERENCE / {digest}</code>}
      <div className="actions nexus-error-actions">
        {reset && <button className="button primary" onClick={reset}>Retry</button>}
        <Link className="button primary" href="/">Workspace home</Link>
        <button className="button" onClick={() => router.back()}>Go back</button>
      </div>
    </section>
  </main>
}
