'use client'
import { useEffect, useState } from 'react'
import { fmtLocal } from '@/lib/fmt'

interface Sig {
  id: number; pair: string; timeframe: string
  final_verdict: string | null; final_confidence: number | null
  outcome: string | null; actual_pnl_pct: string | number | null; created_at: string
}

type Filter = 'all' | 'win' | 'loss' | 'expired'

function vc(v: string | null) {
  const u = (v || '').toUpperCase()
  return u === 'LONG' ? 'long' : u === 'SHORT' ? 'short' : 'wait'
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' }, { id: 'win', label: 'Прибыль' },
  { id: 'loss', label: 'Убыток' }, { id: 'expired', label: 'Истёк' },
]

export default function ForexHistory() {
  const [signals, setSignals] = useState<Sig[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    fetch('/api/signals?market=forex&limit=200').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) setSignals(d.signals || []) }).catch(() => {})
  }, [])

  const rows = signals.filter(s => filter === 'all' ? true : s.outcome === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div className="fx-seclbl" style={{ margin: 0 }}>ИСТОРИЯ ФОРЕКС-СИГНАЛОВ</div>
        <div style={{ display: 'inline-flex', border: '1px solid var(--line3)', borderRadius: 4, overflow: 'hidden' }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ border: 'none', cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--mono)', fontSize: '.58rem', letterSpacing: '.04em',
                background: filter === f.id ? 'var(--cyan)' : 'transparent', color: filter === f.id ? 'var(--bg)' : 'var(--muted)' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="tbox">
        <div className="twrap">
          <table className="tbl">
            <thead><tr><th>Дата</th><th>Пара</th><th>TF</th><th>Сигнал</th><th>Conf</th><th>Итог</th><th>PnL</th></tr></thead>
            <tbody>
              {rows.length ? rows.map(s => {
                const pnl = s.actual_pnl_pct == null ? null : Number(s.actual_pnl_pct)
                return (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '.6rem', color: 'var(--muted)' }}>{fmtLocal(s.created_at)}</td>
                    <td>{s.pair}</td>
                    <td>{s.timeframe}</td>
                    <td><span className={`tag tag-${vc(s.final_verdict)}`}>{s.final_verdict || '—'}</span></td>
                    <td>{s.final_confidence || '—'}%</td>
                    <td>{s.outcome ? <span className={`tag tag-${s.outcome}`}>{s.outcome.toUpperCase()}</span> : '—'}</td>
                    <td style={{ color: pnl == null ? 'var(--muted)' : pnl >= 0 ? 'var(--long)' : 'var(--short)' }}>{pnl == null ? '—' : (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '%'}</td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20, fontSize: '.63rem' }}>Нет записей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
