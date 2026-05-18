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
import AiResultPanel from '@/components/app/ai/AiResultPanel'
import AiBacktestModal from '@/components/app/ai/AiBacktestModal'
import { usePairs } from '@/hooks/usePairs'

const DRAW_TOOL_KEYS = [
  'segment', 'rayLine', 'horizontalStraightLine', 'verticalStraightLine',
  'priceLine', 'parallelStraightLine', 'priceChannelLine', 'priceRect',
  'circle', 'polygon', 'polyline', 'fibRetracement',
] as const
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

  const DRAW_TOOLS = useMemo(() => ({
    segment:                t('draw_segment_lbl'),
    rayLine:                t('draw_ray_lbl'),
    horizontalStraightLine: t('draw_hline_full_lbl'),
    verticalStraightLine:   t('draw_vline_full_lbl'),
    priceLine:              t('draw_price_line_lbl'),
    parallelStraightLine:   t('draw_parallel_lbl'),
    priceChannelLine:       t('draw_price_channel_lbl'),
    priceRect:              t('draw_rect_full_lbl'),
    circle:                 t('draw_circle_lbl'),
    polygon:                t('draw_polygon_lbl'),
    polyline:               t('draw_polyline_lbl'),
    fibRetracement:         t('draw_fibonacci_lbl'),
  }), [t])
  const { pairs: allPairs } = usePairs()
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
  const triggerAnalysisRef = useRef<(pair?: string, tf?: string) => void>(() => {})

  const filteredPairs = React.useMemo(
    () => pairSearch
      ? allPairs.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
      : allPairs,
    [pairSearch, allPairs]
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
        if (window.confirm(t('confirm_delete_overlay_lbl'))) {
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
  }, [t])

  useEffect(() => {
    function onUpdateMarkup(e: Event) {
      const d = (e as CustomEvent).detail
      chartRef.current?.updateMarkup(d.tp, d.sl, d.entry)
      showToast(t('levels_updated_lbl'), 'ok')
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
        if (!drawn) { showToast(t('no_active_zones_lbl'), 'err'); return }
        showToast(t('zones_drawn_lbl').replace('{count}', String(drawn)).replace('{type}', isOB ? 'OB' : 'FVG'), 'ok')
        return
      }

      if ((isOB || isFVG) && (!d.priceFrom || !d.priceTo) && smcDataRef.current) {
        const smc = smcDataRef.current
        const items = isOB
          ? smc.orderBlocks.filter(o => (isBull ? o.type === 'bullish' : o.type === 'bearish') && !o.isMitigated)
          : smc.fvgs.filter(f => (isBull ? f.type === 'bullish' : f.type === 'bearish'))
        if (!items.length) { showToast(t('no_active_zones_lbl'), 'err'); return }
        const color = isBull ? '#00e676' : (isFVG ? '#00c8ff' : '#ff3d57')
        items.forEach((z, i) => {
          chartRef.current?.drawZone(z.high, z.low, color, `${isBull ? 'Bull' : 'Bear'} ${isOB ? 'OB' : 'FVG'} ${i + 1}`, 'chat_ob')
        })
        showToast(t('zones_drawn_lbl').replace('{count}', String(items.length)).replace('{type}', isOB ? 'OB' : 'FVG'), 'ok')
        return
      }

      if (!d.priceFrom || !d.priceTo) { showToast(t('ob_load_smc_lbl'), 'err'); return }
      const color = d.color || (isBull ? '#00e676' : isFVG ? '#00c8ff' : '#f0a500')
      chartRef.current?.drawZone(d.priceFrom, d.priceTo, color, d.label || zoneType || 'Zone', zoneType || 'chat_zone')
      showToast(t('zone_drawn_lbl').replace('{label}', d.label || zoneType), 'ok')
    }
    function onDrawLiquidity(e: Event) {
      const d = (e as CustomEvent).detail
      chartRef.current?.drawZone(d.level * 1.001, d.level * 0.999, d.side === 'sell' ? '#ff3d57' : '#00e676', d.side === 'sell' ? 'SSL' : 'BSL', 'chat_liq')
      showToast(t('liq_drawn_lbl'), 'ok')
    }
    function onClearZones(e: Event) {
      const d = (e as CustomEvent).detail
      if (d.target === 'all' || d.target === 'markup') chartRef.current?.clearMarkup()
      if (d.target === 'all') chartRef.current?.clearDrawings()
      if (d.target === 'all' || d.target === 'ob' || d.target === 'fvg' || d.target === 'liquidity') chartRef.current?.clearSMC()
      showToast(t('cleared'), 'ok')
    }
    function onSetOpacity(e: Event) {
      const d = (e as CustomEvent).detail
      const group = d.group === 'ob' ? 'smc_ob' : d.group === 'fvg' ? 'smc_fvg' : d.group === 'liquidity' ? 'smc_liq' : 'ai'
      chartRef.current?.setZoneOpacity(group, d.opacityValue || 0.2)
      showToast(t('opacity_changed_lbl'), 'ok')
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
  }, [t])

  useEffect(() => {
    const TF_MAP: Record<string, string> = {
      '1m': '1м', '1M': '1м', '5m': '5м', '5M': '5м',
      '15m': '15м', '15M': '15м', '30m': '30м', '30M': '30м',
      '1h': '1ч', '1H': '1ч', '4h': '4ч', '4H': '4ч', '1d': '1д', '1D': '1д',
    }
    function handler(e: Event) {
      const d = (e as CustomEvent).detail as { pair?: string; tf?: string } | undefined
      const normalizedTf = d?.tf ? (TF_MAP[d.tf] ?? d.tf) : undefined
      triggerAnalysisRef.current(d?.pair, normalizedTf)
    }
    window.addEventListener('kotvuk:trigger_analysis', handler)
    return () => window.removeEventListener('kotvuk:trigger_analysis', handler)
  }, [])

  useEffect(() => {
    fetch('/api/subscription').then(r => r.json()).then(d => {
      if (d.ok) setQuota({ remaining: d.remaining, limit: d.limit, tier: d.subscription?.tier || 'free' })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (active) {
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
          showToast(
            (ob.type === 'bullish' ? t('price_near_bull_ob') : t('price_near_bear_ob')).replace('{range}', `$${ob.low.toFixed(0)}-$${ob.high.toFixed(0)}`),
            'ok'
          )
          return
        }
      }

      for (const liq of smc.liquidityLevels) {
        if (liq.isSwept) continue
        const dist = Math.abs(price - liq.price) / price
        if (dist < THRESHOLD) {
          showToast(
            t('price_near_liq').replace('{type}', liq.type === 'buy' ? 'BSL' : 'SSL').replace('{price}', `$${liq.price.toFixed(0)}`),
            'ok'
          )
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
    } catch {}
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
    } catch {}
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
            showToast(d.error || t('smc_error_lbl'), 'err')
          }
        } catch {
          showToast(t('smc_load_error_lbl'), 'err')
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
        showToast(t('alert_created_lbl').replace('{label}', label), 'ok')
      }
    } catch { showToast(t('alert_create_error_lbl'), 'err') }
  }

  async function deleteAlert(id: number) {
    const token = await getValidToken().catch(() => null)
    if (!token) return
    try {
      await fetch(`/api/alerts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setAlerts(prev => prev.filter(a => a.id !== id))
      showToast(t('alert_deleted_lbl'), 'ok')
    } catch {}
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
      else showToast(d.error || t('backtest_run_error_lbl'), 'err')
    } catch { showToast(t('backtest_run_error_lbl'), 'err') }
    setBacktestLoading(false)
  }

  async function runAI() {
    if (analyzing) return
    try {
      await getValidToken()
    } catch {
      showToast(t('auth_error_lbl'), 'err')
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
          chartRef.current?.clearMarkup()
        } else {
          chartRef.current?.drawMarkup({ ...a, supports: m.supports, resistances: m.resistances })
        }

        if (a.ob_used) {
          chartRef.current?.removeOverlayById('selected_ob')
          const ob = a.ob_used as Record<string, unknown>
          chartRef.current?.highlightOB(
            Number(ob.high),
            Number(ob.low),
            (ob.type as string) === 'bullish' ? 'bullish' : 'bearish',
            `${(ob.type as string) === 'bullish' ? '↑' : '↓'} ${ob.quality} OB · ${ob.verdict}`
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
        const errMsg = data.error_code === 'quota_exceeded' ? t('quota_exhausted_lbl') : data.error || t('error')
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
      { name: t('vol_indicator_lbl'),   value: String(m.volSignal || ''),                    color: 'neut', label: '' },
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

  useEffect(() => {
    triggerAnalysisRef.current = (newPair?: string, newTf?: string) => {
      if (newPair) { setPair(newPair); pairRef.current = newPair }
      if (newTf) { setTf(newTf); tfRef.current = newTf }
      runAI()
    }
  })

  const a = aiData?.analysis as Record<string, unknown> | undefined
  const m = aiData?.market as Record<string, unknown> | undefined
  const p = aiData?.pipeline as Record<string, unknown> | undefined
  const elap = aiData?.elapsed as number | undefined

  const V = a ? vc(String(a.verdict)) : 'wait'
  const rc = a ? (Number(a.risk_score) >= 7 ? 'var(--short)' : Number(a.risk_score) >= 4 ? 'var(--wait)' : 'var(--long)') : 'var(--text)'


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
              <input className="ds" placeholder={t('search_pair_input')} value={pairSearch} onChange={e => setPairSearch(e.target.value)} autoFocus />
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
              ? t('quota_exhausted_lbl')
              : t('quota_remaining_lbl').replace('{remaining}', String(quota.remaining)).replace('{limit}', String(quota.limit))}
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
                    title={t('select_tool_lbl')}
                    style={{ padding: '3px 7px', fontSize: '.6rem', display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M13 2L14 5 5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                    <span style={{ flex: 1, textAlign: 'left' }}>{DRAW_TOOLS[drawTool as keyof typeof DRAW_TOOLS] ?? drawTool}</span>
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
                      {DRAW_TOOL_KEYS.map(key => (
                        <div
                          key={key}
                          onClick={() => {
                            setDrawTool(key)
                            setDrawMenuOpen(false)
                            chartRef.current?.setDrawing(key)
                            setIsDrawing(true)
                          }}
                          style={{
                            padding: '6px 12px', fontSize: '.63rem', cursor: 'pointer',
                            background: drawTool === key ? 'var(--bg3)' : 'transparent',
                            color: drawTool === key ? 'var(--cyan)' : 'var(--text)',
                            borderLeft: drawTool === key ? '2px solid var(--cyan)' : '2px solid transparent',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = drawTool === key ? 'var(--bg3)' : 'transparent' }}
                        >
                          {DRAW_TOOLS[key]}
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
                  title={`${t('draw')}: ${DRAW_TOOLS[drawTool as keyof typeof DRAW_TOOLS] ?? drawTool}`}
                  style={{ padding: '4px 7px', color: isDrawing ? 'var(--cyan)' : undefined }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M13 2L14 5 5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <line x1="10" y1="4" x2="12" y2="6" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                </button>
                {}
                <button className="vl-btn" onClick={() => { chartRef.current?.clearDrawings(); setIsDrawing(false) }} title={t('clear_drawings_lbl')} style={{ padding: '4px 7px', color: 'var(--short)' }}>
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
                    title={t('smc_settings_lbl')}
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
                        {t('smc_settings_lbl')}
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
                  title={t('trendlines_lbl')}
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
                  title={t('ob_alerts_lbl')}
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
                  title={t('bt_hist_lbl')}
                  onClick={runBacktest}
                  disabled={backtestLoading}
                >
                  {backtestLoading ? '···' : 'BT'}
                </button>
                <button
                  className="vl-btn"
                  style={{ color: 'var(--muted)', fontSize: '.55rem', padding: '2px 5px' }}
                  title={t('glossary_lbl')}
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
                  <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{t('chart_loading_lbl')}</div>
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
                <span style={{ fontSize: '.6rem', color: '#ffa500', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('ob_alerts_zone_lbl')}</span>
                <span style={{ fontSize: '.55rem', color: 'var(--dim)' }}>{t('ob_alerts_hint_lbl')}</span>
              </div>
              {smcDataRef.current ? (
                <>
                  <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 6 }}>{t('ob_alerts_click_lbl')}</div>
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
                      <div style={{ fontSize: '.6rem', color: 'var(--dim)', textAlign: 'center', padding: '8px 0' }}>{t('ob_no_zones_lbl')}</div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '.6rem', color: 'var(--dim)', textAlign: 'center', padding: '8px 0' }}>{t('ob_load_smc_lbl')}</div>
              )}
              {alerts.filter(a => a.pair === pair).length > 0 && (
                <>
                  <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 5, marginTop: 8, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>{t('ob_active_alerts_lbl').replace('{pair}', pair)}</div>
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
              <div className="empty-s">{t('ai_analysis_subtitle')}</div>
            </div>
          )}

          {aiOut === 'loading' && (
            <div className="loading" style={{ height: 140 }}>
              <div className="ld-bar" />
              <div className="ld-t">ANALYZING {pair} {tf.toUpperCase()}</div>
              <div className="ld-s">{loadingStep}</div>
            </div>
          )}

          {aiOut === 'result' && aiData && (
            <AiResultPanel
              aiData={aiData}
              pair={pair}
              tf={tf}
              smcProb={smcProb}
              onNavigate={onNavigate}
              onShowHistorical={() => setShowHistorical(true)}
            />
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
            <div className="sidebar-card-title">{t('smc_data_title_lbl')}</div>
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
        showToast(t('settings_saved'), 'ok')
      }}
      onDelete={(id) => {
        chartRef.current?.removeOverlayById(id)
        showToast(t('object_deleted_lbl'), 'ok')
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
    <AiBacktestModal
      open={backtestOpen}
      loading={backtestLoading}
      data={backtestData}
      pair={pair}
      tf={tf}
      onClose={() => setBacktestOpen(false)}
      onRerun={runBacktest}
    />
    </>
  )
}
