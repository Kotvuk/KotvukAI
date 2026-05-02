'use client'
import React, { useState, useCallback, useMemo } from 'react'
import { useLang } from '@/contexts/LangContext'
import { usePairs } from '@/hooks/usePairs'

interface AiPanelToolbarProps {
  pair: string
  tf: string
  analyzing: boolean
  quota: { remaining: number; limit: number; tier: string } | null
  onSelectPair: (p: string) => void
  onSelectTf: (v: string) => void
  onRunAI: () => void
}

const TFS = [
  { label: '1M', val: '1м' }, { label: '5M', val: '5м' }, { label: '15M', val: '15м' },
  { label: '30M', val: '30м' }, { label: '1H', val: '1ч' }, { label: '4H', val: '4ч' }, { label: '1D', val: '1д' },
]

export default function AiPanelToolbar({
  pair, tf, analyzing, quota, onSelectPair, onSelectTf, onRunAI
}: AiPanelToolbarProps) {
  const { t } = useLang()
  const { pairs: allPairs } = usePairs()
  const [pairOpen, setPairOpen] = useState(false)
  const [pairSearch, setPairSearch] = useState('')

  const filteredPairs = useMemo(
    () => pairSearch
      ? allPairs.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
      : allPairs,
    [pairSearch, allPairs]
  )

  return (
    <div className="ai-bar">
      <span className="cl">{t('pair')}</span>
      <div className="dw">
        <div className={`db ${pairOpen ? 'open' : ''}`} onClick={() => setPairOpen(v => !v)}>
          <span>{pair}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        {pairOpen && (
          <div className="dm">
            <input className="ds" placeholder="Поиск..." value={pairSearch} onChange={e => setPairSearch(e.target.value)} autoFocus />
            <div className="dl">
              {filteredPairs.map(pp => (
                <div key={pp} className={`di ${pp === pair ? 'sel' : ''}`} onClick={() => { onSelectPair(pp); setPairOpen(false); setPairSearch('') }}>{pp}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      <span className="cl">{t('timeframe')}</span>
      <div className="tf-row">
        {TFS.map(({ label, val }) => (
          <button key={val} className={`tf ${tf === val ? 'active' : ''}`} onClick={() => onSelectTf(val)}>{label}</button>
        ))}
      </div>
      <button className="run" onClick={onRunAI} disabled={analyzing || (quota !== null && quota.remaining <= 0)}>
        {analyzing ? t('analyzing') : t('analyze')}
      </button>
      {quota !== null && (
        <div style={{ fontSize: '.58rem', color: quota.remaining <= 0 ? 'var(--short)' : quota.remaining <= 2 ? '#ffa500' : 'var(--dim)', marginTop: 4, textAlign: 'center' }}>
          {quota.remaining <= 0
            ? `⛔ Лимит исчерпан — обновите тариф`
            : `осталось ${quota.remaining} / ${quota.limit} анализов`}
        </div>
      )}
    </div>
  )
}