'use client'

import Link from 'next/link'
import { useState } from 'react'
import './forge.css'

const stages = [
  ['install', '12s', 'done'],
  ['build', '1m 04s', 'done'],
  ['test', '48s', 'done'],
  ['sign', '3s', 'done'],
  ['canary', 'running', 'running'],
  ['promote', '-', 'pending'],
] as const

const logs = [
  ['09:41:02', 'install', 'pkg-lock.json', 'DONE'],
  ['09:41:14', 'build', 'dist-8f2c1ad.tar.gz', 'DONE'],
  ['09:42:18', 'test', 'coverage-report.xml', 'PASS'],
  ['09:43:06', 'sign', 'signature-8f2c1ad.sig', 'DONE'],
]

export default function Home() {
  const [copied, setCopied] = useState(false)
  const copyCommand = async () => {
    await navigator.clipboard?.writeText('npx forge init')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return <main className="forge-landing">
    <nav className="forge-nav">
      <Link href="/" className="forge-brand"><span className="forge-monogram">F</span><span>forge</span></Link>
      <div className="forge-links"><a href="#pipeline">Product</a><a href="#pipeline">Pipelines</a><a href="#receipt">Docs</a><a href="#stats">Pricing</a><a href="#ticker">Changelog</a></div>
      <div className="forge-nav-actions"><span className="forge-version">v<span>2.4.0</span></span><Link className="forge-signin" href="/login">Sign in</Link><Link className="forge-primary forge-nav-cta" href="/login?signup=true">Start building</Link></div>
    </nav>

    <section className="forge-hero">
      <div className="forge-hero-copy"><div className="forge-eyebrow"><i /> SPEC / 001 - CONTINUOUS DELIVERY</div><h1>Ship every<br />commit with<br />a receipt.</h1></div>
      <div className="forge-hero-aside"><div className="forge-rule" /><p>Forge turns every commit into a verified, observable deployment. Build faster without losing the evidence your team depends on.</p><div className="forge-cta-row"><Link className="forge-primary" href="/login?signup=true">Start building</Link><button className="forge-command" onClick={copyCommand}><span>$ npx forge init</span><b aria-label="Copy command">{copied ? '✓' : '⧉'}</b></button></div><div className="forge-risk">NO CARD. 500 BUILD-MINUTES FREE.</div></div>
    </section>

    <section className="forge-mockup-wrap" id="pipeline"><div className="forge-measure"><i /><span>1440</span><i /></div><div className="forge-mockup"><span className="forge-corner tl" /><span className="forge-corner tr" /><span className="forge-corner bl" /><span className="forge-corner br" /><header className="forge-run-head"><div className="forge-squares"><i /><i /><i /></div><strong>forge - deploy/api-gateway</strong><span>main@8f2c1ad</span></header><div className="forge-run-body"><aside className="forge-rail">{stages.map(([name, duration, state]) => <div className={`forge-stage ${state}`} key={name}><i /> <span>{name}</span><b>{duration}</b></div>)}<div className="forge-artifacts"><span>ARTIFACTS</span><strong>4 signed / 0 unsigned</strong></div></aside><div className="forge-run-main"><div className="forge-timeline">{stages.map(([name, duration, state]) => <div className={`forge-timeline-stage ${state}`} key={name}><i /><span>{duration}</span><small>{name}</small></div>)}</div><div className="forge-log"><div className="forge-log-row forge-log-head"><span className="forge-timestamp">TIMESTAMP</span><span>STAGE</span><span>ARTIFACT</span><span>STATUS</span></div>{logs.map(([time, stage, artifact, status]) => <div className="forge-log-row" key={artifact}><span className="forge-timestamp">{time}</span><span>{stage}</span><span className="forge-artifact">{artifact}</span><span className={status === 'PASS' ? 'pass' : 'done'}>{status}</span></div>)}</div><div className="forge-receipt" id="receipt"><div className="forge-receipt-data"><div><span>RECEIPT NO.</span><strong>RC-8f2c1ad-0417</strong></div><div><span>CHECKSUM</span><strong>sha256:9d41c0e2</strong></div><div><span>SIGNED BY</span><strong>forge-ci / cosign</strong></div></div><div className="forge-stamp">SIGNED</div></div></div></div></div></section>

    <section className="forge-stats" id="stats"><div><strong>99.98%</strong><i /><span>PIPELINE UPTIME</span></div><div><strong>2m 14s</strong><i /><span>MEDIAN PIPELINE RUN</span></div><div><strong>12k</strong><i /><span>DEPLOYS / DAY</span></div></section>

    <footer className="forge-ticker" id="ticker"><div className="forge-ticker-track"><span>KESTREL IO</span><i /> <span>NORTHWIND DATA</span><i /> <span>HELIOGRAPH</span><i /> <span>PARABOLA LABS</span><i /> <span>TIDEWATER CLOUD</span><i /> <span>MERIDIAN STACK</span><i /><span>KESTREL IO</span><i /> <span>NORTHWIND DATA</span><i /> <span>HELIOGRAPH</span><i /> <span>PARABOLA LABS</span><i /> <span>TIDEWATER CLOUD</span><i /> <span>MERIDIAN STACK</span><i /></div></footer>
  </main>
}
