'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useLang } from '@/contexts/LangContext'
import { useAuth } from '@/contexts/AuthContext'
import { showToast } from '@/components/ui/Toast'
import KLineChart from '@/components/app/chart/KLineChartComponent'
import type { KLineChartHandle, CandleData, OBData, FVGData, LiqData, BreakerData } from '@/components/app/chart/KLineChartComponent'
import type { ProbabilityResult } from '@/lib/smc'
import DrawingSettingsModal from '@/components/app/chart/DrawingSettingsModal'
import HistoricalSetupsModal from '@/components/app/panels/HistoricalSetupsModal'

const PAIRS = ['BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','ADA/USDT','DOGE/USDT','AVAX/USDT','DOT/USDT','MATIC/USDT','LINK/USDT','UNI/USDT','LTC/USDT','BCH/USDT','ATOM/USDT','FIL/USDT','TRX/USDT','ETC/USDT','XLM/USDT','ALGO/USDT','NEAR/USDT','FTM/USDT','SAND/USDT','MANA/USDT','APE/USDT','OP/USDT','ARB/USDT','SUI/USDT','APT/USDT','INJ/USDT']

const DRAW_TOOLS = [
  { key: 'segment',                label: 'Линия тренда' },
  { key: 'rayLine',                label: 'Луч' },
  { key: 'horizontalStraightLine', label: 'Горизонт. линия' },
  { key: 'verticalStraightLine',   label: 'Вертик. линия' },
  { key: 'priceLine',              label: 'Ценовой уровень' },
  { key: 'parallelStraightLine',   label: 'Парал. канал' },
  { key: 'priceChannelLine',       label: 'Ценовой канал' },
  { key: 'rect',                   label: 'Прямоугольник' },
  { key: 'circle',                 label: 'Окружность' },
  { key: 'polygon',                label: 'Многоугольник' },
  { key: 'polyline',               label: 'Траектория' },
  { key: 'fibonacciLine',          label: 'Фибоначчи' },
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
}

