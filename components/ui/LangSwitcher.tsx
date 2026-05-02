'use client'
import { useState, useRef, useEffect } from 'react'
import { useLang } from '@/contexts/LangContext'

const LANGS = [
  { code: 'en', label: 'English',  flag: '🇺🇸' },
  { code: 'ru', label: 'Русский',  flag: '🇷🇺' },
  { code: 'kz', label: 'Қазақша', flag: '🇰🇿' },
] as const

export default function LangSwitcher() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGS.find(l => l.code === lang) ?? LANGS[0]

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          background: 'var(--bg3)', border: '1px solid var(--line2)',
          color: 'var(--text)', fontSize: '.72rem', fontWeight: 500,
        }}
      >
        <span style={{ fontSize: '1rem' }}>{current.flag}</span>
        <span>{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ color: 'var(--muted)', marginLeft: 2 }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)', right: 0,
          background: 'var(--bg2)', border: '1px solid var(--line2)',
          borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          minWidth: 140, overflow: 'hidden', zIndex: 1000,
        }}>
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '9px 14px', background: l.code === lang ? 'var(--bg3)' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: '.72rem',
                color: l.code === lang ? 'var(--cyan)' : 'var(--text)',
                textAlign: 'left',
                borderLeft: l.code === lang ? '2px solid var(--cyan)' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{l.flag}</span>
              <span>{l.label}</span>
              {l.code === lang && <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: 'var(--cyan)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
