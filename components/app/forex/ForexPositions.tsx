'use client'
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { fmtLocal, fmtPrice } from '@/lib/fmt'

const TradePathModal = dynamic(() => import('@/components/app/panels/TradePathModal'), { ssr: false })

interface Trade {
  id: number; pair: string; direction: string; amount: number
  entry_price: number | null; tp_price: number | null; sl_price: number | null
  exit_price: number | null; leverage: number; timeframe: string | null
  status: string; pnl: number | null; pnl_pct: number | null
  created_at: string; closed_at: string | null
}

function num(v: number | null | undefined) { return v == null ? 0 : Number(v) }

export default function ForexPositions() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({})
  const [pathTrade, setPathTrade] = useState<Trade | null>(null)

  const load = useCallback(() => {
    fetch('/api/trades?market=forex').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) setTrades(d.trades || []) }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const tick = () => fetch('/api/ticker?market=forex').then(r => r.ok ? r.json() : null).then(d => { if (d) setPrices(d) }).catch(() => {})
    tick()
    const iv = setInterval(tick, 60000)
    return () => clearInterval(iv)
  }, [])

  const open = trades.filter(t => t.status === 'open')
  const closed = trades.filter(t => t.status === 'closed').slice(0, 12)

  function unrealized(t: Trade): { pct: number; usd: number } | null {
    const px = prices[t.pair]?.price
    if (!px || !t.entry_price) return null
    const dir = t.direction.toLowerCase() === 'short' ? -1 : 1
    const pct = ((px - num(t.entry_price)) / num(t.entry_price)) * 100 * dir * t.leverage
    return { pct, usd: (num(t.amount) * pct) / 100 }
  }

  return (
    <div>
      <div className="fx-seclbl">ОТКРЫТЫЕ ПОЗИЦИИ</div>
      {open.length ? open.map(t => {
        const u = unrealized(t)
        const up = (u?.pct ?? 0) >= 0
        const px = prices[t.pair]?.price
        return (
          <div key={t.id} className="fx-sig" style={{ marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '.92rem', color: 'var(--text)' }}>{t.pair} <span style={{ fontStyle: 'italic', color: t.direction.toLowerCase() === 'short' ? 'var(--short)' : 'var(--cyan)', fontSize: '.72rem' }}>{t.direction.toLowerCase()} · {t.leverage}x</span></div>
              <div className="fx-sig-mut">${num(t.amount).toFixed(0)} · вход {fmtPrice(t.entry_price)} · tp {fmtPrice(t.tp_price)} · sl {fmtPrice(t.sl_price)}</div>
            </div>
            <div className="fx-sig-cell" style={{ marginLeft: 'auto' }}>
              <div className="fx-ov-kpi-l">ЦЕНА</div>
              <div className="fx-sig-cell-v" style={{ color: 'var(--text)' }}>{px != null ? px.toFixed(5) : '—'}</div>
            </div>
            <div className="fx-sig-div" />
            <div className="fx-sig-cell">
              <div className="fx-ov-kpi-l">НЕРЕАЛИЗ. PNL</div>
              <div className="fx-sig-cell-v" style={{ color: up ? 'var(--long)' : 'var(--short)' }}>{u == null ? '—' : (up ? '+' : '−') + '$' + Math.abs(u.usd).toFixed(2)}</div>
            </div>
          </div>
        )
      }) : (
        <div className="fx-sig" style={{ color: 'var(--muted)', fontSize: '.7rem' }}>Нет открытых позиций · бот сканирует сессии</div>
      )}

      <div className="fx-seclbl" style={{ marginTop: 16 }}>ЗАКРЫТЫЕ СДЕЛКИ</div>
      <div className="tbox">
        <div className="twrap">
          <table className="tbl">
            <thead><tr><th>Дата</th><th>Пара</th><th>Напр.</th><th>Плечо</th><th>PnL</th><th>Путь</th></tr></thead>
            <tbody>
              {closed.length ? closed.map(t => {
                const pnlUp = num(t.pnl) >= 0
                return (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '.6rem', color: 'var(--muted)' }}>{fmtLocal(t.created_at)}</td>
                    <td>{t.pair}</td>
                    <td><span className={`tag tag-${t.direction.toLowerCase() === 'short' ? 'short' : 'long'}`}>{t.direction.toUpperCase()}</span></td>
                    <td>{t.leverage}x</td>
                    <td style={{ color: pnlUp ? 'var(--long)' : 'var(--short)' }}>{(pnlUp ? '+' : '−') + '$' + Math.abs(num(t.pnl)).toFixed(2)} <span style={{ color: 'var(--muted)', fontSize: '.56rem' }}>({num(t.pnl_pct).toFixed(2)}%)</span></td>
                    <td><button onClick={() => setPathTrade(t)} title="Путь сделки" style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '.8rem', lineHeight: 1 }}>📈</button></td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18, fontSize: '.63rem' }}>Закрытых сделок пока нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pathTrade && <TradePathModal trade={pathTrade as never} market="forex" onClose={() => setPathTrade(null)} />}
    </div>
  )
}
