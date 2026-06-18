'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import * as klinecharts from 'klinecharts'
import { LineType } from 'klinecharts'
import { FOREX_WATCHLIST } from '@/lib/markets'
import { sessionStates, formatCountdown } from '@/lib/sessions'
import { fmtLocal, fmtPrice } from '@/lib/fmt'

const TFS = [
  { id: '15m', label: '15М' }, { id: '30m', label: '30М' },
  { id: '1h', label: '1Ч' }, { id: '4h', label: '4Ч' },
]

interface Sig {
  id: number; pair: string; timeframe: string
  final_verdict: string | null; final_confidence: number | null
  final_entry: number | null; tp_price?: number | null; sl_price?: number | null
  outcome: string | null; actual_pnl_pct: string | number | null; created_at: string
}

function activeSessionLabel(): string {
  const open = sessionStates().filter(s => s.open)
  if (!open.length) return 'Рынок закрыт'
  return open.map(s => `${s.name} · до закрытия ${formatCountdown(s.minutesLeft)}`).join('  ·  ')
}

export default function ForexAnalysis() {
  const [pair, setPair] = useState('EUR/USD')
  const [tf, setTf] = useState('15m')
  const [signals, setSignals] = useState<Sig[]>([])
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [sessLabel, setSessLabel] = useState(activeSessionLabel())
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const chartId = 'forex-analysis-chart'

  useEffect(() => {
    const iv = setInterval(() => setSessLabel(activeSessionLabel()), 20000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    fetch('/api/signals?market=forex&limit=150').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) setSignals(d.signals || []) }).catch(() => {})
  }, [])

  const drawChart = useCallback(async () => {
    setLoading(true); setEmpty(false)
    const chart = chartRef.current
    if (!chart) return
    try {
      const r = await fetch(`/api/klines?market=forex&symbol=${encodeURIComponent(pair)}&interval=${tf}&limit=200`)
      const data: number[][] = await r.json()
      if (!Array.isArray(data) || !data.length) { setEmpty(true); setLoading(false); return }
      chart.applyNewData(data.map(c => ({ timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] })))
      setLoading(false)
    } catch { setEmpty(true); setLoading(false) }
  }, [pair, tf])

  useEffect(() => {
    chartRef.current = klinecharts.init(chartId, {
      styles: {
        grid: { horizontal: { color: '#ddd5bf', style: LineType.Dashed, dashedValue: [2, 2] }, vertical: { color: '#ddd5bf', style: LineType.Dashed, dashedValue: [2, 2] } },
        candle: {
          bar: { upColor: '#0d7a52', downColor: '#a12f44', noChangeColor: '#9a9176', upBorderColor: '#0d7a52', downBorderColor: '#a12f44', upWickColor: '#0d7a52', downWickColor: '#a12f44' },
          tooltip: { text: { size: 11, family: "'Geist Mono',monospace", color: '#6b6a55' } },
          priceMark: { last: { upColor: '#0d7a52', downColor: '#a12f44', text: { size: 11, family: "'Geist Mono',monospace" } } },
        },
        xAxis: { axisLine: { color: '#d0c6aa' }, tickLine: { color: '#d0c6aa' }, tickText: { color: '#6b6a55', size: 11, family: "'Geist Mono',monospace" } },
        yAxis: { axisLine: { color: '#d0c6aa' }, tickLine: { color: '#d0c6aa' }, tickText: { color: '#6b6a55', size: 11, family: "'Geist Mono',monospace" } },
        crosshair: { horizontal: { line: { color: '#c0b594' }, text: { color: '#f3efe3', backgroundColor: '#1f2d26' } }, vertical: { line: { color: '#c0b594' }, text: { color: '#f3efe3', backgroundColor: '#1f2d26' } } },
      },
    })
    drawChart()
    return () => { klinecharts.dispose(chartId); chartRef.current = null }
  }, [])

  useEffect(() => { if (chartRef.current) drawChart() }, [pair, tf, drawChart])

  const pairSignals = signals.filter(s => s.pair === pair).slice(0, 4)
  const latest = pairSignals[0]
  const geom = (() => {
    if (!latest || !latest.final_entry || !latest.tp_price || !latest.sl_price) return null
    const e = Number(latest.final_entry), tp = Number(latest.tp_price), sl = Number(latest.sl_price)
    const sld = Math.abs(e - sl)
    return sld > 0 ? { e, tp, sl, r: Math.abs(tp - e) / sld } : null
  })()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={pair} onChange={e => setPair(e.target.value)}
          style={{ fontFamily: 'var(--mono)', fontSize: '.72rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--line3)', borderRadius: 4, padding: '6px 10px' }}>
          {FOREX_WATCHLIST.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ display: 'inline-flex', border: '1px solid var(--line3)', borderRadius: 4, overflow: 'hidden' }}>
          {TFS.map(x => (
            <button key={x.id} onClick={() => setTf(x.id)}
              style={{ border: 'none', cursor: 'pointer', padding: '6px 13px', fontFamily: 'var(--mono)', fontSize: '.62rem', letterSpacing: '.04em',
                background: tf === x.id ? 'var(--cyan)' : 'transparent', color: tf === x.id ? 'var(--bg)' : 'var(--muted)' }}>
              {x.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '.6rem', color: 'var(--long)' }}>● {sessLabel}</div>
      </div>

      <div style={{ position: 'relative', border: '1px solid var(--line2)', borderRadius: 4, overflow: 'hidden', background: 'var(--bg2)' }}>
        <div id={chartId} ref={containerRef} style={{ height: 340, width: '100%' }} />
        {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '.7rem', background: 'var(--bg2)' }}>Загрузка свечей…</div>}
        {empty && !loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '.7rem', background: 'var(--bg2)' }}>Нет данных по {pair} · проверьте ключ Twelve Data</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, marginTop: 14 }}>
        <div>
          <div className="fx-seclbl">ГЕОМЕТРИЯ ПОСЛЕДНЕГО СИГНАЛА</div>
          {geom ? (
            <div className="fx-sig" style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '.95rem' }}>{latest.pair}</span>
                <span style={{ fontStyle: 'italic', fontSize: '.72rem', color: latest.final_verdict === 'SHORT' ? 'var(--short)' : 'var(--cyan)' }}>{(latest.final_verdict || '').toLowerCase()}</span>
                <span className="fx-sig-mut" style={{ marginLeft: 'auto' }}>{latest.timeframe} · conf {latest.final_confidence}%</span>
              </div>
              <div style={{ display: 'flex', gap: 18, fontFamily: 'var(--mono)', fontSize: '.66rem' }}>
                <div><div className="fx-ov-kpi-l">ВХОД</div><div style={{ color: 'var(--text)' }}>{fmtPrice(geom.e)}</div></div>
                <div><div className="fx-ov-kpi-l">TP</div><div style={{ color: 'var(--long)' }}>{fmtPrice(geom.tp)}</div></div>
                <div><div className="fx-ov-kpi-l">SL</div><div style={{ color: 'var(--short)' }}>{fmtPrice(geom.sl)}</div></div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div className="fx-ov-kpi-l">R:R</div><div style={{ fontStyle: 'italic', fontSize: '.9rem', color: geom.r >= 2 ? 'var(--long)' : 'var(--wait)', fontFamily: 'var(--display)' }}>1:{geom.r.toFixed(1)}</div></div>
              </div>
            </div>
          ) : (
            <div className="fx-sig" style={{ color: 'var(--muted)', fontSize: '.68rem' }}>Нет сигнала по {pair}. Бот публикует сигнал только при структурном R≥2.</div>
          )}
        </div>

        <div>
          <div className="fx-seclbl">ИСТОРИЯ ПО {pair}</div>
          <div className="tbox">
            <div className="twrap" style={{ maxHeight: 150, overflowY: 'auto' }}>
              <table className="tbl">
                <thead><tr><th>Дата</th><th>Сигнал</th><th>Conf</th><th>Итог</th></tr></thead>
                <tbody>
                  {pairSignals.length ? pairSignals.map(s => (
                    <tr key={s.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '.58rem', color: 'var(--muted)' }}>{fmtLocal(s.created_at)}</td>
                      <td><span className={`tag tag-${(s.final_verdict || '').toLowerCase() === 'short' ? 'short' : (s.final_verdict || '').toLowerCase() === 'long' ? 'long' : 'wait'}`}>{s.final_verdict || '—'}</span></td>
                      <td>{s.final_confidence || '—'}%</td>
                      <td>{s.outcome ? <span className={`tag tag-${s.outcome}`}>{s.outcome.toUpperCase()}</span> : '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 14, fontSize: '.62rem' }}>Пока нет сигналов</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
