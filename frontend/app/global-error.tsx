'use client'

import { useEffect } from 'react'
import ErrorState from '../components/ErrorState'
import './globals.css'
import './forge-app.css'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <html lang="en"><body><ErrorState reset={reset} digest={error.digest} /></body></html>
}
