'use client'
import { useLang } from '@/contexts/LangContext'

const LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'kz', label: 'KZ' },
] as const

export default function LangSwitcher() {
  const { lang, setLang } = useLang()

  return (
    <div style={{ display: 'flex', gap: 2, padding: 3, border: '1px solid rgba(255,255,255,.07)', borderRadius: 7 }}>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          style={{
            padding: '4px 9px',
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            fontSize: '.7rem',
            fontWeight: 600,
            letterSpacing: '.03em',
            background: l.code === lang ? 'rgba(255,255,255,.1)' : 'transparent',
            color: l.code === lang ? '#fff' : 'rgba(255,255,255,.4)',
            transition: 'background .15s, color .15s',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
