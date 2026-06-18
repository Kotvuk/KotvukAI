'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LangContext'
import { fmtLocal } from '@/lib/fmt'

interface ClosedTrade {
  id: number; pair: string; timeframe: string | null
  direction: string; pnl_pct: number | null; closed_at: string | null
}

interface BotLog {
  id: number; pair: string; timeframe: string
  final_verdict: string | null; final_confidence: number | null
  final_entry: number | null; outcome: string | null; created_at: string
}

interface BotSummary {
  total: number; long: number; short: number; wait: number
  wins: number; losses: number; lastRunAgo: number | null; activeSignals: number
}

function vc(v: string | null) {
  if (!v) return 'wait'
  const u = v.toUpperCase()
  return u === 'LONG' ? 'long' : u === 'SHORT' ? 'short' : 'wait'
}

function timeAgo(mins: number | null, justNow: string, mAgo: string, hAgo: string): string {
  if (mins === null) return '—'
  if (mins < 2) return justNow
  if (mins < 60) return `${mins}${mAgo}`
  return `${Math.round(mins / 60)}${hAgo}`
}

export default function DashPanel() {
  const { t } = useLang()
  const [stats, setStats] = useState<{
    total: number; resolved: number; win_rate: number | null; avg_confidence: number | null; avg_pnl_pct: string | null; total_pnl_pct: string | null
    by_pair: { pair: string; total: number; win_rate: number | null }[]
  } | null>(null)
  const [recentTrades, setRecentTrades] = useState<ClosedTrade[]>([])
  const [botSummary, setBotSummary] = useState<BotSummary | null>(null)
  const [botLog, setBotLog] = useState<BotLog[]>([])
  const [showBotLog, setShowBotLog] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [sr, dr, br] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/trades?account=ai&limit=30'),
      fetch('/api/analyze/auto/log'),
    ])
    if (sr.ok) { const s = await sr.json(); if (s.ok) setStats(s) }
    if (dr.ok) {
      const d = await dr.json()
      if (d.ok) {
        const closed = (d.trades || []).filter((t: ClosedTrade & { status: string }) => t.status === 'closed')
        setRecentTrades(closed.slice(0, 10))
      }
    }
    if (br.ok) {
      const b = await br.json()
      if (b.ok) { setBotSummary(b.summary); setBotLog(b.signals || []) }
    }
  }

  return (
    <div className="panel active" id="panel-dash">
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-v">{stats?.win_rate != null ? stats.win_rate + '%' : '—'}</div>
          <div className="kpi-l">{t('win_rate')}</div>
          {stats != null && <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginTop: 2 }}>{stats.resolved} {t('resolved_lbl')}</div>}
        </div>
        <div className="kpi"><div className="kpi-v">{stats?.total || 0}</div><div className="kpi-l">{t('signals')}</div></div>
        <div className="kpi"><div className="kpi-v">{stats?.avg_confidence != null ? stats.avg_confidence + '%' : '—'}</div><div className="kpi-l">{t('avg_confidence')}</div></div>
        <div className="kpi"><div className="kpi-v" style={{ color: stats?.total_pnl_pct != null ? (parseFloat(stats.total_pnl_pct) >= 0 ? 'var(--long)' : 'var(--short)') : undefined }}>{stats?.total_pnl_pct != null ? (parseFloat(stats.total_pnl_pct) >= 0 ? '+' : '') + stats.total_pnl_pct + '%' : '—'}</div><div className="kpi-l">{t('total_pnl')}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <div className="tbox">
          <div className="thead"><span className="thead-t">{t('recent_trades')}</span></div>
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>{t('date')}</th><th>{t('pair')}</th><th>{t('tf')}</th><th>{t('signal')}</th><th>PnL</th></tr></thead>
              <tbody>
                {recentTrades.length ? recentTrades.map(tr => (
                  <tr key={tr.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '.6rem', color: 'var(--dim)' }}>{tr.closed_at ? fmtLocal(tr.closed_at) : '—'}</td>
                    <td>{tr.pair}</td>
                    <td>{tr.timeframe || '—'}</td>
                    <td><span className={`tag tag-${tr.direction}`}>{tr.direction.toUpperCase()}</span></td>
                    <td style={{ color: tr.pnl_pct != null ? (tr.pnl_pct >= 0 ? 'var(--long)' : 'var(--short)') : 'var(--dim)', fontWeight: 600 }}>
                      {tr.pnl_pct != null ? (tr.pnl_pct >= 0 ? '+' : '') + tr.pnl_pct + '%' : '—'}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--dim)', padding: 18, fontSize: '.63rem' }}>{t('no_trades')}</td></tr>
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

      {botSummary && (
        <div className="tbox" style={{ marginTop: 12 }}>
          <div className="thead" style={{ cursor: 'pointer' }} onClick={() => setShowBotLog(v => !v)}>
            <span className="thead-t">{t('bot_title')}</span>
            <span style={{ fontSize: '.58rem', color: 'var(--muted)', marginLeft: 8 }}>
              {t('bot_last_run')}: {timeAgo(botSummary.lastRunAgo, t('just_now'), t('mins_ago'), t('hours_ago'))}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: 'var(--dim)' }}>{showBotLog ? '▲' : '▼'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', flexWrap: 'wrap' }}>
            {[
              { l: t('bot_total'), v: botSummary.total,        c: 'var(--text)' },
              { l: 'LONG',         v: botSummary.long,          c: 'var(--long)' },
              { l: 'SHORT',        v: botSummary.short,         c: 'var(--short)' },
              { l: 'WAIT',         v: botSummary.wait,          c: 'var(--dim)' },
              { l: 'Win',          v: botSummary.wins,          c: 'var(--long)' },
              { l: 'Loss',         v: botSummary.losses,        c: 'var(--short)' },
              { l: t('bot_active'), v: botSummary.activeSignals, c: 'var(--cyan)' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ flex: '1 1 50px', background: 'var(--bg3)', borderRadius: 4, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '.5rem', color: 'var(--dim)' }}>{l}</div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          {showBotLog && botLog.length > 0 && (
            <div className="twrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr><th>{t('bot_time_lbl')}</th><th>{t('pair')}</th><th>TF</th><th>{t('signal')}</th><th>Conf</th><th>{t('result')}</th></tr>
                </thead>
                <tbody>
                  {botLog.map(s => (
                    <tr key={s.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtLocal(s.created_at)}</td>
                      <td>{s.pair}</td>
                      <td>{s.timeframe}</td>
                      <td><span className={`tag tag-${vc(s.final_verdict)}`}>{s.final_verdict || '—'}</span></td>
                      <td>{s.final_confidence || '—'}%</td>
                      <td>{s.outcome ? <span className={`tag tag-${s.outcome}`}>{s.outcome.toUpperCase()}</span> : <span style={{ color: 'var(--dim)' }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showBotLog && botLog.length === 0 && (
            <div style={{ textAlign: 'center', padding: 14, color: 'var(--dim)', fontSize: '.63rem' }}>
              {t('bot_no_data')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
