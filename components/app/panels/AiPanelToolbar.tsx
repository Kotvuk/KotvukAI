'use client'
import React, { useState, useCallback, useMemo } from 'react'
import { useLang } from '@/contexts/LangContext'

interface AiPanelToolbarProps {
  pair: string
  tf: string
  analyzing: boolean
  quota: { remaining: number; limit: number; tier: string } | null
  onSelectPair: (p: string) => void
  onSelectTf: (v: string) => void
  onRunAI: () => void
}

const PAIRS = [
  'BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','ADA/USDT',
  'DOGE/USDT','AVAX/USDT','DOT/USDT','MATIC/USDT','LTC/USDT','BCH/USDT',
  'TRX/USDT','ETC/USDT','XLM/USDT','ATOM/USDT','ALGO/USDT','ICP/USDT',
  'LINK/USDT','UNI/USDT','AAVE/USDT','CRV/USDT','MKR/USDT','COMP/USDT',
  'SNX/USDT','1INCH/USDT','BAL/USDT','SUSHI/USDT','YFI/USDT','LDO/USDT',
  'RPL/USDT','PENDLE/USDT','VELO/USDT','CAKE/USDT','GMX/USDT','GNS/USDT',
  'DYDX/USDT','PERP/USDT','RBN/USDT','RDNT/USDT','GRT/USDT','BAND/USDT',
  'API3/USDT','DIA/USDT','TRB/USDT','INJ/USDT','PYTH/USDT','JUP/USDT',
  'NEAR/USDT','FTM/USDT','OP/USDT','ARB/USDT','SUI/USDT','APT/USDT',
  'SEI/USDT','TIA/USDT','MANTA/USDT','STRK/USDT','ZK/USDT','BERA/USDT',
  'MONAD/USDT','HYPE/USDT','MNT/USDT','METIS/USDT','KAVA/USDT','ROSE/USDT',
  'ONE/USDT','CELO/USDT','FLOW/USDT','EGLD/USDT','HBAR/USDT','IOTA/USDT',
  'VET/USDT','THETA/USDT','FTT/USDT','ZIL/USDT','ICX/USDT','QTUM/USDT',
  'NEO/USDT','WAVES/USDT','NANO/USDT','DCR/USDT','ZEC/USDT','DASH/USDT',
  'XMR/USDT','RVN/USDT','SC/USDT','DGB/USDT','LSK/USDT','ARK/USDT',
  'FET/USDT','AGIX/USDT','RNDR/USDT','WLD/USDT','TAO/USDT','OCEAN/USDT',
  'NMR/USDT','ALT/USDT','ARKM/USDT','VIDT/USDT','CTXC/USDT',
  'SAND/USDT','MANA/USDT','APE/USDT','AXS/USDT','GALA/USDT','ENJ/USDT',
  'IMX/USDT','GODS/USDT','YGG/USDT','MAGIC/USDT','BEAM/USDT','RON/USDT',
  'LOOKS/USDT','BLUR/USDT','NFT/USDT','SUPER/USDT','ALICE/USDT',
  'SHIB/USDT','PEPE/USDT','FLOKI/USDT','WIF/USDT','BONK/USDT','MEME/USDT',
  'BOME/USDT','POPCAT/USDT','MEW/USDT','NEIRO/USDT','PNUT/USDT','ACT/USDT',
  'TRUMP/USDT','MELANIA/USDT','FARTCOIN/USDT','COW/USDT','TURBO/USDT',
  'FIL/USDT','AR/USDT','STORJ/USDT','BLZ/USDT','CTSI/USDT','ANKR/USDT',
  'NKN/USDT','HNT/USDT','MOBILE/USDT','WIF/USDT','DIMO/USDT',
  'OKB/USDT','GT/USDT','KCS/USDT','CRO/USDT','WOO/USDT','LAZIO/USDT',
  'RUNE/USDT','STX/USDT','REN/USDT','CELR/USDT','SYN/USDT','MULTI/USDT',
  'AXL/USDT','W/USDT','WORMHOLE/USDT','JTO/USDT','TNSR/USDT',
  'STETH/USDT','RETH/USDT','CBETH/USDT','ETHFI/USDT','PUFFER/USDT',
  'SWELL/USDT','REZ/USDT','EIGEN/USDT','OMNI/USDT','SAGA/USDT',
  'ENA/USDT','ONDO/USDT','CFG/USDT','MPL/USDT','TRU/USDT','CPOOL/USDT',
  'SCRT/USDT','OXEN/USDT','DUSK/USDT','KEEP/USDT','NU/USDT',
  'ORDI/USDT','SATS/USDT','RATS/USDT','MUBI/USDT','PIZZA/USDT','BSSB/USDT',
  'NAKA/USDT','ALEX/USDT','TRIO/USDT','MERL/USDT','B2/USDT','BOME/USDT',
  'RAY/USDT','ORCA/USDT','MNGO/USDT','SRM/USDT','FIDA/USDT','STEP/USDT',
  'SAMO/USDT','SLND/USDT','PORT/USDT','COPE/USDT','MEDIA/USDT',
  'IO/USDT','ZRO/USDT','BLAST/USDT','LISTA/USDT','ZETA/USDT','REZ/USDT',
  'ETHFI/USDT','PORTAL/USDT','AEVO/USDT','MYRO/USDT','BOME/USDT','DYM/USDT',
  'JTO/USDT','MANTA/USDT','PIXEL/USDT','XION/USDT','BB/USDT','BANANA/USDT',
  'NOT/USDT','DOGS/USDT','HMSTR/USDT','CATI/USDT','MAJOR/USDT','TON/USDT',
  'UXLINK/USDT','EIGEN/USDT','PUFFER/USDT','NEIRO/USDT','MOODENG/USDT',
  // DePIN/Real World
  'LIT/USDT','GPS/USDT','HNT/USDT','MNEE/USDT','RPNC/USDT','DEAI/USDT',
  'AKT/USDT','BORA/USDT','DEPO/USDT','PLUME/USDT','TURT/USDT','GOAT/USDT',
  'PNUT/USDT','MOTHER/USDT','GECKO/USDT','BOME/USDT','FLZ/USDT','CATE/USDT',
  'CHOW/USDT','MAGA/USDT','WIF/USDT','PEIPEI/USDT','FUBT/USDT','SCAT/USDT',
]

const TFS = [
  { label: '1M', val: '1м' }, { label: '5M', val: '5м' }, { label: '15M', val: '15м' },
  { label: '30M', val: '30м' }, { label: '1H', val: '1ч' }, { label: '4H', val: '4ч' }, { label: '1D', val: '1д' },
]

export default function AiPanelToolbar({
  pair, tf, analyzing, quota, onSelectPair, onSelectTf, onRunAI
}: AiPanelToolbarProps) {
  const { t } = useLang()
  const [pairOpen, setPairOpen] = useState(false)
  const [pairSearch, setPairSearch] = useState('')

  const filteredPairs = useMemo(
    () => pairSearch
      ? PAIRS.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
      : PAIRS,
    [pairSearch]
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