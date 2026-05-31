'use client'
import { useState } from 'react'
import type { ScreenerSetup } from '@/app/api/screener/route'

const TF_OPTIONS = [
  { label: '5M', val: '5m' }, { label: '15M', val: '15m' },
  { label: '1H', val: '1h' }, { label: '4H', val: '4h' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSelectPair?: (pair: string) => void
}

export default function ScreenerModal({ open, onClose, onSelectPair }: Props) {
  const [tf, setTf] = useState('1h')
  const [loading, setLoading] = useState(false)
  const [setups, setSetups] = useState<ScreenerSetup[]>([])
  const [scanned, setScanned] = useState(0)
  const [ts, setTs] = useState(0)
  const [err, setErr] = useState('')

  async function run() {
    setLoading(true)
    setErr('')
    try {
      const r = await fetch(`/api/screener?tf=${tf}`)
      const data = await r.json()
      if (!data.ok) { setErr(data.error || 'error'); return }
      setSetups(data.setups)
      setScanned(data.scanned)
      setTs(data.ts)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto', padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700 }}>SCREENER</div>
            <div style={{ fontSize: '.5rem', color: 'var(--dim)', marginTop: 1 }}>
              алго-предфильтр · подтверди через анализ
            </div>
            {ts > 0 && (
              <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginTop: 2 }}>
                {scanned} pairs · {new Date(ts).toLocaleTimeString()}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {TF_OPTIONS.map(({ label, val }) => (
              <button
                key={val}
                onClick={() => setTf(val)}
                style={{ padding: '3px 10px', fontSize: '.6rem', borderRadius: 4, border: '1px solid var(--line2)', background: tf === val ? 'var(--cyan)' : 'var(--bg3)', color: tf === val ? '#000' : 'var(--text)', cursor: 'pointer', fontWeight: tf === val ? 700 : 400 }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={run}
            disabled={loading}
            style={{ marginLeft: 'auto', padding: '4px 14px', fontSize: '.62rem', borderRadius: 4, border: 'none', background: 'var(--cyan)', color: '#000', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : 'SCAN'}
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div className="ld-bar" style={{ width: 160, margin: '0 auto 10px' }} />
            <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Scanning {scanned || 50} pairs…</div>
          </div>
        )}

        {err && (
          <div style={{ fontSize: '.6rem', color: 'var(--short)', padding: '10px 0' }}>{err}</div>
        )}

        {!loading && setups.length === 0 && ts > 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--dim)', fontSize: '.63rem' }}>No actionable setups found</div>
        )}

        {!loading && setups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 48px 44px 52px', gap: 6, padding: '4px 6px', fontSize: '.52rem', color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              <span>Pair</span><span>Lean</span><span>Conf</span><span>RSI</span><span>Methods</span>
            </div>
            {setups.map(s => (
              <div
                key={s.pair}
                onClick={() => { onSelectPair?.(s.pair); onClose() }}
                style={{ display: 'grid', gridTemplateColumns: '1fr 52px 48px 44px 52px', gap: 6, padding: '7px 8px', background: 'var(--bg3)', borderRadius: 5, cursor: onSelectPair ? 'pointer' : 'default', borderLeft: `3px solid ${s.signal === 'LONG' ? 'var(--long)' : 'var(--short)'}`, alignItems: 'center' }}
              >
                <span style={{ fontSize: '.65rem', fontWeight: 600 }}>{s.pair}</span>
                <span style={{ fontSize: '.6rem', fontWeight: 700, color: s.signal === 'LONG' ? 'var(--long)' : 'var(--short)' }}>{s.signal}</span>
                <span style={{ fontSize: '.6rem', color: s.confidence >= 70 ? 'var(--long)' : s.confidence >= 60 ? 'var(--wait)' : 'var(--muted)' }}>{s.confidence}%</span>
                <span style={{ fontSize: '.6rem', color: s.rsi > 70 ? 'var(--short)' : s.rsi < 30 ? 'var(--long)' : 'var(--muted)' }}>{s.rsi}</span>
                <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>{s.agreeing}/{s.total}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && setups.length === 0 && ts === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--dim)', lineHeight: 1.8 }}>
              Pure algorithmic scan (SMC + Indicators + Price Action + Wyckoff + Volume).
              <br />Instant market-wide results.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
