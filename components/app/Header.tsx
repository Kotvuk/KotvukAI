'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'

interface Ticker { price: string; change: string; up: boolean }

const SYMS = [
  { k: 'btc', sym: 'BTCUSDT', label: 'BTC' },
  { k: 'eth', sym: 'ETHUSDT', label: 'ETH' },
  { k: 'sol', sym: 'SOLUSDT', label: 'SOL' },
  { k: 'bnb', sym: 'BNBUSDT', label: 'BNB' },
]

export default function Header() {
  const { logout, user } = useAuth()
  const { t, lang } = useLang()
  const { theme, toggle } = useTheme()
  const [time, setTime] = useState('')
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString(lang, { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [lang])

  useEffect(() => {
    async function fetchTickers() {
      try {
        const r = await fetch('/api/ticker')
        if (!r.ok) return
        const data: Record<string, { price: number; change: number }> = await r.json()
        const next: Record<string, Ticker> = {}
        for (const { k, sym } of SYMS) {
          const d = data[sym]
          if (!d) continue
          next[k] = {
            price: '$' + d.price.toLocaleString('en', { maximumFractionDigits: 2 }),
            change: (d.change >= 0 ? '+' : '') + d.change.toFixed(2) + '%',
            up: d.change >= 0,
          }
        }
        setTickers(next)
      } catch {}
    }
    fetchTickers()
    const iv = setInterval(fetchTickers, 15000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div id="hdr">
      <div className="logo">
        <div className="logo-mark" />
        <span className="logo-text">{t('app_name')}</span>
      </div>
      <div className="ticker">
        {SYMS.map(({ k, label }) => (
          <div key={k} className="tick">
            <span className="tick-sym">{label}</span>
            <span className="tick-price">{tickers[k]?.price || '—'}</span>
            <span className={tickers[k]?.up ? 'tick-up' : 'tick-dn'}>
              {tickers[k]?.change || ''}
            </span>
          </div>
        ))}
      </div>
      <div className="hdr-r">
        {user && (
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '.6rem', cursor: 'pointer', letterSpacing: '.05em', textTransform: 'uppercase' }}
          >
            {t('logout')}
          </button>
        )}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px', lineHeight: 1 }}
        >
          {theme === 'dark' ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        <span className="hdr-time">{time}</span>
        <div className="live-dot" />
      </div>
    </div>
  )
}
