'use client'
import React, { useState } from 'react'

interface GlossaryTerm {
  term: string
  full: string
  desc: string
}

const GLOSSARY: GlossaryTerm[] = [
  { term: 'OB', full: 'Order Block', desc: 'Зона накопления — последняя свеча перед импульсом. Бычий OB = низы, медвежий OB = верхи.' },
  { term: 'FVG', full: 'Fair Value Gap', desc: 'Разрыв справедливой стоимости. Гап между свечами (high < low prev или low > high prev).' },
  { term: 'Liq', full: 'Liquidity', desc: 'Ликвидность — зоны скопления стопов (SSL = Sell Side Liquidity, BSL = Buy Side Liquidity).' },
  { term: 'BOS', full: 'Break of Structure', desc: 'Прорыв структуры — пробой предыдущего свинг-хая/лоу.' },
  { term: 'CHoCH', full: 'Change of Character', desc: 'Смена характера — прорыв зоны консолидации + возврат.' },
  { term: 'Mitigation', full: 'Mitigation', desc: 'Подтверждение уровня — касание 2+ раз.' },
  { term: 'Sweep', full: 'Liquidity Sweep', desc: 'Сбор ликвидности — цена делает хай/лоу предыдущего свинга.' },
  { term: 'Premium', full: 'Premium Zone', desc: 'Зона премии — цена выше баланса (для SHORT).' },
  { term: 'Discount', full: 'Discount Zone', desc: 'Зона дисконта — цена ниже баланса (для LONG).' },
  { term: 'HTF', full: 'Higher Time Frame', desc: 'Старший таймфрейм — направление с большего ТФ.' },
  { term: 'OTE', full: 'Optimal Trade Entry', desc: 'Оптимальная точка входа — 50-70% отката от FVG.' },
  { term: 'RR', full: 'Risk:Reward', desc: 'Соотношение риск/прибыль. напр. 1:2 = $1 риск → $2 прибыль.' },
  { term: 'Confluence', full: 'Confluence', desc: 'Конфлюэнс — совпадение 3+ факторов (OB + FVG + Liq + etc).' },
  { term: 'FTR', full: 'Fair Trade Rectangle', desc: 'Зона входа по Фибо — 50-70% отката от импульса.' },
  { term: 'Supply/Demand', full: 'Supply/Demand Zone', desc: 'Зоны предложения (шорт) и спроса (лонг).' },
]

interface GlossaryModalProps {
  onClose: () => void
}

export default function GlossaryModal({ onClose }: GlossaryModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, width: '100%', maxWidth: 420, maxHeight: '85vh', overflow: 'auto', padding: '16px 18px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700 }}>📖 Глоссарий SMC</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GLOSSARY.map(item => (
            <div key={item.term} style={{ padding: '8px 10px', background: 'var(--bg3)', borderRadius: 5, borderLeft: `3px solid var(--cyan)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--cyan)', background: 'rgba(0,200,200,0.12)', padding: '2px 6px', borderRadius: 3 }}>{item.term}</span>
                <span style={{ fontSize: '.65rem', fontWeight: 600, color: 'var(--text)' }}>{item.full}</span>
              </div>
              <div style={{ fontSize: '.58rem', color: 'var(--muted)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 5, fontSize: '.55rem', color: 'var(--dim)', lineHeight: 1.5 }}>
          💡 <b>Конфлюэнс</b> — минимум 3 фактора для входа. Без свипа ликвидности — ждать.
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: 12, padding: '9px 0', borderRadius: 4, border: 'none', background: 'var(--cyan)', color: '#000', cursor: 'pointer', fontSize: '.68rem', fontWeight: 700 }}>
          Понятно
        </button>
      </div>
    </div>
  )
}