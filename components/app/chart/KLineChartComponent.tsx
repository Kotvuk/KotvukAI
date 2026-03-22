'use client'
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as klinecharts from 'klinecharts'
import { LineType } from 'klinecharts'

// Register custom polyline overlay (Траектория — up to 10 connected segments)
klinecharts.registerOverlay({
  name: 'polyline',
  totalStep: 11, // 10 user points + 1 for preview
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export interface KLineChartHandle {
  loadChart: (pair: string, tf: string) => Promise<void>
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
  drawSMC: (smc: { orderBlocks?: OBData[]; breakerBlocks?: BreakerData[]; fvgs?: FVGData[]; liquidityLevels?: LiqData[] }) => void
  clearSMC: () => void
  drawZone: (priceFrom: number, priceTo: number, color: string, label: string, groupId: string) => void
  setZoneOpacity: (groupId: string, opacity: number) => void
  updateSidebarMarket: (cb: (data: CandleData) => void) => void
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
  type: 'buy' | 'sell'; price: number
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

interface Props {
  onOHLC?: (c: CandleData) => void
  onReady?: () => void
  onCandleCloseTime?: (closeTs: number) => void
}

const KLineChartComponent = forwardRef<KLineChartHandle, Props>(
  ({ onOHLC, onReady, onCandleCloseTime }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartRef = useRef<any>(null)
    const candlesRef = useRef<CandleData[]>([])
    const onReadyRef = useRef(onReady)
    onReadyRef.current = onReady
    const onCandleCloseTimeRef = useRef(onCandleCloseTime)
    onCandleCloseTimeRef.current = onCandleCloseTime

    const lastMarkup = useRef<{
      entry_price?: number; tp_price?: number; sl_price?: number
      tp_pct?: number; sl_pct?: number; verdict?: string; supports?: number[]; resistances?: number[]
    } | null>(null)
    const zoneOpacity = useRef<Record<string, number>>({})
    const wsRef = useRef<WebSocket | null>(null)
    const currentSymRef = useRef<string>('BTCUSDT')
    const currentIntervalRef = useRef<string>('1h')

    function openWS(sym: string, interval: string) {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      const streamSym = sym.toLowerCase()
      const ws = new WebSocket(`wss://fstream.binance.com/ws/${streamSym}@kline_${interval}`)
      ws.onmessage = (e) => {
        if (!chartRef.current) return
        try {
          const msg = JSON.parse(e.data)
          const k = msg.k
          if (!k) return
          const candle: CandleData = {
            timestamp: k.t,
            open:   parseFloat(k.o),
            high:   parseFloat(k.h),
            low:    parseFloat(k.l),
            close:  parseFloat(k.c),
            volume: parseFloat(k.v),
          }
          // Update last candle in local ref
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
        } catch { /* silent */ }
      }
      ws.onerror = () => ws.close()
      wsRef.current = ws
    }

    useEffect(() => {
      initChart()
      return () => {
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
        if (chartRef.current) {
          try { klinecharts.dispose('kline-container') } catch {}
          chartRef.current = null
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function initChart() {
      if (chartRef.current || !containerRef.current) return
      try {
        chartRef.current = klinecharts.init('kline-container', {
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
        chartRef.current.createIndicator('VOL', false, { id: 'vol_pane' })
        // Enforce minimum bar space of 3px so candles stay visible when zooming out
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(chartRef.current as any).subscribeAction?.('onZoom', () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const space = (chartRef.current as any).getBarSpace?.()
            if (typeof space === 'number' && space < 3) {
              chartRef.current?.setBarSpace(3)
            }
          } catch {}
        })
        onReadyRef.current?.()
      } catch (e) {
        console.error('klinecharts init error:', e)
      }
    }

    useImperativeHandle(ref, () => ({
      async loadChart(pair: string, tf: string) {
        if (!chartRef.current) return
        const sym = pair.replace('/', '')
        const interval = TF_MAP[tf] || '1h'
        currentSymRef.current = sym
        currentIntervalRef.current = interval

        // Close previous WebSocket before opening new one (handled inside openWS)

        try {
          // Fetch up to 5 000 candles via pagination (1500 per request)
          const TARGET = 5_000
          const BATCH  = 1500
          const allRaw: number[][] = []
          let endTime: number | null = null

          for (let page = 0; page < Math.ceil(TARGET / BATCH); page++) {
            const qs = endTime
              ? `/api/klines?symbol=${sym}&interval=${interval}&limit=${BATCH}&endTime=${endTime}`
              : `/api/klines?symbol=${sym}&interval=${interval}&limit=${BATCH}`
            const r = await fetch(qs)
            const batch: number[][] = await r.json()
            if (!Array.isArray(batch) || batch.length === 0) break
            allRaw.unshift(...batch)          // prepend older data
            endTime = batch[0][0] - 1         // go further back
            if (batch.length < BATCH) break   // no more history
          }

          if (allRaw.length === 0) return
          candlesRef.current = allRaw.map(c => ({
            timestamp: c[0], open: parseFloat(String(c[1])), high: parseFloat(String(c[2])),
            low: parseFloat(String(c[3])), close: parseFloat(String(c[4])), volume: parseFloat(String(c[5])),
          }))
          if (!chartRef.current) return  // unmounted during fetch
          chartRef.current.applyNewData(candlesRef.current)
          // Narrow bars to show more candles, then scroll to latest
          try { chartRef.current.setBarSpace(4) } catch {}
          try { chartRef.current.scrollToRealTime() } catch {}
          const last = candlesRef.current[candlesRef.current.length - 1]
          if (last && onOHLC) onOHLC(last)
          if (lastMarkup.current) drawMarkupInternal(lastMarkup.current)
        } catch (e) { console.error('chart fetch error:', e) }

        // Real-time updates via Binance WebSocket
        openWS(sym, interval)
      },

      getScreenshot() {
        if (!chartRef.current) return null
        try { return chartRef.current.getConvertPictureUrl(true, 'png', '#080808') } catch { return null }
      },

      getYForPrice(price: number): number | null {
        if (!chartRef.current || !containerRef.current) return null
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = chartRef.current.convertToPixel([{ value: price }], { paneId: 'candle_pane' }) as any[]
          if (typeof r?.[0]?.y !== 'number') return null
          // Return viewport Y so caller can use position:fixed
          const containerTop = containerRef.current.getBoundingClientRect().top
          return containerTop + r[0].y
        } catch { return null }
      },

      setDrawing(type: string) {
        if (!chartRef.current) return
        chartRef.current.createOverlay({
          name: type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onDoubleClick(event: any) {
            window.dispatchEvent(new CustomEvent('kotvuk:overlay:dblclick', {
              detail: {
                id: event.overlay.id,
                name: event.overlay.name,
                extendData: event.overlay.extendData,
                styles: event.overlay.styles,
              }
            }))
            return true
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onRightClick(event: any) {
            window.dispatchEvent(new CustomEvent('kotvuk:overlay:rightclick', {
              detail: { id: event.overlay.id, name: event.overlay.name }
            }))
            return true
          },
        })
      },

      updateOverlay(id: string, updates: { extendData?: unknown; styles?: unknown }) {
        if (!chartRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        lastMarkup.current = a
        drawMarkupInternal(a)
      },

      updateMarkup(tp?: number, sl?: number, entry?: number) {
        if (!lastMarkup.current) lastMarkup.current = {}
        if (tp !== undefined) lastMarkup.current.tp_price = tp
        if (sl !== undefined) lastMarkup.current.sl_price = sl
        if (entry !== undefined) lastMarkup.current.entry_price = entry
        drawMarkupInternal(lastMarkup.current)
      },

      drawSMC(smc) {
        if (!chartRef.current || !candlesRef.current.length) return
        const candles = candlesRef.current
        const lastTs  = candles[candles.length - 1].timestamp

        // ── OBs: color intensity based on strength + quality ──────────────
        ;(smc.orderBlocks || []).forEach((ob, i) => {
          const isBull = ob.type === 'bullish'
          // Opacity: A+=0.45, A=0.35, B=0.25, C=0.18 — LuxAlgo-style prominence
          const qOpacity = ob.quality === 'A+' ? 0.45 : ob.quality === 'A' ? 0.35 : ob.quality === 'B' ? 0.25 : 0.18
          // Border size: strong=2, moderate=1.5, weak=1
          const borderSize = ob.strength === 'strong' ? 2 : ob.strength === 'moderate' ? 2 : 1
          const baseColor = isBull ? '0,230,118' : '255,61,87'
          const color  = `rgba(${baseColor},${qOpacity})`
          const border = isBull ? '#00e676' : '#ff3d57'
          // Mitigated OBs shown dimmer
          const finalColor  = ob.isMitigated ? `rgba(${baseColor},${qOpacity * 0.35})` : color
          const finalBorder = ob.isMitigated ? (isBull ? '#00e67650' : '#ff3d5750') : border
          const label = `${isBull ? 'Bull' : 'Bear'} OB [${ob.quality || 'B'}]`
          chartRef.current.createOverlay({
            name: 'rect', groupId: 'smc_ob',
            id: `ob_${i}`,
            lock: true,
            points: [
              { timestamp: ob.timestamp, value: ob.high },
              { timestamp: lastTs, value: ob.low },
            ],
            styles: { polygon: { color: finalColor, borderColor: finalBorder, borderSize } },
            extendData: label,
          })
        })

        // ── Breaker Blocks: distinctive magenta/purple color ──────────────
        ;(smc.breakerBlocks || []).forEach((bb, i) => {
          const isBull = bb.type === 'bullish'
          const color  = isBull ? 'rgba(130,100,255,0.20)' : 'rgba(255,80,200,0.20)'
          const border = isBull ? '#8264ff' : '#ff50c8'
          const bSize  = bb.strength === 'strong' ? 2 : 1
          chartRef.current.createOverlay({
            name: 'rect', groupId: 'smc_ob',
            id: `bb_${i}`,
            lock: true,
            points: [
              { timestamp: bb.timestamp, value: bb.high },
              { timestamp: lastTs,        value: bb.low },
            ],
            styles: { polygon: { color, borderColor: border, borderSize: bSize } },
            extendData: `${isBull ? 'Bull' : 'Bear'} BB`,
          })
        })

        // ── FVGs: quality drives opacity, filled ones dimmer ──────────────
        ;(smc.fvgs || []).forEach((fvg, i) => {
          const isBull = fvg.type === 'bullish'
          const qOp  = fvg.quality === 'A+' ? 0.22 : fvg.quality === 'A' ? 0.16 : 0.10
          // If partially/mostly filled, dim further
          const fillFactor = fvg.fillPct != null ? 1 - (fvg.fillPct / 100) * 0.7 : 1
          const opacity = qOp * fillFactor
          const color  = isBull ? `rgba(0,200,255,${opacity})` : `rgba(255,160,0,${opacity})`
          const border = isBull ? '#00c8ff' : '#f0a500'
          const bSize  = fvg.quality === 'A+' ? 1 : 1
          const fillLabel = fvg.fillPct != null && fvg.fillPct > 0 ? ` ${Math.round(fvg.fillPct)}%` : ''
          chartRef.current.createOverlay({
            name: 'rect', groupId: 'smc_fvg',
            id: `fvg_${i}`,
            lock: true,
            points: [
              { timestamp: fvg.startTimestamp, value: fvg.high },
              { timestamp: fvg.endTimestamp,   value: fvg.low },
            ],
            styles: { polygon: { color, borderColor: border, borderSize: bSize } },
            extendData: `FVG[${fvg.quality || 'B'}]${fillLabel}`,
          })
        })

        // ── Liquidity levels: strength drives opacity + line size ─────────
        ;(smc.liquidityLevels || []).forEach((liq, i) => {
          const isSell = liq.type === 'sell'
          const opacity = liq.strength === 'strong' ? 0.9 : liq.strength === 'moderate' ? 0.65 : 0.45
          const color   = isSell ? `rgba(255,61,87,${opacity})` : `rgba(0,230,118,${opacity})`
          const liqSize = liq.strength === 'strong' ? 2 : 1
          // Swept levels shown dashed, unswept dotted
          const lineStyle = liq.isSwept ? 'dashed' : 'dotted'
          const label = (isSell ? 'SSL' : 'BSL') + (liq.isSwept ? ' ✓' : '')
          chartRef.current.createOverlay({
            name: 'priceLine', groupId: 'smc_liq',
            id: `liq_${i}`,
            lock: true,
            points: [{ timestamp: lastTs, value: liq.price }],
            styles: { line: { color, size: liqSize, style: lineStyle }, text: { color } },
            extendData: label,
          })
        })
      },

      clearSMC() {
        if (!chartRef.current) return
        chartRef.current.removeOverlay({ groupId: 'smc_ob' })
        chartRef.current.removeOverlay({ groupId: 'smc_fvg' })
        chartRef.current.removeOverlay({ groupId: 'smc_liq' })
      },

      drawZone(priceFrom, priceTo, color, label, groupId) {
        if (!chartRef.current || !candlesRef.current.length) return
        if (!priceFrom || !priceTo || priceFrom === priceTo) return
        const candles = candlesRef.current
        // Start from ~100 candles back to give zones visual width
        const firstTs = candles[Math.max(0, candles.length - 100)].timestamp
        const lastTs  = candles[candles.length - 1].timestamp
        const hi = Math.max(priceFrom, priceTo)
        const lo = Math.min(priceFrom, priceTo)
        // Use strong fill (40% opacity) + 2px border — LuxAlgo style
        const fill = color.startsWith('#') ? color + '66' : color
        chartRef.current.createOverlay({
          name: 'rect', groupId,
          lock: true,
          points: [
            { timestamp: firstTs, value: hi },
            { timestamp: lastTs,  value: lo },
          ],
          styles: { polygon: { color: fill, borderColor: color, borderSize: 2 } },
          extendData: label,
        })
      },

      setZoneOpacity(groupId, opacity) {
        zoneOpacity.current[groupId] = opacity
        // Re-draw is needed; for now store and reapply on next draw cycle
        if (chartRef.current) {
          chartRef.current.overrideOverlay({
            groupId,
            styles: { polygon: { color: `rgba(255,255,255,${opacity * 0.5})` } },
          })
        }
      },

      updateSidebarMarket(cb) {
        const last = candlesRef.current[candlesRef.current.length - 1]
        if (last) cb(last)
      },
    }))

    // Find the candle that formed a support (by low) or resistance (by high)
    function findSROrigin(price: number, type: 'support' | 'resistance'): number {
      const candles = candlesRef.current
      if (candles.length < 2) return candles[0]?.timestamp || 0
      const recent = candles.slice(-400)
      let bestIdx = Math.max(0, recent.length - 60)
      let bestDiff = Infinity
      for (let i = 0; i < recent.length - 3; i++) {
        const c = recent[i]
        const pivot = type === 'support' ? c.low : c.high
        const diff = Math.abs(pivot - price) / price
        if (diff < 0.003 && diff < bestDiff) {
          bestDiff = diff
          bestIdx = i
        }
      }
      return recent[bestIdx].timestamp
    }

    function drawMarkupInternal(a: typeof lastMarkup.current) {
      if (!chartRef.current || !candlesRef.current.length || !a) return
      chartRef.current.removeOverlay({ groupId: 'ai' })
      const ts = candlesRef.current[candlesRef.current.length - 1].timestamp
      const intervalMs = INTERVAL_MS[currentIntervalRef.current] || 3_600_000
      const rightTs = ts + 2 * intervalMs

      // TP/SL/Entry — full-width priceLine with badge label on Y-axis
      const mkLine = (val: number | undefined, color: string, label: string) => {
        if (!val) return
        chartRef.current.createOverlay({
          name: 'priceLine', groupId: 'ai',
          lock: true,
          points: [{ timestamp: ts, value: val }],
          styles: {
            line: { color, size: 1, style: 'dashed' },
            text: {
              color: '#fff', size: 10,
              family: "'Geist Mono', monospace",
              backgroundColor: color,
              borderRadius: 2,
              paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2,
              offset: [0, 0],
            },
          },
          extendData: label,
        })
      }

      // S/R — segment starting from the candle that formed the level
      const mkSR = (val: number, color: string, type: 'support' | 'resistance', idx: number) => {
        const originTs = findSROrigin(val, type)
        chartRef.current.createOverlay({
          name: 'segment', groupId: 'ai',
          id: `ai_${type[0]}_${idx}`,
          lock: true,
          points: [
            { timestamp: originTs, value: val },
            { timestamp: rightTs,  value: val },
          ],
          styles: { line: { color, size: 1, style: 'dashed' } },
        })
      }

      // Ensure TP/SL are on correct sides of entry
      let tp = a.tp_price
      let sl = a.sl_price
      const isLong = a.verdict !== 'SHORT'
      if (tp && sl && a.entry_price) {
        if (isLong && tp < a.entry_price && sl > a.entry_price) { [tp, sl] = [sl, tp] }
        if (!isLong && tp > a.entry_price && sl < a.entry_price) { [tp, sl] = [sl, tp] }
      }

      mkLine(a.entry_price, '#f0a500', `Entry`)
      mkLine(tp,            '#00e676', `TP +${a.tp_pct || '?'}%`)
      mkLine(sl,            '#ff3d57', `SL -${a.sl_pct || '?'}%`)
      ;(a.supports    || []).forEach((s, i) => mkSR(s, '#00e676', 'support',    i))
      ;(a.resistances || []).forEach((r, i) => mkSR(r, '#ff3d57', 'resistance', i))
    }

    return (
      <div
        id="kline-container"
        ref={containerRef}
        style={{ width: '100%', height: '340px', display: 'block' }}
      />
    )
  }
)
KLineChartComponent.displayName = 'KLineChartComponent'
export default KLineChartComponent
