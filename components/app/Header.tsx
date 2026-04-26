'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'

interface Ticker { price: string; change: string; up: boolean }

const SYMS = [
  { k: 'btc', sym: 'BTCUSDT', label: 'BTC' },
  { k: 'eth', sym: 'ETHUSDT', label: 'ETH' },
  { k: 'sol', sym: 'SOLUSDT', label: 'SOL' },
  { k: 'bnb', sym: 'BNBUSDT', label: 'BNB' },
]

export default function Header() {
  const { logout, user } = useAuth()
  const { t } = useLang()
  const [time, setTime] = useState('')
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    async function fetchTickers() {
      try {
        // Через серверный прокси — не зависит от мобильных блокировок Binance
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
    <header id="hdr">
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
        <span className="hdr-time">{time}</span>
        <div className="live-dot" />
      </div>
    </header>
  )
}
