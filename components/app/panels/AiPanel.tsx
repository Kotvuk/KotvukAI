'use client'
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useLang } from '@/contexts/LangContext'
import { useAuth } from '@/contexts/AuthContext'
import { showToast } from '@/components/ui/Toast'
import KLineChart from '@/components/app/chart/KLineChartComponent'
import type { KLineChartHandle, CandleData, OBData, FVGData, LiqData, BreakerData } from '@/components/app/chart/KLineChartComponent'
import { DEFAULT_SMC_SETTINGS } from '@/components/app/chart/KLineChartComponent'
import type { SMCDrawSettings } from '@/components/app/chart/KLineChartComponent'
import type { ProbabilityResult } from '@/lib/smc'
import DrawingSettingsModal from '@/components/app/chart/DrawingSettingsModal'
import HistoricalSetupsModal from '@/components/app/panels/HistoricalSetupsModal'
import GlossaryModal from '@/components/app/panels/GlossaryModal'

const PAIRS = [
  // ─── Топ ───────────────────────────────────────────────────────────────────
  'BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','ADA/USDT',
  'DOGE/USDT','AVAX/USDT','DOT/USDT','MATIC/USDT','LTC/USDT','BCH/USDT',
  'TRX/USDT','ETC/USDT','XLM/USDT','ATOM/USDT','ALGO/USDT','ICP/USDT',
  // ─── DeFi ──────────────────────────────────────────────────────────────────
  'LINK/USDT','UNI/USDT','AAVE/USDT','CRV/USDT','MKR/USDT','COMP/USDT',
  'SNX/USDT','1INCH/USDT','BAL/USDT','SUSHI/USDT','YFI/USDT','LDO/USDT',
  'RPL/USDT','PENDLE/USDT','VELO/USDT','CAKE/USDT','GMX/USDT','GNS/USDT',
  'DYDX/USDT','PERP/USDT','RBN/USDT','RDNT/USDT','GRT/USDT','BAND/USDT',
  'API3/USDT','DIA/USDT','TRB/USDT','INJ/USDT','PYTH/USDT','JUP/USDT',
  // ─── Layer 1/2 ─────────────────────────────────────────────────────────────
  'NEAR/USDT','FTM/USDT','OP/USDT','ARB/USDT','SUI/USDT','APT/USDT',
  'SEI/USDT','TIA/USDT','MANTA/USDT','STRK/USDT','ZK/USDT','BERA/USDT',
  'MONAD/USDT','HYPE/USDT','MNT/USDT','METIS/USDT','KAVA/USDT','ROSE/USDT',
  'ONE/USDT','CELO/USDT','FLOW/USDT','EGLD/USDT','HBAR/USDT','IOTA/USDT',
  'VET/USDT','THETA/USDT','FTT/USDT','ZIL/USDT','ICX/USDT','QTUM/USDT',
  'NEO/USDT','WAVES/USDT','NANO/USDT','DCR/USDT','ZEC/USDT','DASH/USDT',
  'XMR/USDT','RVN/USDT','SC/USDT','DGB/USDT','LSK/USDT','ARK/USDT',
  // ─── AI/Data ───────────────────────────────────────────────────────────────
  'FET/USDT','AGIX/USDT','RNDR/USDT','WLD/USDT','TAO/USDT','OCEAN/USDT',
  'NMR/USDT','ALT/USDT','ARKM/USDT','VIDT/USDT','CTXC/USDT',
  // ─── Gaming/NFT ────────────────────────────────────────────────────────────
  'SAND/USDT','MANA/USDT','APE/USDT','AXS/USDT','GALA/USDT','ENJ/USDT',
  'IMX/USDT','GODS/USDT','YGG/USDT','MAGIC/USDT','BEAM/USDT','RON/USDT',
  'LOOKS/USDT','BLUR/USDT','NFT/USDT','SUPER/USDT','ALICE/USDT',
  // ─── Meme ──────────────────────────────────────────────────────────────────
  'SHIB/USDT','PEPE/USDT','FLOKI/USDT','WIF/USDT','BONK/USDT','MEME/USDT',
  'BOME/USDT','POPCAT/USDT','MEW/USDT','NEIRO/USDT','PNUT/USDT','ACT/USDT',
  'TRUMP/USDT','MELANIA/USDT','FARTCOIN/USDT','COW/USDT','TURBO/USDT',
  // ─── Storage/Infra ─────────────────────────────────────────────────────────
  'FIL/USDT','AR/USDT','STORJ/USDT','BLZ/USDT','CTSI/USDT','ANKR/USDT',
  'NKN/USDT','HNT/USDT','MOBILE/USDT','WIF/USDT','DIMO/USDT',
  // ─── Exchange tokens ───────────────────────────────────────────────────────
  'OKB/USDT','GT/USDT','KCS/USDT','CRO/USDT','WOO/USDT','LAZIO/USDT',
  // ─── Cross-chain/Bridge ────────────────────────────────────────────────────
  'RUNE/USDT','STX/USDT','REN/USDT','CELR/USDT','SYN/USDT','MULTI/USDT',
  'AXL/USDT','W/USDT','WORMHOLE/USDT','JTO/USDT','TNSR/USDT',
  // ─── Liquid Staking ────────────────────────────────────────────────────────
  'STETH/USDT','RETH/USDT','CBETH/USDT','ETHFI/USDT','PUFFER/USDT',
  'SWELL/USDT','REZ/USDT','EIGEN/USDT','OMNI/USDT','SAGA/USDT',
  // ─── RWA/TradFi ────────────────────────────────────────────────────────────
  'ENA/USDT','ONDO/USDT','CFG/USDT','MPL/USDT','TRU/USDT','CPOOL/USDT',
  // ─── Privacy ───────────────────────────────────────────────────────────────
  'SCRT/USDT','OXEN/USDT','DUSK/USDT','KEEP/USDT','NU/USDT',
  // ─── BTC ecosystem ─────────────────────────────────────────────────────────
  'ORDI/USDT','SATS/USDT','RATS/USDT','MUBI/USDT','PIZZA/USDT','BSSB/USDT',
  'NAKA/USDT','ALEX/USDT','TRIO/USDT','MERL/USDT','B2/USDT','BOME/USDT',
  // ─── Solana ecosystem ──────────────────────────────────────────────────────
  'RAY/USDT','ORCA/USDT','MNGO/USDT','SRM/USDT','FIDA/USDT','STEP/USDT',
  'SAMO/USDT','SLND/USDT','PORT/USDT','COPE/USDT','MEDIA/USDT',
  // ─── Новые / trending ──────────────────────────────────────────────────────
  'IO/USDT','ZRO/USDT','BLAST/USDT','LISTA/USDT','ZETA/USDT','REZ/USDT',
  'ETHFI/USDT','PORTAL/USDT','AEVO/USDT','MYRO/USDT','BOME/USDT','DYM/USDT',
  'JTO/USDT','MANTA/USDT','PIXEL/USDT','XION/USDT','BB/USDT','BANANA/USDT',
  'NOT/USDT','DOGS/USDT','HMSTR/USDT','CATI/USDT','MAJOR/USDT','TON/USDT',
  'UXLINK/USDT','EIGEN/USDT','PUFFER/USDT','NEIRO/USDT','MOODENG/USDT',
  // ─── DePIN/Real World ─────────────────────────────────────────────────────
  'LIT/USDT','GPS/USDT','HNT/USDT','MNEE/USDT','RPNC/USDT','DEAI/USDT',
  'AKT/USDT','BORA/USDT','DEPO/USDT','PLUME/USDT','TURT/USDT','GOAT/USDT',
  'PNUT/USDT','MOTHER/USDT','GECKO/USDT','BOME/USDT','FLZ/USDT','CATE/USDT',
  'CHOW/USDT','MAGA/USDT','WIF/USDT','PEIPEI/USDT','FUBT/USDT','SCAT/USDT',
  'SILLY/USDT','DEGEN/USDT','MUMU/USDT','BABYDOGE/USDT','Yapper/USDT','GRPE/USDT',
  'ALCH/USDT','AERO/USDT','SPX/USDT','MIRRO/USDT','ZKNDX/USDT','MOOD/USDT',
  'BLAST/USDT','UXD/USDT','PUFF/USDT','CRT/USDT','SREC/USDT','SOR/USDT',
]

