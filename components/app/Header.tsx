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
      const next: Record<string, Ticker> = {}
      await Promise.all(
        SYMS.map(async ({ k, sym }) => {
          try {
            const r = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${sym}`)
            const d = await r.json()
            if (d.lastPrice) {
              const pr = parseFloat(d.lastPrice)
              const ch = parseFloat(d.priceChangePercent)
              next[k] = {
                price: '$' + pr.toLocaleString('en', { maximumFractionDigits: 2 }),
                change: (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%',
                up: ch >= 0,
              }
            }
          } catch {}
        })
      )
      setTickers(next)
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
