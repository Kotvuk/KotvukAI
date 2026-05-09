'use client'
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as klinecharts from 'klinecharts'
import { LineType } from 'klinecharts'
import { calcTrendlines } from '@/lib/trendlines'
import { registerFibonacciOverlay } from '@/components/app/chart/fibonacciOverlay'
registerFibonacciOverlay()

try {
  klinecharts.registerOverlay({
    name: 'polyline',
    totalStep: 11,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }: any) => {
      if (coordinates.length < 2) return []
      const figures = []
      for (let i = 0; i < coordinates.length - 1; i++) {
        figures.push({
          type: 'line',
          attrs: { coordinates: [coordinates[i], coordinates[i + 1]] },
          styles: overlay.styles?.line || {},
        })
      }
      return figures
    },
  })
} catch {  }

try {
  klinecharts.registerOverlay({
    name: 'aiPriceLine',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, bounding, overlay }: any) => {
      if (!coordinates[0]) return []
      const y      = coordinates[0].y
      const lineStyle = overlay.styles?.line ?? {}
      const color    = lineStyle.color ?? '#ffffff'
      const label    = typeof overlay.extendData === 'string' ? overlay.extendData : ''
      const figures: any[] = [

        {
          type: 'line',
          attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] },
          styles: { color, size: lineStyle.size ?? 1, style: lineStyle.style ?? 'solid', dashedValue: [4, 4] },
        },
      ]
      if (label) {

        figures.push({
          type: 'text',
          ignoreEvent: true,
          attrs: { x: bounding.width - 4, y: y - 2, text: label, align: 'right', baseline: 'bottom' },
          styles: {
            color: '#fff',
            size: 11,
            family: "'Geist Mono', monospace",
            backgroundColor: color,
            borderRadius: 3,
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          },
        })
      }
      return figures
    },
  })
} catch {  }

try {
  klinecharts.registerOverlay({
    name: 'aiPositionZone',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, bounding, overlay, yAxis }: any) => {
      if (!coordinates[0] || !yAxis) return []
      const d = overlay.extendData as { p1: number; p2: number; fillColor: string; strokeColor: string } | null
      if (!d || !d.p1 || !d.p2) return []
      const x1 = coordinates[0].x
      const x2 = bounding.width
      const y1 = yAxis.convertToPixel(Math.max(d.p1, d.p2))
      const y2 = yAxis.convertToPixel(Math.min(d.p1, d.p2))
      if (x1 >= x2 || Math.abs(y2 - y1) < 1) return []
      return [{
        type: 'polygon',
        attrs: { coordinates: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }] },
        styles: { style: 'stroke_fill', color: d.fillColor, borderColor: d.strokeColor, borderSize: 1 },
      }]
    },
  })
} catch {  }

try {
  klinecharts.registerOverlay({
    name: 'priceRect',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }: any) => {
      if (coordinates.length < 2) return []
      const tl = coordinates[0]
      const br = coordinates[1]

      const x1 = Math.min(tl.x, br.x), x2 = Math.max(tl.x, br.x)
      const y1 = Math.min(tl.y, br.y), y2 = Math.max(tl.y, br.y)
      return [{
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2, y: y2 },
            { x: x1, y: y2 },
          ]
        },
        styles: overlay.styles?.polygon ?? {},
      }]
    },
  })
} catch {  }

export interface SMCDrawSettings {
  ob: boolean
  fvg: boolean
  liq: boolean
  premDisc: boolean
}

export const DEFAULT_SMC_SETTINGS: SMCDrawSettings = {
  ob: true, fvg: true, liq: false,
  premDisc: false,
}

