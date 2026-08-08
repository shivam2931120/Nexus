'use client'

import { SignIn, SignUp } from '@clerk/nextjs'
import { useState } from 'react'

export default function Login() {
  const [signup, setSignup] = useState(false)
  return <div className="auth-page"><div className="auth-card"><div className="brand"><div className="brand-mark">N</div><span>Nexus</span></div>{signup ? <SignUp routing="hash" signInUrl="/login" /> : <SignIn routing="hash" signUpUrl="/login?signup=true" /> }<p style={{marginTop:22,marginBottom:0,textAlign:'center'}}><button className="button" onClick={() => setSignup(!signup)}>{signup ? 'Already have an account? Sign in' : 'New to Nexus? Create an account'}</button></p></div></div>
}
