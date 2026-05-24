'use client'
import { useState } from 'react'
import type { TFResult } from '@/app/api/analyze/multitf/route'

interface MultiTFData {
  ok: boolean
  pair: string
  tfs: Record<string, TFResult | null>
  overallBias: 'LONG' | 'SHORT' | 'WAIT'
  longCount: number
  shortCount: number
  ts: number
}

interface Props {
  open: boolean
  pair: string
  onClose: () => void
}

const TF_LABELS: Record<string, string> = { '5m': '5M', '15m': '15M', '1h': '1H', '4h': '4H' }
const TF_ORDER = ['5m', '15m', '1h', '4h']

function SignalBadge({ signal, confidence }: { signal: string; confidence: number }) {
  const color = signal === 'LONG' ? 'var(--long)' : signal === 'SHORT' ? 'var(--short)' : 'var(--wait)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color, fontSize: '.65rem' }}>
      {signal}
      <span style={{ fontWeight: 400, fontSize: '.55rem', color: 'var(--muted)' }}>{confidence}%</span>
    </span>
  )
}

export default function MultiTFModal({ open, pair, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MultiTFData | null>(null)
  const [err, setErr] = useState('')

  async function run() {
    const sym = pair.replace('/', '')
    setLoading(true)
    setErr('')
    try {
      const r = await fetch(`/api/analyze/multitf?pair=${sym}`)
      const json = await r.json()
      if (!json.ok) { setErr(json.error || 'error'); return }
      setData(json)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const biasColor = data?.overallBias === 'LONG' ? 'var(--long)' : data?.overallBias === 'SHORT' ? 'var(--short)' : 'var(--wait)'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto', padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700 }}>MULTI TIMEFRAME · {pair}</div>
            {data && <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginTop: 2 }}>{new Date(data.ts).toLocaleTimeString()}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        {!data && !loading && (
          <div style={{ textAlign: 'center', padding: '20px 0 14px' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--dim)', marginBottom: 16, lineHeight: 1.7 }}>
              Pure algo analysis on 5M / 15M / 1H / 4H.
              <br />No Groq — instant confluence check.
            </div>
            <button
              onClick={run}
              style={{ padding: '7px 24px', fontSize: '.65rem', borderRadius: 4, border: 'none', background: 'var(--cyan)', color: '#000', cursor: 'pointer', fontWeight: 700 }}
            >
              ANALYZE ALL TF
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div className="ld-bar" style={{ width: 160, margin: '0 auto 10px' }} />
            <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Analyzing 4 timeframes…</div>
          </div>
        )}

        {err && <div style={{ fontSize: '.6rem', color: 'var(--short)', padding: '10px 0' }}>{err}</div>}

        {!loading && data && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 6, borderLeft: `3px solid ${biasColor}` }}>
              <span style={{ fontSize: '.58rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Overall bias</span>
              <span style={{ fontWeight: 700, fontSize: '.8rem', color: biasColor }}>{data.overallBias}</span>
              <span style={{ fontSize: '.55rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                {data.longCount}L / {data.shortCount}S
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TF_ORDER.map(tf => {
                const r = data.tfs[tf]
                if (!r) return (
                  <div key={tf} style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--muted)' }}>{TF_LABELS[tf]}</span>
                    <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>—</span>
                  </div>
                )
                const bcolor = r.signal === 'LONG' ? 'var(--long)' : r.signal === 'SHORT' ? 'var(--short)' : 'var(--wait)'
                return (
                  <div key={tf} style={{ display: 'grid', gridTemplateColumns: '36px auto 1fr', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 5, borderLeft: `3px solid ${bcolor}`, alignItems: 'start' }}>
                    <span style={{ fontSize: '.65rem', fontWeight: 700 }}>{TF_LABELS[tf]}</span>
                    <SignalBadge signal={r.signal} confidence={r.confidence} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: '.55rem', color: 'var(--muted)' }}>
                        RSI {r.rsi} · ATR {r.atrPct}% · Trend: {r.trend}
                      </div>
                      <div style={{ fontSize: '.53rem', color: 'var(--dim)' }}>
                        EMA50 {r.ema50} · EMA200 {r.ema200}
                      </div>
                      {r.agreeing.length > 0 && (
                        <div style={{ fontSize: '.52rem', color: 'var(--long)' }}>↑ {r.agreeing.join(', ')}</div>
                      )}
                      {r.disagreeing.length > 0 && (
                        <div style={{ fontSize: '.52rem', color: 'var(--short)' }}>↓ {r.disagreeing.join(', ')}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={run}
              disabled={loading}
              style={{ width: '100%', marginTop: 12, padding: '8px 0', borderRadius: 4, border: '1px solid var(--line2)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer', fontSize: '.65rem' }}
            >
              Refresh
            </button>
          </>
        )}
      </div>
    </div>
  )
}