const DRAW_TOOLS = [
  { key: 'segment',                label: 'Линия тренда' },
  { key: 'rayLine',                label: 'Луч' },
  { key: 'horizontalStraightLine', label: 'Горизонт. линия' },
  { key: 'verticalStraightLine',   label: 'Вертик. линия' },
  { key: 'priceLine',              label: 'Ценовой уровень' },
  { key: 'parallelStraightLine',   label: 'Парал. канал' },
  { key: 'priceChannelLine',       label: 'Ценовой канал' },
  { key: 'priceRect',              label: 'Прямоугольник' },
  { key: 'circle',                 label: 'Окружность' },
  { key: 'polygon',                label: 'Многоугольник' },
  { key: 'polyline',               label: 'Траектория' },
  { key: 'fibRetracement',         label: 'Фибоначчи' },
]
const TFS = [
  { label: '1M', val: '1м' }, { label: '5M', val: '5м' }, { label: '15M', val: '15м' },
  { label: '30M', val: '30м' }, { label: '1H', val: '1ч' }, { label: '4H', val: '4ч' }, { label: '1D', val: '1д' },
]

function vc(v: string | null) {
  if (!v) return 'wait'
  const u = v.toUpperCase()
  return u === 'LONG' ? 'long' : u === 'SHORT' ? 'short' : 'wait'
}

interface AiPanelProps {
  active: boolean
  onGetContext?: (fn: () => Record<string, unknown>) => void
  onNavigate?: (panel: 'dash' | 'ai' | 'trades' | 'news' | 'notifs' | 'history' | 'settings') => void
}

