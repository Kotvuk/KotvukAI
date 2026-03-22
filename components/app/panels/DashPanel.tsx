'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LangContext'

interface Signal {
  id: number; pair: string; timeframe: string
  final_verdict: string | null; final_confidence: number | null
  final_risk_score: number | null; outcome: string | null; created_at: string
}

function vc(v: string | null) {
  if (!v) return 'wait'
  const u = v.toUpperCase()
  return u === 'LONG' ? 'long' : u === 'SHORT' ? 'short' : 'wait'
}

export default function DashPanel() {
  const { t } = useLang()
  const [stats, setStats] = useState<{
    total: number; win_rate: number | null; avg_confidence: number | null; avg_pnl_pct: string | null
    by_pair: { pair: string; total: number; win_rate: number | null }[]
  } | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const [sr, dr] = await Promise.all([fetch('/api/stats'), fetch('/api/signals?limit=10')])
    if (sr.ok) { const s = await sr.json(); if (s.ok) setStats(s) }
    if (dr.ok) { const d = await dr.json(); if (d.ok) setSignals(d.signals || []) }
  }

  return (
    <div className="panel active" id="panel-dash">
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-v">{stats?.win_rate != null ? stats.win_rate + '%' : '—'}</div><div className="kpi-l">{t('win_rate')}</div></div>
        <div className="kpi"><div className="kpi-v">{stats?.total || 0}</div><div className="kpi-l">{t('signals')}</div></div>
        <div className="kpi"><div className="kpi-v">{stats?.avg_confidence != null ? stats.avg_confidence + '%' : '—'}</div><div className="kpi-l">{t('avg_confidence')}</div></div>
        <div className="kpi"><div className="kpi-v">{stats?.avg_pnl_pct != null ? stats.avg_pnl_pct + '%' : '—'}</div><div className="kpi-l">{t('avg_pnl')}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <div className="tbox">
          <div className="thead"><span className="thead-t">{t('recent_signals')}</span></div>
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>{t('pair')}</th><th>{t('tf')}</th><th>{t('signal')}</th><th>{t('conf')}</th><th>{t('risk')}</th><th>{t('result')}</th></tr></thead>
              <tbody>
                {signals.length ? signals.map(s => (
                  <tr key={s.id}>
                    <td>{s.pair}</td>
                    <td>{s.timeframe}</td>
                    <td><span className={`tag tag-${vc(s.final_verdict)}`}>{s.final_verdict || '—'}</span></td>
                    <td>{s.final_confidence || '—'}%</td>
                    <td>{s.final_risk_score || '—'}/10</td>
                    <td>{s.outcome ? <span className={`tag tag-${s.outcome}`}>{s.outcome.toUpperCase()}</span> : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--dim)', padding: 18, fontSize: '.63rem' }}>{t('no_data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="tbox">
          <div className="thead"><span className="thead-t">{t('by_pair')}</span></div>
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>{t('pair')}</th><th>N</th><th>Win%</th></tr></thead>
              <tbody>
                {stats?.by_pair?.length ? stats.by_pair.map(p => (
                  <tr key={p.pair}>
                    <td>{p.pair}</td><td>{p.total}</td>
                    <td>{p.win_rate != null ? p.win_rate + '%' : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--dim)', padding: 18, fontSize: '.63rem' }}>{t('no_data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
