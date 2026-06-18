'use client'
import { useEffect, useState, useCallback } from 'react'
import { fmtLocal, fmtPrice } from '@/lib/fmt'

interface Stats {
  total: number; resolved: number; win_rate: number | null
  avg_confidence: number | null; avg_pnl_pct: string | null
}
interface OpenTrade {
  id: number; pair: string; direction: string; amount: number
  entry_price: number | null; tp_price: number | null; sl_price: number | null
  leverage: number; timeframe: string | null
}
interface Sig {
  id: number; pair: string; timeframe: string
  final_verdict: string | null; final_confidence: number | null
  outcome: string | null; created_at: string
}

function vc(v: string | null) {
  const u = (v || '').toUpperCase()
  return u === 'LONG' ? 'long' : u === 'SHORT' ? 'short' : 'wait'
}

export default function ForexOverview({ onNavigate }: { onNavigate?: (p: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [open, setOpen] = useState<OpenTrade | null>(null)
  const [signals, setSignals] = useState<Sig[]>([])
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/stats?market=forex').then(r => r.ok ? r.json() : null),
      fetch('/api/trades?market=forex').then(r => r.ok ? r.json() : null),
      fetch('/api/signals?market=forex&limit=8').then(r => r.ok ? r.json() : null),
    ]).then(([s, tr, sg]) => {
      if (s?.ok) setStats(s)
      if (tr?.ok) setOpen((tr.trades || []).find((t: OpenTrade & { status: string }) => t.status === 'open') || null)
      if (sg?.ok) setSignals(sg.signals || [])
    }).catch(() => {})
  }, [])

  const loadPrices = useCallback(() => {
    fetch('/api/ticker?market=forex').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPrices(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    loadPrices()
    const iv = setInterval(loadPrices, 60000)
    return () => clearInterval(iv)
  }, [loadPrices])

  const livePx = open ? prices[open.pair]?.price : undefined
  let upnlPct: number | null = null
  let upnlUsd: number | null = null
  if (open && open.entry_price && livePx) {
    const dir = open.direction.toLowerCase() === 'short' ? -1 : 1
    upnlPct = ((livePx - open.entry_price) / open.entry_price) * 100 * dir * open.leverage
    upnlUsd = (open.amount * upnlPct) / 100
  }
  const up = (upnlPct ?? 0) >= 0
  const pnlColor = up ? 'var(--long)' : 'var(--short)'

  return (
    <div>
      <div className="fx-ov-kpis">
        <div><div className="fx-ov-kpi-l">WIN RATE</div><div className="fx-ov-kpi-v" style={{ color: 'var(--cyan)' }}>{stats?.win_rate != null ? stats.win_rate + '%' : '—'}</div></div>
        <div><div className="fx-ov-kpi-l">СИГНАЛОВ</div><div className="fx-ov-kpi-v">{stats?.total ?? 0}</div></div>
        <div><div className="fx-ov-kpi-l">СРЕДНИЙ PNL</div><div className="fx-ov-kpi-v" style={{ color: 'var(--long)' }}>{stats?.avg_pnl_pct != null ? stats.avg_pnl_pct + '%' : '—'}</div></div>
        <div><div className="fx-ov-kpi-l">НЕРЕАЛИЗ. PNL</div><div className="fx-ov-kpi-v" style={{ color: upnlPct == null ? 'var(--muted)' : up ? 'var(--gold,#9a7426)' : 'var(--short)' }}>{upnlPct == null ? '—' : (up ? '+' : '−') + Math.abs(upnlPct).toFixed(2) + '%'}</div></div>
      </div>

      <div className="fx-seclbl">АКТИВНЫЙ СИГНАЛ</div>
      {open ? (
        <div className="fx-sig">
          <div>
            <div style={{ fontSize: '.92rem', color: 'var(--text)' }}>{open.pair} <span style={{ fontStyle: 'italic', color: vc(open.direction) === 'short' ? 'var(--short)' : 'var(--cyan)', fontSize: '.72rem' }}>{open.direction.toLowerCase()}</span></div>
            <div className="fx-sig-mut">вход {fmtPrice(open.entry_price)} · tp {fmtPrice(open.tp_price)} · sl {fmtPrice(open.sl_price)} · {open.timeframe || '15m'}</div>
          </div>
          <div className="fx-sig-cell" style={{ marginLeft: 'auto' }}>
            <div className="fx-ov-kpi-l">ЦЕНА СЕЙЧАС</div>
            <div className="fx-sig-cell-v" style={{ color: 'var(--text)' }}>{livePx != null ? livePx.toFixed(5) : '—'}</div>
          </div>
          <div className="fx-sig-div" />
          <div className="fx-sig-cell">
            <div className="fx-ov-kpi-l">НЕРЕАЛИЗ. PNL</div>
            <div className="fx-sig-cell-v" style={{ color: pnlColor }}>{upnlPct == null ? '—' : (up ? '+' : '−') + '$' + Math.abs(upnlUsd ?? 0).toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div className="fx-sig" style={{ color: 'var(--muted)', fontSize: '.7rem' }}>Нет открытых позиций · бот сканирует рынок</div>
      )}

      <div className="fx-seclbl" style={{ marginTop: 16 }}>ПОСЛЕДНИЕ СИГНАЛЫ</div>
      <div className="tbox">
        <div className="twrap">
          <table className="tbl">
            <thead><tr><th>Дата</th><th>Пара</th><th>TF</th><th>Сигнал</th><th>Conf</th><th>Итог</th></tr></thead>
            <tbody>
              {signals.length ? signals.map(s => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.6rem', color: 'var(--muted)' }}>{fmtLocal(s.created_at)}</td>
                  <td>{s.pair}</td>
                  <td>{s.timeframe}</td>
                  <td><span className={`tag tag-${vc(s.final_verdict)}`}>{s.final_verdict || '—'}</span></td>
                  <td>{s.final_confidence || '—'}%</td>
                  <td>{s.outcome ? <span className={`tag tag-${s.outcome}`}>{s.outcome.toUpperCase()}</span> : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18, fontSize: '.63rem' }}>Пока нет форекс-сигналов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