export default function AiPanel({ active, onGetContext, onNavigate }: AiPanelProps) {
  const { t } = useLang()
  const { getValidToken } = useAuth()
  const chartRef = useRef<KLineChartHandle>(null)
  const [pair, setPair] = useState('BTC/USDT')
  const [tf, setTf] = useState('1ч')
  const pairRef = useRef('BTC/USDT')
  const tfRef = useRef('1ч')
  const [pairSearch, setPairSearch] = useState('')
  const [pairOpen, setPairOpen] = useState(false)
  const [chartTitle, setChartTitle] = useState('BTC/USDT · 1H')
  const [marketData, setMarketData] = useState<CandleData | null>(null)
  const [sidebarInds, setSidebarInds] = useState<{ name: string; value: string; color: string; label: string }[]>([])
  const [sidebarSR, setSidebarSR] = useState<{ type: 'R' | 'S'; value: number }[]>([])
  const [aiOut, setAiOut] = useState<'empty' | 'loading' | 'result'>('empty')
  const [aiData, setAiData] = useState<Record<string, unknown> | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [quota, setQuota] = useState<{ remaining: number; limit: number; tier: string } | null>(null)
  const [chartLoading, setChartLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState('...')
  const [showSMC, setShowSMC] = useState(false)
  const [smcLoading, setSmcLoading] = useState(false)
  const [showTL, setShowTL] = useState(false)
  const [smcSettings, setSmcSettings] = useState<SMCDrawSettings>(DEFAULT_SMC_SETTINGS)
  const smcSettingsRef = useRef<HTMLDivElement>(null)
  const [smcSettingsOpen, setSmcSettingsOpen] = useState(false)
  const smcDataRef = useRef<{ orderBlocks: OBData[]; breakerBlocks?: BreakerData[]; fvgs: FVGData[]; liquidityLevels: LiqData[] } | null>(null)
  const [smcProb, setSmcProb] = useState<ProbabilityResult | null>(null)
  const [showHistorical, setShowHistorical] = useState(false)
  const [drawingSettings, setDrawingSettings] = useState<{
    id: string; name: string; extendData?: unknown; styles?: unknown
  } | null>(null)
  const [candleCloseTs, setCandleCloseTs] = useState(0)
  const [candleCountdown, setCandleCountdown] = useState('')
  const [priceY, setPriceY] = useState<number | null>(null)
  const [priceDir, setPriceDir] = useState<'up' | 'down'>('up')
  const prevPriceRef = useRef(0)
  const marketDataRef = useRef<CandleData | null>(null)
  marketDataRef.current = marketData
  const [drawTool, setDrawTool] = useState('segment')
  const [drawMenuOpen, setDrawMenuOpen] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const drawMenuRef = useRef<HTMLDivElement>(null)
  const [alerts, setAlerts] = useState<Array<{ id: number; pair: string; zone_type: string; price_high: number; price_low: number; label: string | null }>>([])
  const [showAlerts, setShowAlerts] = useState(false)
  const [backtestOpen, setBacktestOpen] = useState(false)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestData, setBacktestData] = useState<Record<string, unknown> | null>(null)
  const [showGlossary, setShowGlossary] = useState(false)

  const filteredPairs = React.useMemo(
    () => pairSearch
      ? PAIRS.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
      : PAIRS,
    [pairSearch]
  )

  useEffect(() => {
    if (!candleCloseTs) return
    const tick = () => {
      const rem = candleCloseTs - Date.now()
      if (rem <= 0) { setCandleCountdown('00:00'); return }
      const m = Math.floor(rem / 60000)
      const s = Math.floor((rem % 60000) / 1000)
      setCandleCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [candleCloseTs])

  useEffect(() => {
    if (!marketData) return
    const y = chartRef.current?.getYForPrice(marketData.close)
    if (y != null) setPriceY(y)
    if (prevPriceRef.current !== 0) {
      setPriceDir(marketData.close >= prevPriceRef.current ? 'up' : 'down')
    }
    prevPriceRef.current = marketData.close
  }, [marketData])

  useEffect(() => {
    if (!drawMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (drawMenuRef.current && !drawMenuRef.current.contains(e.target as Node)) {
        setDrawMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [drawMenuOpen])

  useEffect(() => {
    function onOverlayDblClick(e: Event) {
      const d = (e as CustomEvent).detail
      if (d?.id) setDrawingSettings(d)
    }
    function onOverlayRightClick(e: Event) {
      const d = (e as CustomEvent).detail
      if (d?.id) {
        if (window.confirm('Удалить этот объект с графика?')) {
          chartRef.current?.removeOverlayById(d.id)
        }
      }
    }
    function onOverlayDrawEnd() {
      setIsDrawing(false)
    }
    window.addEventListener('kotvuk:overlay:dblclick', onOverlayDblClick)
    window.addEventListener('kotvuk:overlay:rightclick', onOverlayRightClick)
    window.addEventListener('kotvuk:overlay:drawend', onOverlayDrawEnd)
    return () => {
      window.removeEventListener('kotvuk:overlay:dblclick', onOverlayDblClick)
      window.removeEventListener('kotvuk:overlay:rightclick', onOverlayRightClick)
      window.removeEventListener('kotvuk:overlay:drawend', onOverlayDrawEnd)
    }
  }, [])

  useEffect(() => {
    function onUpdateMarkup(e: Event) {
      const d = (e as CustomEvent).detail
      chartRef.current?.updateMarkup(d.tp, d.sl, d.entry)
      showToast('Уровни обновлены', 'ok')
    }
    function onDrawZone(e: Event) {
      const d = (e as CustomEvent).detail
      const zoneType: string = d.zoneType || ''
      const isOB   = zoneType.startsWith('ob_')
      const isFVG  = zoneType.startsWith('fvg_')
      const isAll  = zoneType.endsWith('_all')
      const isBull = zoneType.includes('bullish')

      if ((isOB || isFVG) && isAll && smcDataRef.current) {
        const smc   = smcDataRef.current
        let drawn   = 0
        if (isOB) {
          smc.orderBlocks.filter(o => !o.isMitigated).forEach((z, i) => {
            const col = z.type === 'bullish' ? '#00e676' : '#ff3d57'
            chartRef.current?.drawZone(z.high, z.low, col, `${z.type === 'bullish' ? 'Bull' : 'Bear'} OB ${i + 1}`, 'chat_ob')
            drawn++
          })
        } else {
          smc.fvgs.forEach((z, i) => {
            const col = z.type === 'bullish' ? '#00c8ff' : '#f0a500'
            chartRef.current?.drawZone(z.high, z.low, col, `${z.type === 'bullish' ? 'Bull' : 'Bear'} FVG ${i + 1}`, 'chat_ob')
            drawn++
          })
        }
        if (!drawn) { showToast('Нет активных зон. Сначала нажмите SMC.', 'err'); return }
        showToast(`Нарисовано ${drawn} ${isOB ? 'OB' : 'FVG'} зон`, 'ok')
        return
      }

      if ((isOB || isFVG) && (!d.priceFrom || !d.priceTo) && smcDataRef.current) {
        const smc = smcDataRef.current
        const items = isOB
          ? smc.orderBlocks.filter(o => (isBull ? o.type === 'bullish' : o.type === 'bearish') && !o.isMitigated)
          : smc.fvgs.filter(f => (isBull ? f.type === 'bullish' : f.type === 'bearish'))
        if (!items.length) { showToast('Нет активных зон. Сначала нажмите SMC.', 'err'); return }
        const color = isBull ? '#00e676' : (isFVG ? '#00c8ff' : '#ff3d57')
        items.forEach((z, i) => {
          chartRef.current?.drawZone(z.high, z.low, color, `${isBull ? 'Bull' : 'Bear'} ${isOB ? 'OB' : 'FVG'} ${i + 1}`, 'chat_ob')
        })
        showToast(`Нарисовано ${items.length} ${isOB ? 'OB' : 'FVG'} зон`, 'ok')
        return
      }

      if (!d.priceFrom || !d.priceTo) { showToast('Сначала нажмите SMC для получения данных', 'err'); return }
      const color = d.color || (isBull ? '#00e676' : isFVG ? '#00c8ff' : '#f0a500')
      chartRef.current?.drawZone(d.priceFrom, d.priceTo, color, d.label || zoneType || 'Zone', zoneType || 'chat_zone')
      showToast(`Зона нарисована: ${d.label || zoneType}`, 'ok')
    }
    function onDrawLiquidity(e: Event) {
      const d = (e as CustomEvent).detail
      chartRef.current?.drawZone(d.level * 1.001, d.level * 0.999, d.side === 'sell' ? '#ff3d57' : '#00e676', d.side === 'sell' ? 'SSL' : 'BSL', 'chat_liq')
      showToast('Ликвидность нарисована', 'ok')
    }
    function onClearZones(e: Event) {
      const d = (e as CustomEvent).detail
      if (d.target === 'all' || d.target === 'markup') chartRef.current?.clearDrawings()
      if (d.target === 'all' || d.target === 'ob' || d.target === 'fvg' || d.target === 'liquidity') chartRef.current?.clearSMC()
      showToast('Очищено', 'ok')
    }
    function onSetOpacity(e: Event) {
      const d = (e as CustomEvent).detail
      const group = d.group === 'ob' ? 'smc_ob' : d.group === 'fvg' ? 'smc_fvg' : d.group === 'liquidity' ? 'smc_liq' : 'ai'
      chartRef.current?.setZoneOpacity(group, d.opacityValue || 0.2)
      showToast('Прозрачность изменена', 'ok')
    }
    window.addEventListener('kotvuk:update_markup', onUpdateMarkup)
    window.addEventListener('kotvuk:draw_zone', onDrawZone)
    window.addEventListener('kotvuk:draw_liquidity', onDrawLiquidity)
    window.addEventListener('kotvuk:clear_zones', onClearZones)
    window.addEventListener('kotvuk:set_opacity', onSetOpacity)
    return () => {
      window.removeEventListener('kotvuk:update_markup', onUpdateMarkup)
      window.removeEventListener('kotvuk:draw_zone', onDrawZone)
      window.removeEventListener('kotvuk:draw_liquidity', onDrawLiquidity)
      window.removeEventListener('kotvuk:clear_zones', onClearZones)
      window.removeEventListener('kotvuk:set_opacity', onSetOpacity)
    }
  }, [])

  // Загрузить квоту при монтировании
  useEffect(() => {
    fetch('/api/subscription').then(r => r.json()).then(d => {
      if (d.ok) setQuota({ remaining: d.remaining, limit: d.limit, tier: d.subscription?.tier || 'free' })
    }).catch(() => {})
  }, [])

  // При возврате на панель — триггер resize чтобы klinecharts пересчитал размеры canvas
  useEffect(() => {
    if (active) {
      // Небольшая задержка: дать браузеру применить display изменение
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
      return () => clearTimeout(t)
    }
  }, [active])

  useEffect(() => {
    getValidToken().then(token => {
      if (!token) return
      fetch('/api/alerts', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.ok) setAlerts(d.alerts) })
        .catch(() => {})
    }).catch(() => {})
  }, [getValidToken])

  useEffect(() => {
    onGetContext?.(() => {
      const a = aiData?.analysis as Record<string, unknown> | undefined
      const m = aiData?.market as Record<string, unknown> | undefined

      const smcCtx = smcDataRef.current ?? (m?.smc as typeof smcDataRef.current) ?? null
      return {
        pair: pairRef.current,
        tf: tfRef.current,
        price: (m?.price as number) || marketDataRef.current?.close || 0,
        tp: (a?.tp_price as number) || 0,
        sl: (a?.sl_price as number) || 0,
        entry: (a?.entry_price as number) || 0,
        verdict: (a?.verdict as string) || '',
        smc: smcCtx,
      }
    })
  }, [aiData, onGetContext])

  useEffect(() => {
    const THRESHOLD = 0.005
    const check = () => {
      const smc = smcDataRef.current
      const price = marketDataRef.current?.close
      if (!smc || !price) return

      for (const ob of smc.orderBlocks) {
        if (ob.isMitigated) continue
        const mid = (ob.high + ob.low) / 2
        const dist = Math.abs(price - mid) / price
        if (dist < THRESHOLD) {
          showToast(`Цена у ${ob.type === 'bullish' ? 'бычьего' : 'медвежьего'} OB $${ob.low.toFixed(0)}-$${ob.high.toFixed(0)}`, 'ok')
          return
        }
      }

      for (const liq of smc.liquidityLevels) {
        if (liq.isSwept) continue
        const dist = Math.abs(price - liq.price) / price
        if (dist < THRESHOLD) {
          showToast(`Цена у ${liq.type === 'buy' ? 'BSL' : 'SSL'} $${liq.price.toFixed(0)}`, 'ok')
          return
        }
      }
    }
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleChartReady = useCallback(() => {
    setChartLoading(false)
    chartRef.current?.loadChart(pairRef.current, tfRef.current)
  }, [])

  // ─── Save/Load drawings ────────────────────────────────────────────────────
  const saveDrawings = useCallback(async (p: string, t: string) => {
    const token = await getValidToken().catch(() => null)
    if (!token) return
    const drawings = chartRef.current?.getUserDrawings() ?? []
    if (!drawings.length) return
    try {
      await fetch('/api/drawings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pair: p, timeframe: t, drawings }),
      })
    } catch { /* silent */ }
  }, [getValidToken])

  const loadDrawings = useCallback(async (p: string, t: string) => {
    const token = await getValidToken().catch(() => null)
    if (!token) return
    try {
      const res = await fetch(`/api/drawings?pair=${encodeURIComponent(p)}&timeframe=${encodeURIComponent(t)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.ok && data.drawings?.length) {
        setTimeout(() => chartRef.current?.restoreUserDrawings(data.drawings), 800)
      }
    } catch { /* silent */ }
  }, [getValidToken])

  useEffect(() => {
    if (!smcSettingsOpen) return
    function handle(e: MouseEvent) {
      if (smcSettingsRef.current && !smcSettingsRef.current.contains(e.target as Node)) {
        setSmcSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [smcSettingsOpen])

  const selectPair = useCallback((p: string) => {
    saveDrawings(pairRef.current, tfRef.current)
    setPair(p); pairRef.current = p
    setPairOpen(false); setPairSearch('')
    setChartTitle(p + ' · ' + tfRef.current.toUpperCase())
    smcDataRef.current = null
    if (showSMC) { chartRef.current?.clearSMC(); setShowSMC(false) }
    if (showTL) { chartRef.current?.clearTrendlines(); setShowTL(false) }
    chartRef.current?.loadChart(p, tfRef.current)
    loadDrawings(p, tfRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSMC, showTL, saveDrawings, loadDrawings])

  const selectTf = useCallback((v: string) => {
    saveDrawings(pairRef.current, tfRef.current)
    setTf(v); tfRef.current = v
    setChartTitle(pairRef.current + ' · ' + v.toUpperCase())
    smcDataRef.current = null
    if (showSMC) { chartRef.current?.clearSMC(); setShowSMC(false) }
    if (showTL) { chartRef.current?.clearTrendlines(); setShowTL(false) }
    chartRef.current?.loadChart(pairRef.current, v)
    loadDrawings(pairRef.current, v)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSMC, showTL, saveDrawings, loadDrawings])

  async function runSMC() {
    const next = !showSMC
    if (next) {
      if (smcDataRef.current) {
        chartRef.current?.drawSMC(smcDataRef.current as Parameters<KLineChartHandle['drawSMC']>[0], smcSettings)
        setShowSMC(true)
      } else {
        setSmcLoading(true)
        try {
          await getValidToken()
          const candles = chartRef.current?.getCandles() ?? []
          const r = await fetch('/api/smc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pair: pairRef.current, timeframe: tfRef.current, candles }),
          })
          const d = await r.json()
          if (d.ok) {
            smcDataRef.current = d.smc as { orderBlocks: OBData[]; breakerBlocks?: BreakerData[]; fvgs: FVGData[]; liquidityLevels: LiqData[] }
            chartRef.current?.drawSMC(d.smc as Parameters<KLineChartHandle['drawSMC']>[0], smcSettings)
            setShowSMC(true)
          } else {
            showToast(d.error || 'Ошибка SMC', 'err')
          }
        } catch (e) {
          console.error('SMC error:', e)
          showToast('Ошибка загрузки SMC', 'err')
        }
        setSmcLoading(false)
      }
    } else {
      chartRef.current?.clearSMC()
      smcDataRef.current = null
      setShowSMC(false)
    }
  }

  async function createAlert(zone_type: string, price_high: number, price_low: number, label: string) {
    const token = await getValidToken().catch(() => null)
    if (!token) return
    try {
      const r = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pair: pairRef.current, zone_type, price_high, price_low, label }),
      })
      const d = await r.json()
      if (d.ok) {
        setAlerts(prev => [...prev, d.alert])
        showToast(`🔔 Алерт создан: ${label}`, 'ok')
      }
    } catch { showToast('Ошибка создания алерта', 'err') }
  }

  async function deleteAlert(id: number) {
    const token = await getValidToken().catch(() => null)
    if (!token) return
    try {
      await fetch(`/api/alerts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setAlerts(prev => prev.filter(a => a.id !== id))
      showToast('Алерт удалён', 'ok')
    } catch { /* ignore */ }
  }

  async function runBacktest() {
    setBacktestLoading(true)
    setBacktestData(null)
    setBacktestOpen(true)
    const token = await getValidToken().catch(() => null)
    if (!token) { setBacktestLoading(false); return }
    try {
      const r = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pair: pairRef.current, timeframe: tfRef.current }),
      })
      const d = await r.json()
      if (d.ok) setBacktestData(d)
      else showToast(d.error || 'Ошибка бэктеста', 'err')
    } catch { showToast('Ошибка бэктеста', 'err') }
    setBacktestLoading(false)
  }

  async function runAI() {
    // Обновляем токен — если упадёт, показываем ошибку вместо тихого краша
    try {
      await getValidToken()
    } catch {
      showToast('Ошибка авторизации. Попробуйте перезайти.', 'err')
      return
    }

    setAnalyzing(true)
    setAiOut('loading')
    const steps = [t('fetching_data'), t('technical_analysis'), t('risk_assessment'), t('final_verdict')]
    let si = 0
    setLoadingStep(steps[0])
    const iv = setInterval(() => { si = (si + 1) % steps.length; setLoadingStep(steps[si]) }, 2200)
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: pairRef.current, timeframe: tfRef.current }),
      })
      const data = await r.json()
      clearInterval(iv)
      if (data.ok) {
        setAiData(data)
        setAiOut('result')
        const a = data.analysis
        const m = data.market

        if (a.verdict === 'WAIT') {
          chartRef.current?.clearDrawings()
        } else {
          chartRef.current?.drawMarkup({ ...a, supports: m.supports, resistances: m.resistances })
        }

        // Подсветить выбранный OB
        if (a.ob_used) {
          chartRef.current?.removeOverlayById('selected_ob')
          const ob = a.ob_used as Record<string, unknown>
          chartRef.current?.highlightOB(
            Number(ob.high),
            Number(ob.low),
            String(ob.quality)?.toLowerCase().includes('bull') ? 'bullish' : 'bearish',
            `Selected: ${ob.quality} OB`
          )
        }

        if (m.smc) {
          smcDataRef.current = m.smc as { orderBlocks: OBData[]; breakerBlocks?: BreakerData[]; fvgs: FVGData[]; liquidityLevels: LiqData[] }
          if (showSMC) {
            chartRef.current?.clearSMC()
            chartRef.current?.drawSMC(m.smc as Parameters<KLineChartHandle['drawSMC']>[0], smcSettings)
          }
        }
        if (data.smc_probability) setSmcProb(data.smc_probability as ProbabilityResult)
        if (data.quota) setQuota(data.quota as { remaining: number; limit: number; tier: string })
        setSidebarInds(buildSidebarInds(m))
        setSidebarSR(buildSidebarSR(m))
      } else {
        // Показываем конкретную ошибку (лимит, таймаут, etc.)
        const errMsg = data.error || t('error')
        showToast(errMsg, 'err')
        if (data.quota) setQuota(data.quota as { remaining: number; limit: number; tier: string })
        setAiOut('empty')
      }
    } catch (e) {
      clearInterval(iv)
      const msg = e instanceof Error ? e.message : ''
      showToast(msg || t('server_unavailable'), 'err')
      setAiOut('empty')
    }
    setAnalyzing(false)
  }

  function buildSidebarInds(m: Record<string, unknown>) {
    const rsi = Number(m.rsi)
    return [
      { name: 'Объём',   value: String(m.volSignal || ''),                    color: 'neut', label: '' },
      { name: 'Funding', value: `${Number(m.fundingRate ?? 0).toFixed(4)}%`, color: Number(m.fundingRate ?? 0) > 0.05 ? 'bear' : Number(m.fundingRate ?? 0) < -0.01 ? 'bull' : 'neut', label: Number(m.fundingRate ?? 0) > 0.05 ? 'HOT' : '' },
      { name: 'HTF Bias',value: String((m as Record<string,unknown>).htfBias || m.smc && (m.smc as Record<string,unknown>).htfBias || '—'), color: String((m as Record<string,unknown>).htfBias || (m.smc as Record<string,unknown>)?.htfBias) === 'bullish' ? 'bull' : 'bear', label: '' },
      { name: 'RSI(14)', value: String(rsi),                                   color: rsi > 70 ? 'bear' : rsi < 30 ? 'bull' : 'neut', label: rsi > 70 ? 'OB' : rsi < 30 ? 'OS' : '' },
    ]
  }

  function buildSidebarSR(m: Record<string, unknown>) {
    const res: { type: 'R' | 'S'; value: number }[] = [
      ...((m.resistances as number[]) || []).map(r => ({ type: 'R' as const, value: parseFloat(String(r)) })),
      ...((m.supports   as number[]) || []).map(s => ({ type: 'S' as const, value: parseFloat(String(s)) })),
    ]
    return res
  }

  const a = aiData?.analysis as Record<string, unknown> | undefined
  const m = aiData?.market as Record<string, unknown> | undefined
  const p = aiData?.pipeline as Record<string, unknown> | undefined
  const elap = aiData?.elapsed as number | undefined

  const V = a ? vc(String(a.verdict)) : 'wait'
  const rc = a ? (Number(a.risk_score) >= 7 ? 'var(--short)' : Number(a.risk_score) >= 4 ? 'var(--wait)' : 'var(--long)') : 'var(--text)'

  // НЕ возвращаем null — компонент персистентен, скрывается через CSS в dashboard
  // if (!active) return null  ← убрано намеренно

  return (
    <>
    <div className="panel active" id="panel-ai" style={{ display: active ? undefined : 'none' }}>
      {}
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
                  <div key={pp} className={`di ${pp === pair ? 'sel' : ''}`} onClick={() => selectPair(pp)}>{pp}</div>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="cl">{t('timeframe')}</span>
        <div className="tf-row">
          {TFS.map(({ label, val }) => (
            <button key={val} className={`tf ${tf === val ? 'active' : ''}`} onClick={() => selectTf(val)}>{label}</button>
          ))}
        </div>
        <button className="run" onClick={runAI} disabled={analyzing || (quota !== null && quota.remaining <= 0)}>
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

      {}
      <div className="ai-layout">
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div className="chart-wrap" style={{ flex: 1, minWidth: 0 }}>
            <div className="chart-toolbar">
              <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{chartTitle}</span>
              {marketData && (
                <span style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--text)' }}>
                  ${marketData.close.toLocaleString()}
                </span>
              )}
              <div className="chart-toolbar-r">
                <span className="cl">{t('draw')}</span>
                {}
                <div ref={drawMenuRef} style={{ position: 'relative' }}>
                  <button
                    className={`vl-btn draw-tool-btn ${isDrawing ? 'active' : ''}`}
                    onClick={() => setDrawMenuOpen(v => !v)}
                    title="Выбрать инструмент"
                    style={{ padding: '3px 7px', fontSize: '.6rem', display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M13 2L14 5 5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                    <span style={{ flex: 1, textAlign: 'left' }}>{DRAW_TOOLS.find(t => t.key === drawTool)?.label}</span>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1 2.5l3 3 3-3"/></svg>
                  </button>
                  {drawMenuOpen && (
                    <div
                      style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 2000,
                        background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 4,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 140, overflow: 'hidden',
                      }}
                      onMouseLeave={() => setDrawMenuOpen(false)}
                    >
                      {DRAW_TOOLS.map(tool => (
                        <div
                          key={tool.key}
                          onClick={() => {
                            setDrawTool(tool.key)
                            setDrawMenuOpen(false)
                            chartRef.current?.setDrawing(tool.key)
                            setIsDrawing(true)
                          }}
                          style={{
                            padding: '6px 12px', fontSize: '.63rem', cursor: 'pointer',
                            background: drawTool === tool.key ? 'var(--bg3)' : 'transparent',
                            color: drawTool === tool.key ? 'var(--cyan)' : 'var(--text)',
                            borderLeft: drawTool === tool.key ? '2px solid var(--cyan)' : '2px solid transparent',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = drawTool === tool.key ? 'var(--bg3)' : 'transparent' }}
                        >
                          {tool.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {}
                <button
                  className={`vl-btn ${isDrawing ? 'active' : ''}`}
                  onClick={() => {
                    chartRef.current?.setDrawing(drawTool)
                    setIsDrawing(true)
                  }}
                  title={`Нарисовать: ${DRAW_TOOLS.find(t => t.key === drawTool)?.label}`}
                  style={{ padding: '4px 7px', color: isDrawing ? 'var(--cyan)' : undefined }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M13 2L14 5 5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <line x1="10" y1="4" x2="12" y2="6" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                </button>
                {}
                <button className="vl-btn" onClick={() => { chartRef.current?.clearDrawings(); setIsDrawing(false) }} title="Очистить рисунки" style={{ padding: '4px 7px', color: 'var(--short)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <line x1="2" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M5.5 4.5V3.5C5.5 3.22 5.72 3 6 3h4c.28 0 .5.22.5.5V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.5 4.5l.7 8.5h5.6l.7-8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/>
                  </svg>
                </button>
                <span style={{ width: 1, height: 14, background: 'var(--line2)', margin: '0 4px' }} />
                {}
                <div style={{ position: 'relative', display: 'flex', gap: 1 }} ref={smcSettingsRef}>
                  <button
                    className={`vl-btn ${showSMC ? 'active' : ''}`}
                    style={{ color: showSMC ? 'var(--cyan)' : 'var(--muted)', fontSize: '.55rem', padding: '2px 6px' }}
                    title="Smart Money Concepts"
                    onClick={runSMC}
                    disabled={smcLoading}
                  >
                    {smcLoading ? '···' : 'SMC'}
                  </button>
                  <button
                    className="vl-btn"
                    style={{ padding: '2px 4px', color: smcSettingsOpen ? 'var(--cyan)' : 'var(--muted)' }}
                    title="Настройки SMC"
                    onClick={() => setSmcSettingsOpen(v => !v)}
                  >
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
                    </svg>
                  </button>
                  {smcSettingsOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 5px)', right: 0, zIndex: 3000,
                      background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 5,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.5)', width: 188, padding: '6px 0',
                    }}>
                      <div style={{ fontSize: '.52rem', color: 'var(--muted)', padding: '2px 11px 5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                        SMC Настройки
                      </div>
                      {([
                        { key: 'ob',       label: 'Order Blocks' },
                        { key: 'fvg',      label: 'Fair Value Gaps' },
                        { key: 'liq',      label: 'Liquidity' },
                        { key: 'premDisc', label: 'Premium / Discount' },
                      ] as { key: keyof SMCDrawSettings; label: string }[]).map(({ key, label }) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 11px', cursor: 'pointer', fontSize: '.62rem', color: 'var(--text)' }}>
                          <input
                            type="checkbox"
                            checked={smcSettings[key] as boolean}
                            style={{ accentColor: 'var(--cyan)', margin: 0 }}
                            onChange={(e) => {
                              const next = { ...smcSettings, [key]: e.target.checked }
                              setSmcSettings(next)
                              if (showSMC && smcDataRef.current) {
                                chartRef.current?.clearSMC()
                                chartRef.current?.drawSMC(smcDataRef.current as Parameters<KLineChartHandle['drawSMC']>[0], next)
                              }
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {}
                <button
                  className={`vl-btn ${showTL ? 'active' : ''}`}
                  style={{ color: showTL ? 'var(--cyan)' : 'var(--muted)', fontSize: '.55rem', padding: '2px 6px' }}
                  title="Линии тренда (авто)"
                  onClick={() => {
                    if (showTL) {
                      chartRef.current?.clearTrendlines()
                      setShowTL(false)
                    } else {
                      chartRef.current?.drawTrendlines()
                      setShowTL(true)
                    }
                  }}
                >
                  TL
                </button>
                <span style={{ width: 1, height: 14, background: 'var(--line2)', margin: '0 2px' }} />
                <button
                  className={`vl-btn ${showAlerts ? 'active' : ''}`}
                  style={{ color: showAlerts ? '#ffa500' : 'var(--muted)', fontSize: '.55rem', padding: '2px 6px', position: 'relative' }}
                  title="Алерты по зонам OB"
                  onClick={() => setShowAlerts(v => !v)}
                >
                  🔔
                  {alerts.filter(a => a.pair === pair).length > 0 && (
                    <span style={{ position: 'absolute', top: -3, right: -3, background: '#ffa500', color: '#000', borderRadius: '50%', width: 10, height: 10, fontSize: '.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {alerts.filter(a => a.pair === pair).length}
                    </span>
                  )}
                </button>
                <button
                  className="vl-btn"
                  style={{ color: 'var(--muted)', fontSize: '.5rem', padding: '2px 5px' }}
                  title="Бэктест OB-стратегии на истории"
                  onClick={runBacktest}
                  disabled={backtestLoading}
                >
                  {backtestLoading ? '···' : 'BT'}
                </button>
                <button
                  className="vl-btn"
                  style={{ color: 'var(--muted)', fontSize: '.55rem', padding: '2px 5px' }}
                  title="Глоссарий SMC терминов"
                  onClick={() => setShowGlossary(true)}
                >
                  📖
                </button>
              </div>
            </div>

            {}
            <div style={{ position: 'relative' }}>
              {chartLoading && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg2)', flexDirection: 'column', gap: 8,
                }}>
                  <div className="ld-bar" style={{ width: 120 }} />
                  <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Загрузка графика...</div>
                </div>
              )}
              <KLineChart
                ref={chartRef}
                onReady={handleChartReady}
                onOHLC={(c) => setMarketData(c)}
                onCandleCloseTime={(ts) => setCandleCloseTs(ts)}
              />
              {}
              {candleCountdown && priceY != null && (
                <div
                  className="chart-countdown"
                  style={{
                    top: priceY + 11,
                    color: priceDir === 'up' ? '#00e676' : '#ff3d57',
                  }}
                >
                  {candleCountdown}
                </div>
              )}
            </div>
          </div>

          </div>

          {showAlerts && (
            <div style={{ marginTop: 8, background: 'var(--bg2)', border: '1px solid rgba(255,165,0,0.25)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '.6rem', color: '#ffa500', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>🔔 Алерты по зонам</span>
                <span style={{ fontSize: '.55rem', color: 'var(--dim)' }}>Уведомление при входе цены в зону</span>
              </div>
              {smcDataRef.current ? (
                <>
                  <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 6 }}>Нажмите 🔔 чтобы поставить алерт на OB зону:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {smcDataRef.current.orderBlocks.slice(0, 5).map((ob, i) => {
                      const existing = alerts.find(a => a.pair === pair && Math.abs(a.price_high - ob.high) < 0.01 && Math.abs(a.price_low - ob.low) < 0.01)
                      const label = `${ob.type === 'bullish' ? 'Bull' : 'Bear'} OB ${ob.quality} $${ob.low.toFixed(0)}-$${ob.high.toFixed(0)}`
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg3)', borderRadius: 4, borderLeft: `2px solid ${ob.type === 'bullish' ? 'var(--long)' : 'var(--short)'}` }}>
                          <span style={{ fontSize: '.58rem', color: ob.type === 'bullish' ? 'var(--long)' : 'var(--short)', fontWeight: 600, width: 28 }}>{ob.quality}</span>
                          <span style={{ fontSize: '.6rem', color: 'var(--text)', flex: 1 }}>${ob.low.toFixed(0)} – ${ob.high.toFixed(0)}</span>
                          <span style={{ fontSize: '.55rem', color: 'var(--dim)' }}>{ob.type === 'bullish' ? '↑' : '↓'} {ob.strength}</span>
                          {existing ? (
                            <button onClick={() => deleteAlert(existing.id)} style={{ background: 'rgba(255,165,0,0.15)', border: 'none', color: '#ffa500', cursor: 'pointer', fontSize: '.6rem', padding: '2px 6px', borderRadius: 3 }}>🔔 ✕</button>
                          ) : (
                            <button onClick={() => createAlert(ob.type === 'bullish' ? 'ob_bullish' : 'ob_bearish', ob.high, ob.low, label)} style={{ background: 'rgba(100,100,100,0.2)', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.6rem', padding: '2px 6px', borderRadius: 3 }}>🔔</button>
                          )}
                        </div>
                      )
                    })}
                    {smcDataRef.current.orderBlocks.length === 0 && (
                      <div style={{ fontSize: '.6rem', color: 'var(--dim)', textAlign: 'center', padding: '8px 0' }}>Нет активных OB зон. Нажмите SMC.</div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '.6rem', color: 'var(--dim)', textAlign: 'center', padding: '8px 0' }}>Сначала нажмите SMC для загрузки зон</div>
              )}
              {alerts.filter(a => a.pair === pair).length > 0 && (
                <>
                  <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 5, marginTop: 8, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>Активные алерты для {pair}:</div>
                  {alerts.filter(a => a.pair === pair).map(alert => (
                    <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', background: 'rgba(255,165,0,0.06)', borderRadius: 3, marginBottom: 3 }}>
                      <span style={{ fontSize: '.6rem', color: '#ffa500' }}>🔔</span>
                      <span style={{ fontSize: '.58rem', color: 'var(--text)', flex: 1 }}>{alert.label || `$${Number(alert.price_low).toFixed(0)}-$${Number(alert.price_high).toFixed(0)}`}</span>
                      <button onClick={() => deleteAlert(alert.id)} style={{ background: 'none', border: 'none', color: 'var(--short)', cursor: 'pointer', fontSize: '.7rem', padding: '0 3px' }}>✕</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {}
          {aiOut === 'empty' && (
            <div className="empty" style={{ height: 180 }}>
              <div className="empty-ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <div className="empty-t">{t('press_analyze')}</div>
              <div className="empty-s">4-шаговый SMC анализ · Groq AI</div>
            </div>
          )}

          {aiOut === 'loading' && (
            <div className="loading" style={{ height: 140 }}>
              <div className="ld-bar" />
              <div className="ld-t">ANALYZING {pair} {tf.toUpperCase()}</div>
              <div className="ld-s">{loadingStep}</div>
            </div>
          )}

          {aiOut === 'result' && a && m && p && (
            <>
              <div className={`verdict ${V}`} style={{ marginTop: 10 }}>
                <div className={`vsig ${V}`}>{String(a.verdict)}</div>
                <div className="vmeta">
                  <div className="vpair">{pair} · {tf.toUpperCase()}</div>
                  <div className="vprice">${Number(m.price || 0).toLocaleString()}</div>
                  <div className="velap">{elap}s · Groq</div>
                </div>
                <div className="vstats">
                  <div className="vst">
                    <div className="vst-l">{t('confidence')}</div>
                    <div className="vst-v">{String(a.confidence)}%</div>
                    <div className="vbar"><div className="vbar-f" style={{ width: `${a.confidence}%` }} /></div>
                  </div>
                  <div className="vst">
                    <div className="vst-l">{t('leverage')}</div>
                    <div className="vst-v">{String(a.leverage)}×</div>
                  </div>
                  <div className="vst">
                    <div className="vst-l">{t('risk')}</div>
                    <div className="vst-v" style={{ color: rc }}>{String(a.risk_score)}/10</div>
                  </div>
                  <div className="vst">
                    <div className="vst-l">{t('entry')}</div>
                    <div className="vst-v" style={{ fontSize: '.75rem' }}>{a.entry_type === 'market' ? 'MKT' : 'LMT'}</div>
                  </div>
                </div>
              </div>

              <div className="pipe">
                {[
                  { key: 'step1', label: t('step1_technical'), sig: (p.step1 as Record<string,unknown>)?.signal, val: `${(p.step1 as Record<string,unknown>)?.strength}/10`, sum: (p.step1 as Record<string,unknown>)?.summary },
                  { key: 'step2', label: t('step2_risk'),      sig: (p.step2 as Record<string,unknown>)?.verdict, val: `${(p.step2 as Record<string,unknown>)?.confidence}%`, sum: (p.step2 as Record<string,unknown>)?.summary },
                  { key: 'step3', label: t('step3_final'),     sig: (p.step3 as Record<string,unknown>)?.verdict, val: `${(p.step3 as Record<string,unknown>)?.confidence}%`, sum: 'SMC confluence' },
                ].map(st => (
                  <div className="pc" key={st.key}>
                    <div className="pn">{st.label}</div>
                    <div className={`ps ${vc(String(st.sig))}`}>
                      {String(st.sig || '—')} <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>{String(st.val)}</span>
                    </div>
                    <div className="psum">{String(st.sum || '').slice(0, 90)}{String(st.sum || '').length > 90 ? '…' : ''}</div>
                  </div>
                ))}
              </div>

              <div className="levels">
                <div className="lv"><div className="lv-l">{t('entry')}</div><div className="lv-v lv-entry">${Number(a.entry_price || 0).toLocaleString()}</div><div className="lv-p">{a.entry_type === 'market' ? 'market' : 'limit'}</div></div>
                <div className="lv"><div className="lv-l">{t('take_profit')}</div><div className="lv-v lv-tp">${Number(a.tp_price || 0).toLocaleString()}</div><div className="lv-p">+{String(a.tp_pct || '—')}%</div></div>
                <div className="lv"><div className="lv-l">{t('stop_loss')}</div><div className="lv-v lv-sl">${Number(a.sl_price || 0).toLocaleString()}</div><div className="lv-p">-{String(a.sl_pct || '—')}%</div></div>
              </div>

              {/* Risk management block */}
              {aiData?.risk_management && (() => {
                const rm = aiData.risk_management as Record<string, unknown>
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
              })()}

              {/* OB Quality Card */}
              {a.ob_used && (() => {
                const ob = a.ob_used as Record<string, unknown>
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
              })()}

              {(String(a.verdict) === 'LONG' || String(a.verdict) === 'SHORT') && onNavigate && (
                <button
                  onClick={() => {
                    localStorage.setItem('kotvuk:trade_prefill', JSON.stringify({
                      pair,
                      direction: String(a.verdict).toLowerCase(),
                      entry_price: Number(a.entry_price),
                      tp_price: Number(a.tp_price),
                      sl_price: Number(a.sl_price),
                      leverage: Number(a.leverage),
                      order_type: String(a.entry_type) === 'limit' ? 'limit' : 'market',
                    }))
                    onNavigate('trades')
                  }}
                  style={{
                    width: '100%', marginTop: 8, marginBottom: 4,
                    padding: '9px 0', borderRadius: 4, border: 'none', cursor: 'pointer',
                    fontSize: '.72rem', fontWeight: 700, letterSpacing: '.04em',
                    background: String(a.verdict) === 'LONG' ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.15)',
                    color: String(a.verdict) === 'LONG' ? 'var(--long)' : 'var(--short)',
                    borderTop: `1px solid ${String(a.verdict) === 'LONG' ? 'var(--long)' : 'var(--short)'}`,
                  }}
                >
                  ОТКРЫТЬ {String(a.verdict)} ПОЗИЦИЮ →
                </button>
              )}

              {String(a.verdict) === 'WAIT' && a.wait_for && (
                <div style={{ margin: '10px 0', padding: '12px 14px', background: 'rgba(255,165,0,0.08)', borderRadius: 6, border: '1px solid rgba(255,165,0,0.25)' }}>
                  <div style={{ fontSize: '.6rem', color: '#ffa500', fontWeight: 700, marginBottom: 4 }}>⏳ ЖДАТЬ СИГНАЛА</div>
                  <div style={{ fontSize: '.65rem', color: 'var(--text)', lineHeight: 1.6 }}>{String(a.wait_for)}</div>
                </div>
              )}

              <div className="desc">{String(a.full_description || '—')}</div>

              {}
              <div className="instr"><span className="ik" style={{ background: '#f0a500' }}>ВХОД</span><span>{String(a.entry_instruction || '—')}</span></div>
              {a.entry_type === 'limit' && a.entry_limit && (
                <div className="instr" style={{ background: 'rgba(240,165,0,0.08)', borderLeft: '2px solid #f0a500' }}>
                  <span className="ik" style={{ background: '#f0a500' }}>ЛИМИТ</span>
                  <span>Лимитный ордер по <b>${Number(a.entry_limit).toLocaleString()}</b></span>
                </div>
              )}

              {}
              {a.confluence && (
                <div className="instr" style={{ background: 'rgba(0,230,118,0.06)', borderLeft: '2px solid #00e676' }}>
                  <span className="ik" style={{ background: '#00e676', color: '#000' }}>КОНФЛЮЭНС</span>
                  <span>{String(a.confluence)}</span>
                </div>
              )}

              {}
              {a.invalidation && (
                <div className="instr" style={{ background: 'rgba(255,61,87,0.06)', borderLeft: '2px solid #ff3d57' }}>
                  <span className="ik" style={{ background: '#ff3d57' }}>ИНВАЛИД</span>
                  <span>{String(a.invalidation)}</span>
                </div>
              )}

              {}
              {a.position_size && (
                <div className="instr" style={{ background: 'rgba(100,180,255,0.06)', borderLeft: '2px solid #64b4ff' }}>
                  <span className="ik" style={{ background: '#64b4ff', color: '#000' }}>ОБЪЁМ</span>
                  <span>{String(a.position_size)}</span>
                </div>
              )}

              <div className="instr" style={{ marginBottom: 10 }}><span className="ik" style={{ background: '#ff3d57' }}>ВЫХОД</span><span>{String(a.exit_instruction || '—')}</span></div>

              <div className="sec">{t('insights')}</div>
              <div className="ins-grid">
                {((a.insights as { icon: string; tag: string; text: string }[]) || []).map((ins, i) => (
                  <div className="ins" key={i}>
                    <div className="ins-top"><span className="ins-icon">{ins.icon}</span><span className="ins-tag">{ins.tag}</span></div>
                    <div className="ins-txt">{ins.text}</div>
                  </div>
                ))}
              </div>

              <div className="tbox" style={{ marginBottom: 10 }}>
                <div className="thead"><span className="thead-t">{t('why_signal')}</span></div>
                <div style={{ padding: '9px 12px', fontSize: '.67rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                  {String(a.why_this_signal || '—')}
                </div>
              </div>

              {}
              {smcProb && (
                <div className="tbox" style={{ marginBottom: 20 }}>
                  <div className="thead">
                    <span className="thead-t">SMC ВЕРОЯТНОСТЬ</span>
                    <span style={{
                      fontSize: '.58rem', padding: '2px 7px', borderRadius: 3, marginLeft: 8,
                      background: smcProb.scenario === 'LONG' ? 'rgba(0,230,118,0.15)' : smcProb.scenario === 'SHORT' ? 'rgba(255,61,87,0.15)' : 'rgba(136,136,136,0.15)',
                      color: smcProb.scenario === 'LONG' ? 'var(--long)' : smcProb.scenario === 'SHORT' ? 'var(--short)' : 'var(--muted)',
                    }}>{smcProb.scenario} · {smcProb.probability}%</span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    {}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Вероятность</span>
                        <span style={{ fontSize: '.6rem', color: 'var(--text)', fontWeight: 600 }}>{smcProb.probability}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3 }}>
                        <div style={{
                          height: 5, borderRadius: 3, transition: 'width .4s',
                          width: `${smcProb.probability}%`,
                          background: smcProb.probability >= 70 ? 'var(--long)' : smcProb.probability >= 50 ? 'var(--wait)' : 'var(--short)',
                        }} />
                      </div>
                    </div>
                    {}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      {[
                        { l: 'R:R', v: `${smcProb.riskReward}:1` },
                        { l: 'Expected R', v: `${smcProb.expectedR > 0 ? '+' : ''}${smcProb.expectedR}R` },
                        { l: 'Уверенность', v: `${smcProb.confidence}%` },
                      ].map(({ l, v }) => (
                        <div key={l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 3, padding: '5px 7px' }}>
                          <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: '.65rem', fontWeight: 600 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {}
                    <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase' }}>Факторы</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                      {[
                        { name: 'HTF Структура', val: smcProb.factors.htfStructure, max: 25 },
                        { name: 'Зоны конфлюэнса', val: smcProb.factors.confluenceZones, max: 20 },
                        { name: 'Профиль объёма', val: smcProb.factors.volumeProfile, max: 15 },
                        { name: 'Временной контекст', val: smcProb.factors.temporalContext, max: 15 },
                        { name: 'Исторические стат.', val: smcProb.factors.historicalStats, max: 20 },
                        { name: 'Сентимент рынка', val: smcProb.factors.marketSentiment, max: 5 },
                      ].map(({ name, val, max }) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 105, fontSize: '.58rem', color: 'var(--muted)', flexShrink: 0 }}>{name}</span>
                          <div style={{ flex: 1, height: 3, background: 'var(--bg3)', borderRadius: 2 }}>
                            <div style={{ height: 3, borderRadius: 2, width: `${(val / max) * 100}%`, background: 'var(--cyan)', transition: 'width .3s' }} />
                          </div>
                          <span style={{ fontSize: '.6rem', color: 'var(--text)', width: 28, textAlign: 'right' }}>{val}/{max}</span>
                        </div>
                      ))}
                    </div>
                    {}
                    <div style={{ fontSize: '.63rem', color: 'var(--muted)', lineHeight: 1.5, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
                      {smcProb.recommendation}
                    </div>
                    {}
                    {smcProb.alerts.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {smcProb.alerts.map((alert, i) => {
                          const alertBg = alert.color === 'green' ? 'rgba(0,230,118,0.1)' : alert.color === 'red' ? 'rgba(255,61,87,0.1)' : alert.color === 'orange' ? 'rgba(255,165,0,0.1)' : 'rgba(255,220,0,0.1)'
                          const alertBorder = alert.color === 'green' ? '#00e676' : alert.color === 'red' ? '#ff3d57' : alert.color === 'orange' ? '#ffa500' : '#ffdd00'
                          const stageName = alert.level === 'watchlist' ? 'НАБЛЮДАТЬ' : alert.level === 'setup_ready' ? 'ГОТОВО' : 'ТРИГГЕР'
                          return (
                            <div key={i} style={{ background: alertBg, border: `1px solid ${alertBorder}40`, borderLeft: `3px solid ${alertBorder}`, borderRadius: 3, padding: '6px 9px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: '.55rem', color: alertBorder, fontWeight: 700, textTransform: 'uppercase' }}>СТАДИЯ {alert.stage} · {stageName}</span>
                                <span style={{ fontSize: '.55rem', color: 'var(--muted)' }}>{alert.confidence}%</span>
                              </div>
                              <div style={{ fontSize: '.6rem', color: 'var(--text)', lineHeight: 1.4 }}>{alert.message}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {}
              {a && (
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => setShowHistorical(true)}
                    style={{
                      padding: '7px 18px', background: 'var(--bg3)', border: '1px solid var(--line2)',
                      borderRadius: 4, cursor: 'pointer', fontSize: '.63rem', color: 'var(--muted)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    История похожих сетапов
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {}
        <div className="ai-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-card-title">{t('market_data')}</div>
            {marketData ? (
              <>
                <div className="ir"><span className="in">Price</span><span className="iv" style={{ color: 'var(--cyan)' }}>${marketData.close.toLocaleString()}</span></div>
                <div className="ir"><span className="in">Open</span><span className="iv">${marketData.open.toLocaleString()}</span></div>
                <div className="ir"><span className="in">High</span><span className="iv" style={{ color: 'var(--long)' }}>${marketData.high.toLocaleString()}</span></div>
                <div className="ir"><span className="in">Low</span><span className="iv" style={{ color: 'var(--short)' }}>${marketData.low.toLocaleString()}</span></div>
                <div className="ir"><span className="in">Volume</span><span className="iv">{(marketData.volume / 1000).toFixed(1)}K</span></div>
              </>
            ) : (
              <div style={{ color: 'var(--dim)', fontSize: '.63rem', textAlign: 'center', padding: '12px 0' }}>{t('load_chart_first')}</div>
            )}
          </div>
          <div className="sidebar-card">
            <div className="sidebar-card-title">SMC ДАННЫЕ</div>
            {sidebarInds.length > 0
              ? sidebarInds.map(row => (
                  <div className="ir" key={row.name}>
                    <span className="in">{row.name}</span>
                    <span className="iv">{row.value}</span>
                    {row.label && <span className={`tag tag-${row.color}`} style={{ fontSize: '.55rem' }}>{row.label}</span>}
                  </div>
                ))
              : <div style={{ color: 'var(--dim)', fontSize: '.63rem', textAlign: 'center', padding: '12px 0' }}>{t('run_analysis')}</div>
            }
          </div>
          <div className="sidebar-card">
            <div className="sidebar-card-title">{t('sr_levels')}</div>
            {sidebarSR.length > 0
              ? sidebarSR.map((row, i) => (
                  <div className="ir" key={i}>
                    <span className="in">{row.type}</span>
                    <span className="iv" style={{ color: row.type === 'R' ? 'var(--short)' : 'var(--long)' }}>
                      ${row.value.toLocaleString()}
                    </span>
                  </div>
                ))
              : <div style={{ color: 'var(--dim)', fontSize: '.63rem', textAlign: 'center', padding: '12px 0' }}>{t('run_analysis')}</div>
            }
          </div>
        </div>
      </div>
    </div>

    {}
    <DrawingSettingsModal
      info={drawingSettings}
      onClose={() => setDrawingSettings(null)}
      onSave={(id, updates) => {
        chartRef.current?.updateOverlay(id, updates)
        showToast('Настройки сохранены', 'ok')
      }}
      onDelete={(id) => {
        chartRef.current?.removeOverlayById(id)
        showToast('Объект удалён', 'ok')
      }}
    />
    {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}
    {showHistorical && a && (
      <HistoricalSetupsModal
        currentPair={pairRef.current}
        currentTf={tfRef.current}
        currentVerdict={String(a.verdict || '')}
        onClose={() => setShowHistorical(false)}
      />
    )}
    {backtestOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: 700 }}>📊 БЭКТЕСТ OB-СТРАТЕГИИ</div>
              <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginTop: 2 }}>{pair} · {tf.toUpperCase()} · последние 400 свечей</div>
            </div>
            <button onClick={() => setBacktestOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
          </div>
          {backtestLoading && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div className="ld-bar" style={{ width: 160, margin: '0 auto 10px' }} />
              <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Анализ исторических данных...</div>
            </div>
          )}
          {!backtestLoading && backtestData && (() => {
            const st = backtestData.stats as Record<string, unknown>
            const byQ = backtestData.by_quality as { quality: string; total: number; hit_rate: number; bounce_rate: number }[]
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                  {([
                    { label: 'Всего OB', value: String(st.total_obs), sub: `${st.bull_obs} Bull / ${st.bear_obs} Bear`, color: undefined },
                    { label: 'Hit Rate', value: `${st.hit_rate}%`, sub: `${st.hit_count} из ${st.total_obs} достигли зоны`, color: Number(st.hit_rate) >= 60 ? 'var(--long)' : 'var(--wait)' },
                    { label: 'Bounce Rate', value: `${st.bounce_rate}%`, sub: `отскоков из касаний`, color: Number(st.bounce_rate) >= 55 ? 'var(--long)' : Number(st.bounce_rate) >= 40 ? 'var(--wait)' : 'var(--short)' },
                    { label: 'Avg R:R', value: st.avg_rr !== null ? `${st.avg_rr}:1` : '—', sub: 'ср. соотношение риск/прибыль', color: Number(st.avg_rr) >= 1.5 ? 'var(--long)' : 'var(--wait)' },
                  ] as { label: string; value: string; sub: string; color?: string }[]).map(({ label, value, sub, color }) => (
                    <div key={label} style={{ background: 'var(--bg3)', borderRadius: 5, padding: '8px 10px' }}>
                      <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: '.85rem', fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
                      <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginTop: 2 }}>{sub}</div>
                    </div>
                  ))}
                </div>
                {byQ && byQ.length > 0 && (
                  <>
                    <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>По качеству OB</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                      {byQ.map(q => (
                        <div key={q.quality} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--bg3)', borderRadius: 4 }}>
                          <span style={{ width: 24, fontSize: '.65rem', fontWeight: 700, color: q.quality === 'A+' ? 'var(--long)' : q.quality === 'A' ? 'var(--cyan)' : 'var(--muted)' }}>{q.quality}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--muted)', width: 44 }}>{q.total} OB</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>Hit {q.hit_rate}% → Bounce {q.bounce_rate}%</div>
                            <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: 4, borderRadius: 2, width: `${q.bounce_rate}%`, background: 'var(--long)' }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ fontSize: '.55rem', color: 'var(--dim)', lineHeight: 1.6, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
                  📌 Hit Rate — % OB зон, которых достигла цена в следующих {String(backtestData.verify_candles)} свечах. Bounce Rate — % отскоков от зоны.
                </div>
              </>
            )
          })()}
          {!backtestLoading && !backtestData && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--dim)', fontSize: '.63rem' }}>Нет данных</div>
          )}
          <button onClick={runBacktest} disabled={backtestLoading} style={{ width: '100%', marginTop: 12, padding: '8px 0', borderRadius: 4, border: '1px solid var(--line2)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer', fontSize: '.65rem' }}>
            {backtestLoading ? 'Загрузка...' : '🔄 Обновить'}
          </button>
        </div>
      </div>
    )}
    </>
  )
}
