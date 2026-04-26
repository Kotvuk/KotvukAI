'use client'
interface AiPanelQualityCardProps {
  ob: Record<string, unknown>
}

export default function AiPanelQualityCard({ ob }: AiPanelQualityCardProps) {
  const score = Number(ob.score ?? 0)
  const scoreColor = score >= 80 ? '#00e676' : score >= 60 ? '#ffd60a' : score >= 40 ? '#ff9800' : '#ff4444'
  const qualColor = ob.quality === 'A+' ? '#00e676' : ob.quality === 'A' ? '#69f0ae' : ob.quality === 'B' ? '#ffd60a' : '#888'

  return (
    <div style={{ margin: '8px 0', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: `1px solid ${scoreColor}30` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '.56rem', color: 'var(--dim)', fontWeight: 700, letterSpacing: '.06em' }}>ORDER BLOCK — ЗОНА ВХОДА</span>
        <span style={{ fontSize: '.64rem', fontWeight: 700, color: scoreColor }}>{score}/100 — {String(ob.verdict ?? '')}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: '.62rem', fontWeight: 800, color: qualColor, background: `${qualColor}18`, padding: '2px 7px', borderRadius: 4 }}>{String(ob.quality ?? '?')}</span>
        <span style={{ fontSize: '.62rem', color: 'var(--text)' }}>${Number(ob.low ?? 0).toLocaleString()} — ${Number(ob.high ?? 0).toLocaleString()}</span>
        {Boolean(ob.isFresh) && <span style={{ fontSize: '.6rem', color: '#00e676', background: 'rgba(0,230,118,0.12)', padding: '2px 6px', borderRadius: 4 }}>✓ Свежий</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>Объём: <b style={{ color: 'var(--text)' }}>{Number(ob.relVolume ?? 0).toFixed(1)}×</b></span>
        <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>Импульс: <b style={{ color: 'var(--text)' }}>{Number(ob.impulseSize ?? 0).toFixed(1)}%</b></span>
        <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>Возраст: <b style={{ color: 'var(--text)' }}>{Number(ob.ageCandles ?? 0)} св.</b></span>
        <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>Касания: <b style={{ color: 'var(--text)' }}>{Number(ob.touchCount ?? 0)}</b></span>
      </div>
    </div>
  )
}