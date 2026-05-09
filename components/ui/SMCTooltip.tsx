'use client'
import { useState, useRef, useEffect } from 'react'
import { useLang } from '@/contexts/LangContext'

const GLOSSARY: Record<string, { ru: string; en: string; kz: string }> = {
  OB: {
    ru: 'Order Block — зона, где крупные игроки (банки, фонды) открывали позиции. Последняя медвежья свеча перед сильным ростом (бычий OB) или последняя бычья свеча перед резким падением (медвежий OB).',
    en: 'Order Block — zone where institutional traders placed large orders. The last bearish candle before a strong rally (bullish OB) or last bullish candle before a sharp decline (bearish OB).',
    kz: 'Order Block — ірі ойыншылар (банктер, қорлар) позиция ашқан аймақ. Күшті өсуден бұрынғы соңғы аюлы шырпы (бұқалық OB) немесе күрт құлаудан бұрынғы соңғы бұқалық шырпы (аюлық OB).',
  },
  FVG: {
    ru: 'Fair Value Gap (Разрыв справедливой стоимости) — ценовая неэффективность, где рынок двигался слишком быстро. Цена стремится "закрыть" этот разрыв.',
    en: 'Fair Value Gap — a price inefficiency where the market moved too quickly, leaving an imbalance. Price tends to revisit and "fill" these gaps.',
    kz: 'Fair Value Gap (Әділ құн алшақтығы) — нарық тым жылдам жылжыған баға тиімсіздігі. Баға бұл алшақтықты "жабуға" ұмтылады.',
  },
  BOS: {
    ru: 'Break of Structure — пробой ключевого уровня структуры (предыдущий High или Low). Подтверждает продолжение тренда.',
    en: 'Break of Structure — a break of a key structural level (previous High or Low), confirming trend continuation.',
    kz: 'Break of Structure — негізгі құрылымдық деңгейді бұзу (алдыңғы High немесе Low). Трендтің жалғасуын растайды.',
  },
  CHoCH: {
    ru: 'Change of Character — первый признак разворота тренда. Цена пробивает противоположный уровень структуры.',
    en: 'Change of Character — the first sign of a trend reversal. Price breaks the opposite structural level, signaling a potential shift.',
    kz: 'Change of Character — трендтің бұрылысының бірінші белгісі. Баға қарама-қарсы құрылымдық деңгейді бұзады.',
  },
  OTE: {
    ru: 'Optimal Trade Entry (62–79% по Фибоначчи) — зона входа с лучшим соотношением риска к прибыли внутри Order Block.',
    en: 'Optimal Trade Entry — the 62–79% Fibonacci retracement zone within an Order Block, offering the best risk-to-reward ratio.',
    kz: 'Optimal Trade Entry — Order Block ішіндегі 62–79% Fibonacci аймағы, тәуекел/пайда қатынасы ең жақсы.',
  },
  BB: {
    ru: 'Breaker Block — бывший Order Block, который был пробит. Переходит в поддержку/сопротивление. Приоритетнее обычных OB.',
    en: 'Breaker Block — a former Order Block that was broken through. It flips to act as support or resistance and has higher priority than regular OBs.',
    kz: 'Breaker Block — бұзылған бұрынғы Order Block. Қолдау/кедергіге айналады. Кәдімгі OB-дан жоғары басымдылық.',
  },
  HTF: {
    ru: 'Higher Time Frame (Старший таймфрейм) — анализ на более высоком таймфрейме (например, дневной) для определения общего направления.',
    en: 'Higher Time Frame — analysis on a larger timeframe (e.g., daily) to determine the overall market bias and direction.',
    kz: 'Higher Time Frame — жалпы бағытты анықтау үшін жоғарырақ уақыт шеңберіндегі (мысалы, күнделікті) талдау.',
  },
  SSL: {
    ru: 'Sell-Side Liquidity — ликвидность ниже рынка. Скопление стоп-лоссов покупателей. Цена может "свипать" этот уровень перед ростом.',
    en: 'Sell-Side Liquidity — liquidity sitting below the market. A cluster of buy-stop losses that price may sweep before moving up.',
    kz: 'Sell-Side Liquidity — нарықтан төмен орналасқан өтімділік. Баға өсуден бұрын бұл деңгейді "тазартуы" мүмкін.',
  },
  BSL: {
    ru: 'Buy-Side Liquidity — ликвидность выше рынка. Скопление стоп-лоссов продавцов. Цена может "свипать" перед падением.',
    en: 'Buy-Side Liquidity — liquidity sitting above the market. A cluster of sell-stop losses that price may sweep before moving down.',
    kz: 'Buy-Side Liquidity — нарықтан жоғары орналасқан өтімділік. Баға құлаудан бұрын бұл деңгейді "тазартуы" мүмкін.',
  },
}

interface Props {
  term: keyof typeof GLOSSARY
  children: React.ReactNode
  style?: React.CSSProperties
}

export default function SMCTooltip({ term, children, style }: Props) {
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const def = GLOSSARY[term]
  const text = def ? (def[lang as 'ru' | 'en' | 'kz'] ?? def.en) : ''

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <span
        onClick={() => setOpen(v => !v)}
        style={{
          cursor: 'pointer',
          borderBottom: '1px dashed rgba(255,255,255,0.35)',
          color: 'inherit',
          userSelect: 'none',
        }}
      >
        {children}
      </span>
      {open && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999,
          width: 240,
          padding: '8px 10px',
          background: '#141c2e',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          fontSize: '.6rem',
          color: 'rgba(255,255,255,0.78)',
          lineHeight: 1.55,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}>
          <span style={{ display: 'block', fontWeight: 700, color: '#a78bfa', marginBottom: 4, fontSize: '.62rem' }}>
            {term}
          </span>
          {text}
        </span>
      )}
    </span>
  )
}