export interface KLineChartHandle {
  loadChart: (pair: string, tf: string) => Promise<void>
  getCandles: () => CandleData[]
  getScreenshot: () => string | null
  getYForPrice: (price: number) => number | null
  setDrawing: (type: string) => void
  clearDrawings: () => void
  updateOverlay: (id: string, updates: { extendData?: unknown; styles?: unknown }) => void
  removeOverlayById: (id: string) => void
  drawMarkup: (a: {
    entry_price?: number; tp_price?: number; sl_price?: number
    tp_pct?: number; sl_pct?: number; verdict?: string
    supports?: number[]; resistances?: number[]
  }) => void
  updateMarkup: (tp?: number, sl?: number, entry?: number) => void
  drawSMC: (
    smc: { orderBlocks?: OBData[]; breakerBlocks?: BreakerData[]; fvgs?: FVGData[]; liquidityLevels?: LiqData[] },
    settings?: Partial<SMCDrawSettings>
  ) => void
  clearSMC: () => void
  drawTrendlines: () => void
  clearTrendlines: () => void
  drawZone: (priceFrom: number, priceTo: number, color: string, label: string, groupId: string) => void
  setZoneOpacity: (groupId: string, opacity: number) => void
  updateSidebarMarket: (cb: (data: CandleData) => void) => void
  getUserDrawings: () => unknown[]
  restoreUserDrawings: (drawings: unknown[]) => void
  highlightOB: (high: number, low: number, type: 'bullish' | 'bearish', label?: string) => void
}

export interface OBData {
  type: 'bullish' | 'bearish'; high: number; low: number; timestamp: number
  strength?: 'weak' | 'moderate' | 'strong'
  quality?: 'A+' | 'A' | 'B' | 'C'
  isMitigated?: boolean
}
export interface BreakerData {
  type: 'bullish' | 'bearish'; high: number; low: number; timestamp: number
  strength?: 'weak' | 'moderate' | 'strong'
}
export interface FVGData {
  type: 'bullish' | 'bearish'; high: number; low: number; startTimestamp: number; endTimestamp: number
  fillPct?: number; quality?: 'A+' | 'A' | 'B' | 'C'
}
export interface LiqData {
  type: 'buy' | 'sell'; price: number; timestamp?: number
  strength?: 'weak' | 'moderate' | 'strong'; isSwept?: boolean
}
export interface CandleData {
  open: number; high: number; low: number; close: number; volume: number; timestamp: number
}

const TF_MAP: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m',
  '1ч': '1h', '4ч': '4h', '1д': '1d',
}
const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
}

function obColors(type: 'bullish' | 'bearish', strength: string | undefined) {
  const s = strength ?? 'moderate'
  if (type === 'bullish') {

    if (s === 'strong')   return { fill: 'rgba(0,30,140,0.75)',  border: '#002daa' }
    if (s === 'moderate') return { fill: 'rgba(0,90,210,0.55)',  border: '#1a6fff' }
                return { fill: 'rgba(0,170,255,0.28)', border: '#33aaff' }
  } else {

    if (s === 'strong')   return { fill: 'rgba(110,0,25,0.75)',  border: '#7a0018' }
    if (s === 'moderate') return { fill: 'rgba(185,20,40,0.55)', border: '#cc1530' }
                return { fill: 'rgba(230,80,100,0.28)',border: '#e05060' }
  }
}

function fvgColors(quality: string | undefined, fillPct: number | undefined) {

  const q = quality ?? 'B'
  const filled = fillPct ?? 0
  const dimFactor = 1 - (filled / 100) * 0.65
  const ops: Record<string, number> = { 'A+': 0.28, 'A': 0.20, 'B': 0.13, 'C': 0.07 }
  const op = (ops[q] ?? 0.13) * dimFactor
  return { fill: `rgba(255,140,0,${op.toFixed(3)})`, border: '#ff8c00' }
}

interface Props {
  onOHLC?: (c: CandleData) => void
  onReady?: () => void
  onCandleCloseTime?: (closeTs: number) => void
  chartId?: string
}