export default function AiPanel({ active, onGetContext }: AiPanelProps) {
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
  const [sidebarInds, setSidebarInds] = useState<string>('')
  const [sidebarSR, setSidebarSR] = useState<string>('')
  const [aiOut, setAiOut] = useState<'empty' | 'loading' | 'result'>('empty')
  const [aiData, setAiData] = useState<Record<string, unknown> | null>(null)
  const [vlResult, setVlResult] = useState<string>('')
  const [vlLoading, setVlLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [chartLoading, setChartLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState('...')
  const [showSMC, setShowSMC] = useState(false)
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
  const [drawTool, setDrawTool] = useState('segment')
  const [drawMenuOpen, setDrawMenuOpen] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const drawMenuRef = useRef<HTMLDivElement>(null)

  const filteredPairs = pairSearch
    ? PAIRS.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
    : PAIRS

  // Candle close countdown + track price Y position
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

  // Update Y position of current price + track direction (for countdown overlay)
  useEffect(() => {
    if (!marketData) return
    const y = chartRef.current?.getYForPrice(marketData.close)
    if (y != null) setPriceY(y)
    if (prevPriceRef.current !== 0) {
      setPriceDir(marketData.close >= prevPriceRef.current ? 'up' : 'down')
    }
    prevPriceRef.current = marketData.close
  }, [marketData])

  // Close draw dropdown on outside click
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

  // Listen for overlay double-click / right-click → open settings
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
    window.addEventListener('kotvuk:overlay:dblclick', onOverlayDblClick)
    window.addEventListener('kotvuk:overlay:rightclick', onOverlayRightClick)
    return () => {
      window.removeEventListener('kotvuk:overlay:dblclick', onOverlayDblClick)
      window.removeEventListener('kotvuk:overlay:rightclick', onOverlayRightClick)
    }
  }, [])

  // Listen for AI chat events
  useEffect(() => {
    function onUpdateMarkup(e: Event) {
      const d = (e as CustomEvent).detail
      chartRef.current?.updateMarkup(d.tp, d.sl, d.entry)
      showToast('Уровни обновлены', 'ok')
    }
    function onDrawZone(e: Event) {
      const d = (e as CustomEvent).detail
      const isOB  = d.zoneType?.startsWith('ob_')
      const isFVG = d.zoneType?.startsWith('fvg_')
      const isBull = d.zoneType?.includes('bullish')

      // If AI didn't provide coords, use actual SMC data from last analysis
      if ((isOB || isFVG) && (!d.priceFrom || !d.priceTo) && smcDataRef.current) {
        const smc = smcDataRef.current
        const items = isOB
          ? smc.orderBlocks.filter(o => (isBull ? o.type === 'bullish' : o.type === 'bearish') && !o.isMitigated)
          : smc.fvgs.filter(f => (isBull ? f.type === 'bullish' : f.type === 'bearish'))
        if (!items.length) { showToast('Нет активных зон. Запустите анализ.', 'err'); return }
        const color = isBull ? '#00e676' : '#ff3d57'
        items.forEach((z, i) => {
          chartRef.current?.drawZone(z.high, z.low, color, `${isBull ? 'Bull' : 'Bear'} ${isOB ? 'OB' : 'FVG'} ${i + 1}`, 'chat_ob')
        })
        showToast(`Нарисовано ${items.length} ${isOB ? 'OB' : 'FVG'} зон`, 'ok')
        return
      }
      // Specific coords provided by AI
      if (!d.priceFrom || !d.priceTo) { showToast('Запустите анализ для получения данных', 'err'); return }
      const color = d.color || (isBull ? '#00e676' : isFVG ? '#00c8ff' : '#f0a500')
      chartRef.current?.drawZone(d.priceFrom, d.priceTo, color, d.label || d.zoneType || 'Zone', d.zoneType || 'chat_zone')
      showToast(`Зона нарисована: ${d.label || d.zoneType}`, 'ok')
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

  // Expose context for AI chat
  useEffect(() => {
    onGetContext?.(() => {
      const a = aiData?.analysis as Record<string, unknown> | undefined
      const m = aiData?.market as Record<string, unknown> | undefined
      return {
        pair: pairRef.current,
        tf: tfRef.current,
        price: (m?.price as number) || 0,
        tp: (a?.tp_price as number) || 0,
        sl: (a?.sl_price as number) || 0,
        entry: (a?.entry_price as number) || 0,
        verdict: (a?.verdict as string) || '',
        smc: m?.smc,
      }
    })
  }, [aiData, onGetContext])

  // Called by KLineChartComponent when klinecharts CDN is ready
  const handleChartReady = useCallback(() => {
    setChartLoading(false)
    // Auto-load default pair/tf
    chartRef.current?.loadChart(pairRef.current, tfRef.current)
  }, [])

  function selectPair(p: string) {
    setPair(p); pairRef.current = p
    setPairOpen(false); setPairSearch('')
    setChartTitle(p + ' · ' + tfRef.current.toUpperCase())
    chartRef.current?.loadChart(p, tfRef.current)
  }

  function selectTf(v: string) {
    setTf(v); tfRef.current = v
    setChartTitle(pairRef.current + ' · ' + v.toUpperCase())
    chartRef.current?.loadChart(pairRef.current, v)
  }

  async function runAI() {
    await getValidToken()
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
        chartRef.current?.drawMarkup({ ...a, supports: m.supports, resistances: m.resistances })
        // Draw SMC if enabled
        if (m.smc) {
          smcDataRef.current = m.smc as { orderBlocks: OBData[]; breakerBlocks?: BreakerData[]; fvgs: FVGData[]; liquidityLevels: LiqData[] }
          if (showSMC) chartRef.current?.drawSMC(m.smc as Parameters<KLineChartHandle['drawSMC']>[0])
        }
        if (data.smc_probability) setSmcProb(data.smc_probability as ProbabilityResult)
        setSidebarInds(buildSidebarInds(m))
        setSidebarSR(buildSidebarSR(m))
      } else {
        showToast(data.error || t('error'), 'err')
        setAiOut('empty')
      }
    } catch {
      clearInterval(iv)
      showToast(t('server_unavailable'), 'err')
      setAiOut('empty')
    }
    setAnalyzing(false)
  }

  async function runVL() {
    await getValidToken()
    const img = chartRef.current?.getScreenshot()
    if (!img) { showToast(t('load_chart_first'), 'err'); return }
    setVlLoading(true); setVlResult('')
    try {
      const r = await fetch('/api/analyze-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: img.split(',')[1], pair, timeframe: tf,
          context: aiData ? `Сигнал: ${(aiData.analysis as Record<string,unknown>)?.verdict}` : '',
        }),
      })
      const d = await r.json()
      if (d.ok) setVlResult(d.analysis)
      else showToast(d.error || t('error'), 'err')
    } catch { showToast(t('error'), 'err') }
    setVlLoading(false)
  }

  function buildSidebarInds(m: Record<string, unknown>) {
    const rows = [
      ['RSI(14)', m.rsi as number, (m.rsi as number) > 70 ? 'bear' : (m.rsi as number) < 30 ? 'bull' : 'neut', (m.rsi as number) > 70 ? 'OB' : (m.rsi as number) < 30 ? 'OS' : 'OK'],
      ['MACD', m.macdSignal as string, m.macdSignal === 'бычий' ? 'bull' : 'bear', m.macdSignal === 'бычий' ? '↑' : '↓'],
      ['EMA50', m.priceVsEma50 === 'выше' ? 'Выше' : 'Ниже', m.priceVsEma50 === 'выше' ? 'bull' : 'bear', ''],
      ['EMA200', m.priceVsEma200 === 'выше' ? 'Выше' : 'Ниже', m.priceVsEma200 === 'выше' ? 'bull' : 'bear', ''],
      ['Volume', m.volSignal as string, 'neut', ''],
    ]
    return rows.map(([n, v, c, l]) =>
      `<div class="ir"><span class="in">${n}</span><span class="iv">${v}</span><span class="tag tag-${c}" style="font-size:.55rem">${l}</span></div>`
    ).join('')
  }

  function buildSidebarSR(m: Record<string, unknown>) {
    const res = ((m.resistances as number[]) || []).map(r => `<div class="ir"><span class="in">R</span><span class="iv" style="color:var(--short)">$${parseFloat(String(r)).toLocaleString()}</span></div>`).join('')
    const sup = ((m.supports as number[]) || []).map(s => `<div class="ir"><span class="in">S</span><span class="iv" style="color:var(--long)">$${parseFloat(String(s)).toLocaleString()}</span></div>`).join('')
    return res + sup || `<div style="color:var(--dim);font-size:.63rem;text-align:center;padding:8px 0">${t('no_levels')}</div>`
  }

  const a = aiData?.analysis as Record<string, unknown> | undefined
  const m = aiData?.market as Record<string, unknown> | undefined
  const p = aiData?.pipeline as Record<string, unknown> | undefined
  const elap = aiData?.elapsed as number | undefined

  const V = a ? vc(String(a.verdict)) : 'wait'
  const rc = a ? (Number(a.risk_score) >= 7 ? 'var(--short)' : Number(a.risk_score) >= 4 ? 'var(--wait)' : 'var(--long)') : 'var(--text)'

  if (!active) return null

  return (
    <>
    <div className="panel active" id="panel-ai">
      {/* Controls */}
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
        <button className="run" onClick={runAI} disabled={analyzing}>
          {analyzing ? t('analyzing') : t('analyze')}
        </button>
      </div>

      {/* Chart + sidebar layout */}
      <div className="ai-layout">
        <div>
          <div className="chart-wrap">
            <div className="chart-toolbar">
              <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{chartTitle}</span>
              {marketData && (
                <span style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--text)' }}>
                  ${marketData.close.toLocaleString()}
                </span>
              )}
              <div className="chart-toolbar-r">
                <span className="cl">{t('draw')}</span>
                {/* Drawing tool dropdown */}
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
                {/* Draw activate button */}
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
                {/* Очистить */}
                <button className="vl-btn" onClick={() => { chartRef.current?.clearDrawings(); setIsDrawing(false) }} title="Очистить рисунки" style={{ padding: '4px 7px', color: 'var(--short)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <line x1="2" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M5.5 4.5V3.5C5.5 3.22 5.72 3 6 3h4c.28 0 .5.22.5.5V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.5 4.5l.7 8.5h5.6l.7-8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/>
                  </svg>
                </button>
                <span style={{ width: 1, height: 14, background: 'var(--line2)', margin: '0 4px' }} />
                {/* SMC toggle */}
                <button
                  className={`vl-btn ${showSMC ? 'active' : ''}`}
                  style={{ color: showSMC ? 'var(--cyan)' : 'var(--muted)', fontSize: '.55rem', padding: '2px 5px' }}
                  title="Smart Money Concepts"
                  onClick={() => {
                    const next = !showSMC
                    setShowSMC(next)
                    if (next && smcDataRef.current) {
                      chartRef.current?.drawSMC(smcDataRef.current as Parameters<KLineChartHandle['drawSMC']>[0])
                    } else {
                      chartRef.current?.clearSMC()
                    }
                  }}
                >SMC</button>
                <span style={{ width: 1, height: 14, background: 'var(--line2)', margin: '0 4px' }} />
                <button className="vl-btn" onClick={runVL} disabled={vlLoading}>
                  {vlLoading ? t('vision_thinking') : t('ai_vision')}
                </button>
              </div>
            </div>

            {/* Chart container with loading overlay */}
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
              {/* Countdown timer — positioned below current price mark on right axis */}
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

          {vlResult && (
            <div className="vl-result visible">{vlResult}</div>
          )}

          {/* AI Output */}
          {aiOut === 'empty' && (
            <div className="empty" style={{ height: 180 }}>
              <div className="empty-ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <div className="empty-t">{t('press_analyze')}</div>
              <div className="empty-s">{t('three_models')}</div>
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
                  <div className="velap">{elap}s · local</div>
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
                  { key: 'kimi', label: t('step1_technical'), sig: (p.kimi as Record<string,unknown>)?.signal, val: `${(p.kimi as Record<string,unknown>)?.strength}/10`, sum: (p.kimi as Record<string,unknown>)?.summary },
                  { key: 'maverick', label: t('step2_risk'), sig: (p.maverick as Record<string,unknown>)?.verdict, val: `${(p.maverick as Record<string,unknown>)?.confidence}%`, sum: (p.maverick as Record<string,unknown>)?.summary },
                  { key: 'qwen', label: t('step3_final'), sig: (p.qwen as Record<string,unknown>)?.verdict, val: `${(p.qwen as Record<string,unknown>)?.confidence}%`, sum: 'Взвешенное решение' },
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

              <div className="desc">{String(a.full_description || '—')}</div>
              <div className="instr"><span className="ik">ВХОД</span><span>{String(a.entry_instruction || '—')}</span></div>
              <div className="instr" style={{ marginBottom: 10 }}><span className="ik">ВЫХОД</span><span>{String(a.exit_instruction || '—')}</span></div>

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

              {/* SMC Probability Block */}
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
                    {/* Probability bar */}
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
                    {/* Key metrics row */}
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
                    {/* 6 factors */}
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
                    {/* Recommendation */}
                    <div style={{ fontSize: '.63rem', color: 'var(--muted)', lineHeight: 1.5, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
                      {smcProb.recommendation}
                    </div>
                    {/* Alerts */}
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

              {/* Historical Setups button */}
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

        {/* Right sidebar */}
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
            <div className="sidebar-card-title">{t('indicators')}</div>
            {sidebarInds
              ? <div dangerouslySetInnerHTML={{ __html: sidebarInds }} />
              : <div style={{ color: 'var(--dim)', fontSize: '.63rem', textAlign: 'center', padding: '12px 0' }}>{t('run_analysis')}</div>
            }
          </div>
          <div className="sidebar-card">
            <div className="sidebar-card-title">{t('sr_levels')}</div>
            {sidebarSR
              ? <div dangerouslySetInnerHTML={{ __html: sidebarSR }} />
              : <div style={{ color: 'var(--dim)', fontSize: '.63rem', textAlign: 'center', padding: '12px 0' }}>{t('run_analysis')}</div>
            }
          </div>
        </div>
      </div>
    </div>

    {/* Drawing settings modal */}
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
    {showHistorical && a && (
      <HistoricalSetupsModal
        currentPair={pairRef.current}
        currentTf={tfRef.current}
        currentVerdict={String(a.verdict || '')}
        onClose={() => setShowHistorical(false)}
      />
    )}
    </>
  )
}
