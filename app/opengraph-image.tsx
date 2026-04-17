import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'KotvukAI — AI-анализ криптовалют'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: '#080808',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'flex-start',
          padding: '80px 90px',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        {/* Grid background lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.4,
          display: 'flex',
        }} />

        {/* Cyan accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#00d4ff', display: 'flex' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
          <svg width="36" height="36" viewBox="0 0 32 32">
            <polygon points="16,2 30,12 25,30 7,30 2,12" fill="#00d4ff" />
          </svg>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', letterSpacing: '-1px' }}>
            KOTVUK<span style={{ color: '#00d4ff' }}>AI</span>
          </span>
        </div>

        {/* Headline */}
        <div style={{ fontSize: 72, fontWeight: 900, color: '#ffffff', lineHeight: 1.0, letterSpacing: '-2px', marginBottom: 28, display: 'flex', flexDirection: 'column' }}>
          <span>AI-анализ</span>
          <span style={{ color: '#00d4ff' }}>криптовалют</span>
        </div>

        {/* Description */}
        <div style={{ fontSize: 26, color: '#555555', lineHeight: 1.6, maxWidth: 700, display: 'flex' }}>
          Сигналы LONG/SHORT · SMC Order Blocks · Fair Value Gaps · Fibonacci · Торговый журнал
        </div>

        {/* Tags bottom */}
        <div style={{ position: 'absolute', bottom: 60, left: 90, display: 'flex', gap: 16 }}>
          {['Бесплатно', 'SMC + OTE', 'Groq AI'].map(tag => (
            <div key={tag} style={{
              padding: '8px 18px',
              border: '1px solid #2c2c2c',
              color: '#444',
              fontSize: 18,
              display: 'flex',
            }}>{tag}</div>
          ))}
        </div>

        {/* URL */}
        <div style={{ position: 'absolute', bottom: 64, right: 90, fontSize: 20, color: '#333', display: 'flex' }}>
          kotvukai.vercel.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
