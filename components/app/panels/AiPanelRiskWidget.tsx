'use client'
interface AiPanelRiskWidgetProps {
  data: Record<string, unknown>
}

export default function AiPanelRiskWidget({ data }: AiPanelRiskWidgetProps) {
  const rm = data as Record<string, unknown>
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ flex: '1 1 80px', textAlign: 'center' }}>
        <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>БАЛАНС</div>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text)' }}>${Number(rm.balance || 0).toLocaleString()}</div>
      </div>
      <div style={{ flex: '1 1 80px', textAlign: 'center' }}>
        <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>РИСК $</div>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#ff6b6b' }}>${Number(rm.risk_usd || 0).toFixed(2)}</div>
      </div>
      <div style={{ flex: '1 1 80px', textAlign: 'center' }}>
        <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>ПОЗИЦИЯ</div>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text)' }}>${Number(rm.pos_usd || 0).toLocaleString()}</div>
      </div>
      <div style={{ flex: '1 1 60px', textAlign: 'center' }}>
        <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>R:R</div>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#00e676' }}>{rm.rr ? `1:${Number(rm.rr).toFixed(1)}` : '—'}</div>
      </div>
      <div style={{ flex: '1 1 60px', textAlign: 'center' }}>
        <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>МИН R:R</div>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--dim)' }}>{rm.min_rr ? `1:${Number(rm.min_rr).toFixed(1)}` : '—'}</div>
      </div>
    </div>
  )
}