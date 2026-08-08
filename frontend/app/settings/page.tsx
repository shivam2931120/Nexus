'use client'
import AppShell from '../../components/AppShell';
export default function Settings(){return <AppShell><div className="page"><div className="eyebrow">ACCOUNT</div><h1>Settings</h1><div className="card" style={{marginTop:24,maxWidth:720}}><h2>Appearance</h2><p className="muted">Theme controls are ready for system preference and manual dark mode configuration.</p><button className="button" onClick={()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'}>Toggle dark mode</button></div></div></AppShell>}