const KLineChartComponent = forwardRef<KLineChartHandle, Props>(
  ({ onOHLC, onReady, onCandleCloseTime, chartId = 'kline-container' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<any>(null)
    const candlesRef = useRef<CandleData[]>([])
    const onReadyRef = useRef(onReady)
    onReadyRef.current = onReady
    const onCandleCloseTimeRef = useRef(onCandleCloseTime)
    onCandleCloseTimeRef.current = onCandleCloseTime

    const lastMarkup = useRef<{
      entry_price?: number; tp_price?: number; sl_price?: number
      tp_pct?: number; sl_pct?: number; verdict?: string; supports?: number[]; resistances?: number[]
      analysisTs?: number
    } | null>(null)
    const zoneOpacity = useRef<Record<string, number>>({})
    const wsRef = useRef<WebSocket | null>(null)
    const currentSymRef = useRef<string>('BTCUSDT')
    const currentIntervalRef = useRef<string>('1h')

    function openWS(sym: string, interval: string) {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      const ws = new WebSocket(`wss://fstream.binance.com/ws/${sym.toLowerCase()}@kline_${interval}`)
      ws.onmessage = (e) => {
        if (!chartRef.current) return
        try {
          const k = JSON.parse(e.data).k
          if (!k) return
          const candle: CandleData = {
            timestamp: k.t, open: parseFloat(k.o), high: parseFloat(k.h),
            low: parseFloat(k.l), close: parseFloat(k.c), volume: parseFloat(k.v),
          }
          const arr = candlesRef.current
          if (arr.length && arr[arr.length - 1].timestamp === candle.timestamp) {
            arr[arr.length - 1] = candle
          } else if (candle.timestamp > (arr[arr.length - 1]?.timestamp ?? 0)) {
            arr.push(candle)
          }
          if (!chartRef.current) return
          chartRef.current.updateData(candle)
          if (onOHLC) onOHLC(candle)
          onCandleCloseTimeRef.current?.(k.T)
        } catch {  }
      }
      ws.onerror = () => ws.close()
      wsRef.current = ws
    }

    useEffect(() => {
      initChart()
      return () => {
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
        if (chartRef.current) {
          try { klinecharts.dispose(chartId) } catch {}
          chartRef.current = null
        }
      }
    }, [])

    function initChart() {
      if (chartRef.current || !containerRef.current) return
      try {
        chartRef.current = klinecharts.init(chartId, {
          styles: {
            grid: {
              horizontal: { color: '#1a1a1a', style: LineType.Dashed, dashedValue: [2, 2] },
              vertical:   { color: '#1a1a1a', style: LineType.Dashed, dashedValue: [2, 2] },
            },
            candle: {
              bar: {
                upColor: '#00e676', downColor: '#ff3d57', noChangeColor: '#888',
                upBorderColor: '#00e676', downBorderColor: '#ff3d57',
                upWickColor: '#00e676', downWickColor: '#ff3d57',
              },
              tooltip: { text: { size: 11, family: "'Geist Mono',monospace", color: '#555' } },
              priceMark: { last: { upColor: '#00e676', downColor: '#ff3d57', text: { size: 11, family: "'Geist Mono',monospace" } } },
            },
            xAxis: { axisLine: { color: '#222' }, tickLine: { color: '#222' }, tickText: { color: '#555', size: 11, family: "'Geist Mono',monospace" } },
            yAxis: { axisLine: { color: '#222' }, tickLine: { color: '#222' }, tickText: { color: '#555', size: 11, family: "'Geist Mono',monospace" } },
            crosshair: {
              horizontal: { line: { color: '#333', style: LineType.Dashed }, text: { color: '#888', backgroundColor: '#111', size: 11 } },
              vertical:   { line: { color: '#333', style: LineType.Dashed }, text: { color: '#888', backgroundColor: '#111', size: 11 } },
            },
          },
        })
        onReadyRef.current?.()
      } catch (e) { console.error('klinecharts init error:', e) }
    }

    useImperativeHandle(ref, () => ({
      async loadChart(pair: string, tf: string) {
        if (!chartRef.current) return
        const sym = pair.replace('/', '')
        const interval = TF_MAP[tf] || '1h'
        currentSymRef.current = sym
        currentIntervalRef.current = interval

        openWS(sym, interval)

        try {
          const TARGET = 10_000, BATCH = 1500
          const intervalMs = INTERVAL_MS[interval] || 3_600_000

          const firstRes = await fetch(
            `/api/klines?symbol=${sym}&interval=${interval}&limit=${BATCH}`
          )
          const firstBatch: number[][] = await firstRes.json()
          if (!Array.isArray(firstBatch) || firstBatch.length === 0) return

          let allRaw: number[][] = firstBatch

          if (firstBatch.length === BATCH) {
            const remaining = Math.ceil(TARGET / BATCH) - 1
            const oldestTs = firstBatch[0][0]

            const endTimes = Array.from({ length: remaining }, (_, i) =>
              oldestTs - i * BATCH * intervalMs - 1
            )

            const otherBatches = await Promise.all(
              endTimes.map(et =>
                fetch(
                  `/api/klines?symbol=${sym}&interval=${interval}&limit=${BATCH}&endTime=${et}`
                )
                  .then(r => r.json())
                  .catch(() => [] as number[][])
              )
            )

            const seen = new Set<number>()
            allRaw = [...otherBatches.flat(), ...firstBatch]
              .filter((c): c is number[] => {
                if (!Array.isArray(c) || seen.has(c[0])) return false
                seen.add(c[0])
                return true
              })
              .sort((a, b) => a[0] - b[0])
          }

          if (allRaw.length === 0) return
          candlesRef.current = allRaw.map(c => ({
            timestamp: c[0], open: parseFloat(String(c[1])), high: parseFloat(String(c[2])),
            low: parseFloat(String(c[3])), close: parseFloat(String(c[4])), volume: parseFloat(String(c[5])),
          }))
          if (!chartRef.current) return
          chartRef.current.applyNewData(candlesRef.current)
          try { chartRef.current.setBarSpace(4) } catch {}
          try { chartRef.current.scrollToRealTime() } catch {}
          const last = candlesRef.current[candlesRef.current.length - 1]
          if (last && onOHLC) onOHLC(last)
          if (lastMarkup.current) drawMarkupInternal(lastMarkup.current)
        } catch (e) { console.error('chart fetch error:', e) }
      },

      getCandles() {
        return candlesRef.current
      },

      getScreenshot() {
        if (!chartRef.current) return null
        try { return chartRef.current.getConvertPictureUrl(true, 'png', '#080808') } catch { return null }
      },

      getYForPrice(price: number): number | null {
        if (!chartRef.current || !containerRef.current) return null
        try {
          const r = chartRef.current.convertToPixel([{ value: price }], { paneId: 'candle_pane' }) as any[]
          if (typeof r?.[0]?.y !== 'number') return null
          return containerRef.current.getBoundingClientRect().top + r[0].y
        } catch { return null }
      },

      setDrawing(type: string) {
        if (!chartRef.current) return
        chartRef.current.createOverlay({
          name: type,
          onDrawEnd(event: any) {

            window.dispatchEvent(new CustomEvent('kotvuk:overlay:drawend', {
              detail: { id: event.overlay.id },
            }))
            return false
          },
          onDoubleClick(event: any) {
            window.dispatchEvent(new CustomEvent('kotvuk:overlay:dblclick', {
              detail: { id: event.overlay.id, name: event.overlay.name, extendData: event.overlay.extendData, styles: event.overlay.styles },
            }))
            return true
          },
          onRightClick(event: any) {
            window.dispatchEvent(new CustomEvent('kotvuk:overlay:rightclick', {
              detail: { id: event.overlay.id, name: event.overlay.name },
            }))
            return true
          },
        })
      },

      updateOverlay(id: string, updates: { extendData?: unknown; styles?: unknown }) {
        if (!chartRef.current) return
        const patch: any = { id }
        if (updates.extendData !== undefined) patch.extendData = updates.extendData
        if (updates.styles !== undefined) patch.styles = updates.styles
        chartRef.current.overrideOverlay(patch)
      },

      removeOverlayById(id: string) {
        if (chartRef.current) chartRef.current.removeOverlay({ id })
      },

      clearDrawings() {
        if (!chartRef.current) return
        chartRef.current.removeOverlay()
        if (lastMarkup.current) drawMarkupInternal(lastMarkup.current)
      },

      drawMarkup(a) {

        lastMarkup.current = { ...a, analysisTs: Date.now() }
        drawMarkupInternal(lastMarkup.current)
      },

      highlightOB(high: number, low: number, type: 'bullish' | 'bearish', label?: string) {
        if (!chartRef.current || !candlesRef.current.length) return
        const candles  = candlesRef.current
        const lastTs   = candles[candles.length - 1].timestamp
        const spanMs   = Math.max(INTERVAL_MS[currentIntervalRef.current] ?? 3_600_000, 3_600_000) * 30
        const fromTs   = lastTs - spanMs
        const pt = () => false as any

        chartRef.current.removeOverlay({ groupId: 'ai_selected_ob' })

        const fillColor   = type === 'bullish' ? 'rgba(0,230,118,0.22)' : 'rgba(255,61,87,0.22)'
        const borderColor = type === 'bullish' ? '#00e676' : '#ff3d57'
        const mid = (high + low) / 2

        chartRef.current.createOverlay({
          name: 'priceRect',
          groupId: 'ai_selected_ob',
          id: 'selected_ob',
          lock: true,
          onMouseDown: pt, onMouseMove: pt, onPressedMoveStart: pt, onPressedMoving: pt, onPressedMoveEnd: pt,
          points: [{ timestamp: fromTs, value: high }, { timestamp: lastTs, value: low }],
          styles: {
            polygon: { style: 'stroke_fill', color: fillColor, borderColor, borderSize: 2 },
          },
          extendData: label || (type === 'bullish' ? '↑ AI ENTRY ZONE' : '↓ AI ENTRY ZONE'),
        })

        chartRef.current.createOverlay({
          name: 'horizontalStraightLine',
          groupId: 'ai_selected_ob',
          id: 'selected_ob_mid',
          lock: true,
          onMouseDown: pt, onMouseMove: pt, onPressedMoveStart: pt, onPressedMoving: pt, onPressedMoveEnd: pt,
          points: [{ timestamp: fromTs, value: mid }],
          styles: { line: { color: borderColor, size: 1, style: 'dashed' } },
        })
      },

      updateMarkup(tp?: number, sl?: number, entry?: number) {
        if (!lastMarkup.current) lastMarkup.current = {}
        if (tp    !== undefined) lastMarkup.current.tp_price    = tp
        if (sl    !== undefined) lastMarkup.current.sl_price    = sl
        if (entry !== undefined) lastMarkup.current.entry_price = entry
        drawMarkupInternal(lastMarkup.current)
      },

      drawSMC(smc, settings) {
        if (!chartRef.current || !candlesRef.current.length) return
        const s: SMCDrawSettings = { ...DEFAULT_SMC_SETTINGS, ...settings }
        const candles    = candlesRef.current
        const lastTs     = candles[candles.length - 1].timestamp
        const currentPrice = candles[candles.length - 1].close
        const intervalMs = INTERVAL_MS[currentIntervalRef.current] || 3_600_000

        if (s.ob) {
          const passThrough = () => false as any  // не блокировать панинг графика

          ;(smc.orderBlocks || []).forEach((ob, i) => {
            if (ob.isMitigated) return

            if (ob.type === 'bullish' && currentPrice < ob.low) return
            if (ob.type === 'bearish' && currentPrice > ob.high) return
            const { fill, border } = obColors(ob.type, ob.strength)
            const bSize = ob.strength === 'strong' ? 2 : ob.strength === 'moderate' ? 1.5 : 1
            chartRef.current.createOverlay({
              name: 'priceRect', groupId: 'smc_ob', id: `ob_${i}`, lock: true,
              onMouseDown: passThrough,
              onMouseMove: passThrough,
              onPressedMoveStart: passThrough,
              onPressedMoving: passThrough,
              onPressedMoveEnd: passThrough,
              onRightClick: () => true as any,
              points: [{ timestamp: ob.timestamp, value: ob.high }, { timestamp: lastTs, value: ob.low }],
              styles: { polygon: { style: 'stroke_fill', color: fill, borderColor: border, borderSize: bSize } },
              extendData: `${ob.type === 'bullish' ? 'Bull' : 'Bear'} OB [${ob.quality || 'B'}]`,
            })
          })
        }

        const passThrough = () => false as any

        if (s.fvg) {
          ;(smc.fvgs || []).forEach((fvg, i) => {
            const { fill, border } = fvgColors(fvg.quality, fvg.fillPct)
            const mid = ((fvg.high ?? 0) + (fvg.low ?? 0)) / 2

            chartRef.current.createOverlay({
              name: 'priceRect', groupId: 'smc_fvg', id: `fvg_${i}`, lock: true,
              onMouseDown: passThrough, onMouseMove: passThrough,
              onPressedMoveStart: passThrough, onPressedMoving: passThrough, onPressedMoveEnd: passThrough,
              onRightClick: () => true as any,
              points: [{ timestamp: fvg.startTimestamp, value: fvg.high }, { timestamp: lastTs, value: fvg.low }],
              styles: { polygon: { style: 'stroke_fill', color: fill, borderColor: border, borderSize: 1 } },
              extendData: `FVG`,
            })

            chartRef.current.createOverlay({
              name: 'segment', groupId: 'smc_fvg', id: `fvg_mid_${i}`, lock: true,
              onMouseDown: passThrough, onMouseMove: passThrough,
              onPressedMoveStart: passThrough, onPressedMoving: passThrough, onPressedMoveEnd: passThrough,
              onRightClick: () => true as any,
              points: [{ timestamp: fvg.startTimestamp, value: mid }, { timestamp: lastTs, value: mid }],
              styles: { line: { color: border, size: 1, style: 'dashed' } },
            })
          })
        }

        if (s.liq) {
          ;(smc.liquidityLevels || []).forEach((liq, i) => {
            if (liq.isSwept) return
            const isBuy   = liq.type === 'buy'
            const color   = isBuy ? '#00e676' : '#ff3d57'
            const lSize   = liq.strength === 'strong' ? 2 : 1.5
            const startTs = liq.timestamp ?? candles[Math.max(0, candles.length - 30)].timestamp
            chartRef.current.createOverlay({
              name: 'segment',
              groupId: 'smc_liq', id: `liq_${i}`, lock: true,
              onMouseDown: passThrough, onMouseMove: passThrough,
              onPressedMoveStart: passThrough, onPressedMoving: passThrough, onPressedMoveEnd: passThrough,
              onRightClick: () => true as any,
              points: [
                { timestamp: startTs, value: liq.price },
                { timestamp: lastTs + intervalMs * 3, value: liq.price },
              ],
              styles: { line: { color, size: lSize, style: 'dashed' } },
              extendData: isBuy ? 'BSL' : 'SSL',
            })
          })
        }

        if (s.premDisc && candles.length >= 10) {
          const slice    = candles.slice(-100)
          const swingH   = Math.max(...slice.map(c => c.high))
          const swingL   = Math.min(...slice.map(c => c.low))
          const range    = swingH - swingL
          if (range > 0) {
            const eq       = swingL + range * 0.5
            const premBot  = swingL + range * 0.75
            const discTop  = swingL + range * 0.25
            const spanEnd  = lastTs + 10 * intervalMs
            const spanStart = candles[Math.max(0, candles.length - 120)].timestamp

            chartRef.current.createOverlay({
              name: 'priceRect', groupId: 'smc_pd', id: 'pd_prem', lock: true,
              onMouseDown: passThrough, onMouseMove: passThrough,
              onPressedMoveStart: passThrough, onPressedMoving: passThrough, onPressedMoveEnd: passThrough,
              points: [{ timestamp: spanStart, value: swingH }, { timestamp: spanEnd, value: premBot }],
              styles: { polygon: { color: 'rgba(255,61,87,0.04)', borderColor: 'rgba(255,61,87,0.20)', borderSize: 0.5 } },
              extendData: 'Premium',
            })
            chartRef.current.createOverlay({
              name: 'priceRect', groupId: 'smc_pd', id: 'pd_disc', lock: true,
              onMouseDown: passThrough, onMouseMove: passThrough,
              onPressedMoveStart: passThrough, onPressedMoving: passThrough, onPressedMoveEnd: passThrough,
              points: [{ timestamp: spanStart, value: discTop }, { timestamp: spanEnd, value: swingL }],
              styles: { polygon: { color: 'rgba(0,230,118,0.04)', borderColor: 'rgba(0,230,118,0.20)', borderSize: 0.5 } },
              extendData: 'Discount',
            })

            chartRef.current.createOverlay({
              name: 'segment', groupId: 'smc_pd', id: 'pd_eq', lock: true,
              onMouseDown: passThrough, onMouseMove: passThrough,
              onPressedMoveStart: passThrough, onPressedMoving: passThrough, onPressedMoveEnd: passThrough,
              points: [{ timestamp: spanStart, value: eq }, { timestamp: spanEnd, value: eq }],
              styles: { line: { color: 'rgba(255,255,255,0.20)', size: 1, style: 'dashed' } },
              extendData: 'EQ 50%',
            })
          }
        }

      },

      clearSMC() {
        if (!chartRef.current) return
        chartRef.current.removeOverlay({ groupId: 'smc_ob' })
        chartRef.current.removeOverlay({ groupId: 'smc_fvg' })
        chartRef.current.removeOverlay({ groupId: 'smc_liq' })
        chartRef.current.removeOverlay({ groupId: 'smc_pd' })
      },

      drawTrendlines() {
        if (!chartRef.current || !candlesRef.current.length) return
        const intervalMs = INTERVAL_MS[currentIntervalRef.current] || 3_600_000
        drawTrendlinesInternal(candlesRef.current, intervalMs)
      },

      clearTrendlines() {
        if (!chartRef.current) return
        chartRef.current.removeOverlay({ groupId: 'smc_trendlines' })
      },

      drawZone(priceFrom, priceTo, color, label, groupId) {
        if (!chartRef.current || !candlesRef.current.length) return
        if (!priceFrom || !priceTo || priceFrom === priceTo) return
        const candles = candlesRef.current
        const firstTs = candles[Math.max(0, candles.length - 100)].timestamp
        const lastTs  = candles[candles.length - 1].timestamp
        const hi = Math.max(priceFrom, priceTo), lo = Math.min(priceFrom, priceTo)
        const fill = color.startsWith('#') ? color + '66' : color
        chartRef.current.createOverlay({
          name: 'priceRect', groupId, lock: true,
          points: [{ timestamp: firstTs, value: hi }, { timestamp: lastTs, value: lo }],
          styles: { polygon: { color: fill, borderColor: color, borderSize: 2 } },
          extendData: label,
        })
      },

      setZoneOpacity(groupId, opacity) {
        zoneOpacity.current[groupId] = opacity
        if (chartRef.current) {
          chartRef.current.overrideOverlay({
            groupId, styles: { polygon: { color: `rgba(255,255,255,${opacity * 0.5})` } },
          })
        }
      },

      updateSidebarMarket(cb) {
        const last = candlesRef.current[candlesRef.current.length - 1]
        if (last) cb(last)
      },

      getUserDrawings() {
        if (!chartRef.current) return []
        try {
          const allOverlays: any[] = chartRef.current.getOverlaysByPaneId?.('candle_pane') ?? []
          const systemGroups = new Set(['ai', 'smc_ob', 'smc_fvg', 'smc_liq', 'smc_bb', 'smc_bos', 'smc_tl'])
          return allOverlays
            .filter((o: { groupId?: string }) => !systemGroups.has(o.groupId ?? ''))
            .map((o: { name: string; points: unknown[]; extendData: unknown; styles: unknown }) => ({
              name: o.name, points: o.points, extendData: o.extendData, styles: o.styles,
            }))
        } catch { return [] }
      },

      restoreUserDrawings(drawings) {
        if (!chartRef.current || !drawings.length) return
        for (const d of drawings as { name: string; points: unknown[]; extendData?: unknown; styles?: unknown }[]) {
          try {
            chartRef.current.createOverlay({
              name: d.name, points: d.points as { timestamp: number; value: number }[],
              extendData: d.extendData, styles: d.styles,
            })
          } catch { /* skip invalid overlay */ }
        }
      },
    }))

    function drawTrendlinesInternal(candles: CandleData[], intervalMs: number) {
      if (!chartRef.current) return
      chartRef.current.removeOverlay({ groupId: 'smc_trendlines' })
      const lines = calcTrendlines(candles, intervalMs)
      lines.forEach((tl, i) => {
        const isRes   = tl.type === 'resistance'
        const color   = tl.isBroken ? 'rgba(140,140,140,0.45)' : (isRes ? '#e05c5c' : '#00d4a8')
        const lSize   = tl.strength === 'strong' ? 2 : 1.5
        const lStyle  = tl.isBroken ? 'dashed' : 'solid'
        chartRef.current.createOverlay({
          name: 'segment', groupId: 'smc_trendlines',
          id: `tl_${tl.type}_${i}`, lock: true,
          points: [
            { timestamp: tl.p1.timestamp, value: tl.p1.value },
            { timestamp: tl.end.timestamp, value: tl.end.value },
          ],
          styles: { line: { color, size: lSize, style: lStyle } },
          extendData: tl.isBroken ? '' : (isRes ? 'R' : 'S'),
        })
      })
    }

    function findSROrigin(price: number, type: 'support' | 'resistance'): number {
      const candles = candlesRef.current
      if (candles.length < 2) return candles[0]?.timestamp || 0
      const recent = candles.slice(-400)
      let bestIdx = Math.max(0, recent.length - 60), bestDiff = Infinity
      for (let i = 0; i < recent.length - 3; i++) {
        const pivot = type === 'support' ? recent[i].low : recent[i].high
        const diff  = Math.abs(pivot - price) / price
        if (diff < 0.003 && diff < bestDiff) { bestDiff = diff; bestIdx = i }
      }
      return recent[bestIdx].timestamp
    }

    function drawMarkupInternal(a: typeof lastMarkup.current) {
      if (!chartRef.current || !candlesRef.current.length || !a) return
      chartRef.current.removeOverlay({ groupId: 'ai' })
      const candles    = candlesRef.current
      const ts         = candles[candles.length - 1].timestamp
      const intervalMs = INTERVAL_MS[currentIntervalRef.current] || 3_600_000

      const rightTs    = ts + 30 * intervalMs

      const entry   = a.entry_price
      const verdict = a.verdict ?? 'LONG'
      const isLong  = verdict !== 'SHORT'

      let tp = a.tp_price
      let sl = a.sl_price
      if (tp && sl && entry) {

        if (isLong  && tp < entry && sl > entry) { [tp, sl] = [sl, tp] }
        if (!isLong && tp > entry && sl < entry) { [tp, sl] = [sl, tp] }

        const slDist = Math.abs(tp && sl ? Math.abs(tp - entry) / 1.5 : entry * 0.01)
        if (isLong) {
          if (tp <= entry) tp = entry + slDist * 1.5
          if (sl >= entry) sl = entry - slDist
        } else {
          if (tp >= entry) tp = entry - slDist * 1.5
          if (sl <= entry) sl = entry + slDist
        }
      }

      const tpPct = (tp && entry)
        ? Math.abs((tp - entry) / entry * 100).toFixed(2)
        : (a.tp_pct?.toFixed(2) ?? '?')
      const slPct = (sl && entry)
        ? Math.abs((sl - entry) / entry * 100).toFixed(2)
        : (a.sl_pct?.toFixed(2) ?? '?')
      const rrNum = (tp && sl && entry && Math.abs(sl - entry) > 0)
        ? (Math.abs(tp - entry) / Math.abs(sl - entry)).toFixed(1)
        : '?'

      if (tp && sl && entry) {

        const anchorTs = (() => {
          const analysisTime = a.analysisTs ?? ts
          const c = candlesRef.current

          for (let i = c.length - 1; i >= 0; i--) {
            if (c[i].timestamp <= analysisTime) return c[i].timestamp
          }
          return c[0]?.timestamp ?? ts
        })()

        chartRef.current.createOverlay({
          name: 'aiPositionZone', groupId: 'ai', id: 'ai_tp_zone', lock: true,
          points: [{ timestamp: anchorTs, value: entry }],
          extendData: { p1: entry, p2: tp, fillColor: 'rgba(0,230,118,0.12)', strokeColor: 'rgba(0,230,118,0.5)' },
        })

        chartRef.current.createOverlay({
          name: 'aiPositionZone', groupId: 'ai', id: 'ai_sl_zone', lock: true,
          points: [{ timestamp: anchorTs, value: entry }],
          extendData: { p1: entry, p2: sl, fillColor: 'rgba(255,61,87,0.12)', strokeColor: 'rgba(255,61,87,0.5)' },
        })
      }

      const mkLine = (val: number | undefined, color: string, label: string) => {
        if (!val) return
        chartRef.current.createOverlay({
          name: 'aiPriceLine', groupId: 'ai', lock: true,
          points: [{ timestamp: ts, value: val }],
          styles: { line: { color, size: 1, style: 'solid' } },
          extendData: label,
        })
      }

      mkLine(entry, '#f0a500', `◆ ENTRY`)
      mkLine(tp,    '#00e676', `▲ TP  +${tpPct}%   R:R 1:${rrNum}`)
      mkLine(sl,    '#ff3d57', `▼ SL  -${slPct}%`)

      const mkSR = (val: number, color: string, type: 'support' | 'resistance', idx: number) => {
        const originTs = findSROrigin(val, type)
        chartRef.current.createOverlay({
          name: 'segment', groupId: 'ai', id: `ai_${type[0]}_${idx}`, lock: true,
          points: [{ timestamp: originTs, value: val }, { timestamp: rightTs, value: val }],
          styles: { line: { color, size: 1, style: 'dashed' } },
        })
      }
      ;(a.supports    || []).forEach((s, i) => mkSR(s, '#00e676', 'support',    i))
      ;(a.resistances || []).forEach((r, i) => mkSR(r, '#ff3d57', 'resistance', i))
    }

    return (
      <div
        id={chartId}
        ref={containerRef}
        style={{ width: '100%', height: '340px', display: 'block' }}
      />
    )
  }
)
KLineChartComponent.displayName = 'KLineChartComponent'
export default KLineChartComponent
