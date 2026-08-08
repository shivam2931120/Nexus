import './globals.css'
import './forge-app.css'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import ClerkTokenBridge from '../components/ClerkTokenBridge'

export const metadata: Metadata = {
  title: 'Nexus — the connected workspace',
  description: 'Team communication and work in one calm workspace.',
  icons: { icon: '/logo.jpg', apple: '/logo.jpg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ClerkProvider><ClerkTokenBridge />{children}</ClerkProvider></body></html>
}
