'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LangContext'

interface Signal {
  id: number; pair: string; timeframe: string
  final_verdict: string | null; final_confidence: number | null
  final_risk_score: number | null; outcome: string | null; created_at: string
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

function timeAgo(mins: number | null): string {
  if (mins === null) return '—'
  if (mins < 2) return 'только что'
  if (mins < 60) return `${mins}м назад`
  return `${Math.round(mins / 60)}ч назад`
}

export default function DashPanel() {
  const { t } = useLang()
  const [stats, setStats] = useState<{
    total: number; resolved: number; win_rate: number | null; avg_confidence: number | null; avg_pnl_pct: string | null
    by_pair: { pair: string; total: number; win_rate: number | null }[]
  } | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [botSummary, setBotSummary] = useState<BotSummary | null>(null)
  const [botLog, setBotLog] = useState<BotLog[]>([])
  const [showBotLog, setShowBotLog] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [sr, dr, br] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/signals?limit=10'),
      fetch('/api/analyze/auto/log'),
    ])
    if (sr.ok) { const s = await sr.json(); if (s.ok) setStats(s) }
    if (dr.ok) { const d = await dr.json(); if (d.ok) setSignals(d.signals || []) }
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

      {botSummary && (
        <div className="tbox" style={{ marginTop: 12 }}>
          <div className="thead" style={{ cursor: 'pointer' }} onClick={() => setShowBotLog(v => !v)}>
            <span className="thead-t">🤖 Авто-бот · 48ч</span>
            <span style={{ fontSize: '.58rem', color: 'var(--muted)', marginLeft: 8 }}>
              Последний запуск: {timeAgo(botSummary.lastRunAgo)}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: 'var(--dim)' }}>{showBotLog ? '▲' : '▼'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', flexWrap: 'wrap' }}>
            {[
              { l: 'Всего',    v: botSummary.total,         c: 'var(--text)' },
              { l: 'LONG',     v: botSummary.long,           c: 'var(--long)' },
              { l: 'SHORT',    v: botSummary.short,          c: 'var(--short)' },
              { l: 'WAIT',     v: botSummary.wait,           c: 'var(--dim)' },
              { l: 'Win',      v: botSummary.wins,           c: 'var(--long)' },
              { l: 'Loss',     v: botSummary.losses,         c: 'var(--short)' },
              { l: 'Активных', v: botSummary.activeSignals,  c: 'var(--cyan)' },
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
                  <tr><th>Время</th><th>Пара</th><th>TF</th><th>Сигнал</th><th>Conf</th><th>Итог</th></tr>
                </thead>
                <tbody>
                  {botLog.map(s => (
                    <tr key={s.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(s.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        {' '}
                        <span style={{ color: 'var(--dim)', fontSize: '.55rem' }}>
                          {new Date(s.created_at).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </td>
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
              Нет данных за 48 часов
            </div>
          )}
        </div>
      )}
    </div>
  )
}
