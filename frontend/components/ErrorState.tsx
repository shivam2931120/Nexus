'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ErrorState({ kind = 'error', reset, digest }: { kind?: 'not-found' | 'error'; reset?: () => void; digest?: string }) {
  const router = useRouter()
  const notFound = kind === 'not-found'
  return <main className="forge-error-page">
    <div className="forge-error-rule"><span>FORGE / RECOVERY</span><i /></div>
    <section className="forge-error-card">
      <div className="forge-error-code">{notFound ? '404' : 'ERR'}</div>
      <div className="eyebrow">{notFound ? 'ROUTE NOT FOUND' : 'RUNTIME FAILURE'}</div>
      <h1>{notFound ? 'This page is not in the manifest.' : 'The workbench hit an unexpected state.'}</h1>
      <p>{notFound ? 'The address may be incorrect, or this module has not been enabled for the current workspace.' : 'Your data is safe. Retry the operation or return to the workspace while the system recovers.'}</p>
      {digest && <code className="forge-error-reference">REFERENCE / {digest}</code>}
      <div className="actions forge-error-actions">
        {reset && <button className="button primary" onClick={reset}>Retry</button>}
        <Link className="button primary" href="/">Workspace home</Link>
        <button className="button" onClick={() => router.back()}>Go back</button>
      </div>
    </section>
  </main>
}
