'use client'
import { useState, useEffect } from 'react'
import { useLang } from '@/contexts/LangContext'
import { fmtAlmaty } from '@/lib/fmt'

interface Signal {
  id: number; pair: string; timeframe: string
  final_verdict: string | null; final_confidence: number | null
  final_entry: number | null; final_tp: number | null; final_sl: number | null
  outcome: string | null; created_at: string
  raw_response?: Record<string, unknown>
}

interface Props {
  currentPair: string
  currentTf: string
  currentVerdict: string
  onClose: () => void
}

function vc(v: string | null) {
  if (!v) return 'wait'
  return v.toUpperCase() === 'LONG' ? 'long' : v.toUpperCase() === 'SHORT' ? 'short' : 'wait'
}

export default function HistoricalSetupsModal({ currentPair, currentTf, currentVerdict, onClose }: Props) {
  const { t } = useLang()
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'same_pair' | 'same_signal'>('same_signal')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const r = await fetch('/api/signals?limit=200')
      const d = await r.json()
      if (d.ok) setSignals(d.signals || [])
      setLoading(false)
    })()
  }, [])

  const filtered = signals.filter(s => {
    if (filter === 'same_pair') return s.pair === currentPair && s.timeframe === currentTf
    if (filter === 'same_signal') return s.pair === currentPair && s.final_verdict?.toUpperCase() === currentVerdict.toUpperCase()
    return true
  })

  const wins = filtered.filter(s => s.outcome === 'win').length
  const resolved = filtered.filter(s => s.outcome).length
  const wr = resolved > 0 ? Math.round((wins / resolved) * 100) : null

  const winConf = filtered.filter(s => s.outcome === 'win' && s.final_confidence).map(s => s.final_confidence!)
  const lossConf = filtered.filter(s => s.outcome === 'loss' && s.final_confidence).map(s => s.final_confidence!)
  const avgWinConf = winConf.length ? Math.round(winConf.reduce((a, b) => a + b, 0) / winConf.length) : null
  const avgLossConf = lossConf.length ? Math.round(lossConf.reduce((a, b) => a + b, 0) / lossConf.length) : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 6, width: 520, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line2)' }}>
          <span style={{ fontSize: '.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {t('similar_setups_title').replace('{pair}', currentPair).replace('{tf}', currentTf)}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid var(--line2)' }}>
          {[
            { id: 'same_signal', label: t('same_signal_filter_lbl').replace('{verdict}', currentVerdict) },
            { id: 'same_pair',   label: `${currentPair} ${currentTf}` },
            { id: 'all',         label: t('all_signals_filter_lbl') },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              style={{
                padding: '3px 10px', fontSize: '.6rem', borderRadius: 3, cursor: 'pointer', border: 'none',
                background: filter === f.id ? 'var(--cyan)' : 'var(--bg3)',
                color: filter === f.id ? '#000' : 'var(--muted)',
                fontWeight: filter === f.id ? 600 : 400,
              }}
            >{f.label}</button>
          ))}
        </div>

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--line2)', flexShrink: 0 }}>
            {[
              { l: t('found_count_lbl'), v: filtered.length },
              { l: t('resolved_lbl'),    v: resolved },
              { l: 'Win Rate', v: wr !== null ? `${wr}%` : '—', c: wr != null ? (wr >= 55 ? 'var(--long)' : wr >= 45 ? 'var(--wait)' : 'var(--short)') : undefined },
              { l: t('avg_conf_win_lbl'), v: avgWinConf !== null ? `${avgWinConf}%` : '—', c: 'var(--long)' },
              { l: t('avg_conf_loss_lbl'), v: avgLossConf !== null ? `${avgLossConf}%` : '—', c: 'var(--short)' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 3, padding: '5px 7px', textAlign: 'center' }}>
                <div style={{ fontSize: '.52rem', color: 'var(--muted)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: '.68rem', fontWeight: 700, color: c || 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div className="ld-bar" style={{ width: 120 }} />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--dim)', fontSize: '.65rem' }}>
              {t('no_similar_lbl')}
            </div>
          )}
          {!loading && filtered.map(s => {
            const rr = s.final_tp && s.final_entry && s.final_sl
              ? Math.abs(s.final_tp - s.final_entry) / Math.abs(s.final_entry - s.final_sl)
              : null
            return (
              <div key={s.id} style={{ padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span className={`tag tag-${vc(s.final_verdict)}`} style={{ fontSize: '.55rem' }}>{s.final_verdict}</span>
                    <span style={{ fontSize: '.6rem', color: 'var(--text)' }}>{s.pair} · {s.timeframe}</span>
                    <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>{fmtAlmaty(s.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>{t('entry_price_short_lbl')}{parseFloat(String(s.final_entry || 0)).toLocaleString()}</span>
                    <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>{t('conf')} {s.final_confidence}%</span>
                    {rr && <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>R:R {rr.toFixed(1)}</span>}
                  </div>
                </div>
                <div>
                  {s.outcome
                    ? <span className={`tag tag-${s.outcome}`} style={{ fontSize: '.58rem' }}>{s.outcome.toUpperCase()}</span>
                    : <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>?</span>
                  }
                </div>
              </div>
            )
          })}
        </div>

        {!loading && wr !== null && resolved >= 3 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', background: wr >= 55 ? 'rgba(0,230,118,0.06)' : 'rgba(255,165,0,0.06)', flexShrink: 0 }}>
            <div style={{ fontSize: '.63rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              {wr >= 65 && t('high_accuracy_setup_lbl').replace('{wr}', String(wr))}
              {wr >= 50 && wr < 65 && t('moderate_accuracy_setup_lbl').replace('{wr}', String(wr))}
              {wr < 50 && t('low_accuracy_setup_lbl').replace('{wr}', String(wr))}
              {avgWinConf && avgLossConf && ` ${t('ai_conf_comparison_lbl').replace('{winConf}', String(avgWinConf)).replace('{lossConf}', String(avgLossConf))}`}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
