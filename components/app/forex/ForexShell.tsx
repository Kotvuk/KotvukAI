'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useMarket } from '@/contexts/MarketContext'
import { SessionsOpen, SessionsClosed } from './ForexSessions'
import ForexOverview from './ForexOverview'
import ForexCalendar from './ForexCalendar'
import ForexPositions from './ForexPositions'
import ForexHistory from './ForexHistory'

const ForexAnalysis = dynamic(() => import('./ForexAnalysis'), { ssr: false })
const SettingsPanel = dynamic(() => import('@/components/app/panels/SettingsPanel'), { ssr: false })

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'kotvukai@gmail.com').toLowerCase()

type FxPanel = 'ov' | 'ai' | 'pos' | 'cal' | 'hist' | 'set'

const HDR_SYMS = ['EUR/USD', 'GBP/USD', 'USD/JPY']

const ICONS: Record<FxPanel, React.ReactNode> = {
  ov: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  ai: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
  pos: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  hist: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  set: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" /></svg>,
}

export default function ForexShell() {
  const { user, logout } = useAuth()
  const { setMarket } = useMarket()
  const router = useRouter()
  const [active, setActive] = useState<FxPanel>('ov')
  const [collapsed, setCollapsed] = useState(false)
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({})

  useEffect(() => {
    const load = () => fetch('/api/ticker?market=forex').then(r => r.ok ? r.json() : null).then(d => { if (d) setPrices(d) }).catch(() => {})
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  const isAdmin = ADMIN_EMAIL === (user?.email || '').toLowerCase()

  const nav: { id: FxPanel; label: string; dot?: boolean }[] = [
    { id: 'ov', label: 'Обзор' },
    { id: 'ai', label: 'AI анализ' },
    { id: 'pos', label: 'Позиции' },
    { id: 'cal', label: 'Календарь', dot: true },
    { id: 'hist', label: 'История' },
    { id: 'set', label: 'Настройки' },
  ]

  const go = useCallback((p: FxPanel) => setActive(p), [])

  return (
    <div id="fxapp">
      <aside className={`fx-sb ${collapsed ? 'collapsed' : ''}`}>
        <div className="fx-sb-top">
          <button className="fx-burger" aria-label="Меню" onClick={() => setCollapsed(c => !c)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <div className="fx-logo fx-hide">
            <span className="fx-logo-mark" />
            <span className="fx-logo-txt">Kotvuk<b>AI</b></span>
            <span className="fx-badge">FX</span>
          </div>
        </div>
        <div className="fx-navlbl fx-hide">ТЕРМИНАЛ</div>
        {nav.map(n => (
          <button key={n.id} className={`fx-nav ${active === n.id ? 'on' : ''}`} onClick={() => go(n.id)} title={n.label}>
            {ICONS[n.id]}
            <span className="fx-hide">{n.label}</span>
            {n.dot && <span className="fx-nav-dot fx-hide" />}
          </button>
        ))}
        {isAdmin && (
          <button className="fx-nav" onClick={() => router.push('/admin')} style={{ color: 'var(--wait)' }} title="Админ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            <span className="fx-hide">Админ</span>
          </button>
        )}
        <div className="fx-sb-sess fx-hide">
          <div className="fx-navlbl" style={{ padding: 0, marginBottom: 5 }}>СЕССИИ</div>
          <SessionsOpen />
        </div>
      </aside>

      <div className="fx-main">
        <header className="fx-hdr">
          <div className="fx-tick">
            {HDR_SYMS.map(sym => {
              const d = prices[sym]
              const up = (d?.change ?? 0) >= 0
              return (
                <span key={sym}>{sym} <b style={{ color: up ? 'var(--long)' : 'var(--short)' }}>{d ? d.price.toFixed(sym.includes('JPY') ? 3 : 5) : '—'}</b></span>
              )
            })}
          </div>
          <div className="fx-hdr-r">
            <div className="fx-hdr-sess"><SessionsClosed /></div>
            <div className="fx-hdr-act">
              <button onClick={() => setMarket('crypto')} title="Перейти к крипте" style={{ background: 'none', border: '1px solid var(--line3)', borderRadius: 999, color: 'var(--muted)', fontSize: '.56rem', cursor: 'pointer', padding: '4px 11px', letterSpacing: '.08em', fontFamily: 'var(--mono)' }}>CRYPTO</button>
              {user && <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '.6rem', cursor: 'pointer', letterSpacing: '.05em', textTransform: 'uppercase' }}>Выход</button>}
            </div>
          </div>
        </header>

        <div className="fx-content">
          {active === 'ov' && <ForexOverview onNavigate={go as (p: string) => void} />}
          {active === 'cal' && <ForexCalendar />}
          {active === 'pos' && <ForexPositions />}
          {active === 'hist' && <ForexHistory />}
          {active === 'set' && <SettingsPanel />}
          {active === 'ai' && <ForexAnalysis />}
        </div>
      </div>
    </div>
  )
}
