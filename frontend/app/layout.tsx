import './globals.css'
import './nexus-app.css'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import ClerkTokenBridge from '../components/ClerkTokenBridge'

export const metadata: Metadata = {
  title: 'Nexus — the connected workspace',
  description: 'Team communication and work in one calm workspace.',
  icons: { icon: '/logo.jpg', apple: '/logo.jpg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('nexus_theme_version')!=='2'){localStorage.setItem('nexus_theme','dark');localStorage.setItem('nexus_theme_version','2')}document.documentElement.dataset.theme=localStorage.getItem('nexus_theme')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}" }} /></head><body><ClerkProvider><ClerkTokenBridge />{children}</ClerkProvider></body></html>
}
