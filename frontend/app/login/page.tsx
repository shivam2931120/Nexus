'use client'

import { useAuth } from '@clerk/nextjs'
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn()
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp()
  const [mode, setMode] = useState<'signIn'|'signUp'>('signIn')
  useEffect(() => { if (new URLSearchParams(window.location.search).get('signup') === 'true') setMode('signUp') }, [])
  const destination = () => { const value = new URLSearchParams(window.location.search).get('redirect_url'); return value?.startsWith('/') && !value.startsWith('//') ? value : '/' }
  useEffect(() => {
    // A protected API request sends users here with reason=session after an
    // expired Clerk session. Do not immediately redirect back to the app
    // while Clerk is still reporting the stale browser session as signed in.
    const params = new URLSearchParams(window.location.search)
    if (authLoaded && isSignedIn && params.get('reason') !== 'session') router.replace(destination())
  }, [authLoaded, isSignedIn, router])
  const [verification, setVerification] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      if (mode === 'signIn') {
        if (!signInLoaded || !signIn) return
        const result = await signIn.create({ identifier: email, password })
        if (result.status === 'complete') { await setSignInActive({ session: result.createdSessionId }); router.replace(destination()) }
        else setError('Additional verification is required for this account.')
      } else {
        if (!signUpLoaded || !signUp) return
        const result = await signUp.create({ emailAddress: email, password, firstName: name })
        if (result.status === 'complete') { await setSignUpActive({ session: result.createdSessionId }); router.replace(destination()) }
        else { await signUp.prepareEmailAddressVerification({ strategy: 'email_code' }); setVerification(true) }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to continue. Please check your details.') }
    finally { setBusy(false) }
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try { if (!signUp || !setSignUpActive) throw new Error('Sign-up is still loading.'); const result = await signUp.attemptEmailAddressVerification({ code }); if (result.status === 'complete') { await setSignUpActive({ session: result.createdSessionId }); router.replace(destination()) } else setError('That verification code is not complete.') }
    catch (err) { setError(err instanceof Error ? err.message : 'The verification code is invalid.') }
    finally { setBusy(false) }
  }

  const google = async () => {
    setError('')
    try { if (mode === 'signIn') await signIn?.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/login/sso-callback', redirectUrlComplete: '/' }); else await signUp?.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/login/sso-callback', redirectUrlComplete: '/' }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Google sign-in is unavailable.') }
  }

  return <main className="auth-page"><section className="auth-card"><div className="brand"><div className="brand-mark">N</div><span>Nexus</span></div><h1>{verification ? 'Check your email' : mode === 'signIn' ? 'Sign in to Nexus' : 'Create your Nexus account'}</h1><p>{verification ? `We sent a verification code to ${email}.` : mode === 'signIn' ? 'Welcome back. Continue to your workspace.' : 'Set up your secure workspace account.'}</p>{error && <div className="form-error" role="alert">{error}</div>}{verification ? <form onSubmit={verify}><div className="field"><label htmlFor="code">Verification code</label><input id="code" inputMode="numeric" autoFocus value={code} onChange={e=>setCode(e.target.value)} required /></div><button className="button primary block" disabled={busy} type="submit">{busy ? 'Verifying…' : 'Verify email'}</button></form> : <><button className="button block" type="button" onClick={google}>Continue with Google</button><div className="auth-divider"><span>or</span></div><form onSubmit={submit}>{mode === 'signUp' && <div className="field"><label htmlFor="name">Full name</label><input id="name" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required /></div>}<div className="field"><label htmlFor="email">Work email</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signIn'?'current-password':'new-password'} minLength={8} required /></div><button className="button primary block" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signIn' ? 'Continue' : 'Create account'}</button></form><div className="auth-switch"><button className="text-button" type="button" onClick={()=>{setMode(mode==='signIn'?'signUp':'signIn');setError('')}}>{mode === 'signIn' ? 'New to Nexus? Create an account' : 'Already have an account? Sign in'}</button></div></>}</section></main>
}
