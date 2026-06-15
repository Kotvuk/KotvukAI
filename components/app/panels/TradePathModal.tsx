'use client'
import { useEffect, useRef, useState } from 'react'
import * as klinecharts from 'klinecharts'
import { LineType } from 'klinecharts'
import { useLang } from '@/contexts/LangContext'
import { fmtLocal } from '@/lib/fmt'

interface Trade {
  id: number; pair: string; direction: string; order_type: string
  amount: number; entry_price: number | null; tp_price: number | null
  sl_price: number | null; leverage: number; status: string
  account_type: string; limit_price: number | null; expires_at: string | null
  pnl: number | null; pnl_pct: number | null; exit_price: number | null
  closed_at: string | null; created_at: string
}

interface Props {
  trade: Trade
  onClose: () => void
}

function pickInterval(durationMs: number): string {
  const min = 60_000
  if (durationMs <= 30 * min) return '1m'
  if (durationMs <= 4 * 60 * min) return '5m'
  if (durationMs <= 24 * 60 * min) return '15m'
  if (durationMs <= 3 * 24 * 60 * min) return '1h'
  return '4h'
}

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000,
}

try {
  klinecharts.registerOverlay({
    name: 'tradeEntryLine',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, bounding, overlay }: any) => {
      if (!coordinates[0]) return []
      const y = coordinates[0].y
      const lineStyle = overlay.styles?.line ?? {}
      const color = lineStyle.color ?? '#f0a500'
      const label = typeof overlay.extendData === 'string' ? overlay.extendData : ''
      const figures: any[] = [
        {
          type: 'line',
          attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] },
          styles: { color, size: lineStyle.size ?? 1, style: lineStyle.style ?? 'dashed', dashedValue: [4, 4] },
        },
      ]
      if (label) {
        figures.push({
          type: 'text',
          ignoreEvent: true,
          attrs: { x: bounding.width - 4, y: y - 2, text: label, align: 'right', baseline: 'bottom' },
          styles: {
            color: '#fff', size: 11, family: "'Geist Mono', monospace",
            backgroundColor: color, borderRadius: 3,
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          },
        })
      }
      return figures
    },
  })
} catch {}

try {
  klinecharts.registerOverlay({
    name: 'tradeExitMarker',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }: any) => {
      if (!coordinates[0]) return []
      const color = (overlay.extendData as string) || '#fff'
      return [{
        type: 'circle',
        attrs: { x: coordinates[0].x, y: coordinates[0].y, r: 5 },
        styles: { style: 'stroke_fill', color, borderColor: '#fff', borderSize: 2 },
      }]
    },
  })
} catch {}

export default function TradePathModal({ trade, onClose }: Props) {
  const { t } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const chartId = useRef(`trade-path-${trade.id}`).current
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let disposed = false

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

    ;(async () => {
      try {
        const sym = trade.pair.replace('/', '')
        const created = new Date(trade.created_at).getTime()
        const closed = trade.closed_at ? new Date(trade.closed_at).getTime() : Date.now()
        const durationMs = Math.max(closed - created, 60_000)
        const interval = pickInterval(durationMs)
        const candleMs = INTERVAL_MS[interval]

        const candlesNeeded = Math.ceil(durationMs / candleMs) + 15
        const limit = Math.min(Math.max(candlesNeeded, 20), 1500)
        const endTime = closed + 5 * candleMs

        const r = await fetch(`/api/klines?symbol=${sym}&interval=${interval}&limit=${limit}&endTime=${endTime}`)
        const data: number[][] = await r.json()
        if (disposed || !chartRef.current) return
        if (!Array.isArray(data) || !data.length) { setError(true); setLoading(false); return }

        const candles = data.map(c => ({
          timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
        }))
        chartRef.current.applyNewData(candles)
        chartRef.current.setStyles({ yAxis: { type: 'normal' } })

        const entry = trade.entry_price ? Number(trade.entry_price) : null
        const exit = trade.exit_price ? Number(trade.exit_price) : null
        const isLong = trade.direction === 'long'
        const arrow = isLong ? '▲' : '▼'
        const color = isLong ? '#00e676' : '#ff3d57'
        const amount = Number(trade.amount).toFixed(2)

        if (entry) {
          chartRef.current.createOverlay({
            name: 'tradeEntryLine', lock: true,
            points: [{ timestamp: candles[0].timestamp, value: entry }],
            styles: { line: { color: '#f0a500', size: 1, style: 'dashed' } },
            extendData: `${arrow} $${amount}`,
          })
        }

        if (exit) {
          let exitTs = candles[candles.length - 1].timestamp
          for (let i = candles.length - 1; i >= 0; i--) {
            if (candles[i].timestamp <= closed) { exitTs = candles[i].timestamp; break }
          }
          chartRef.current.createOverlay({
            name: 'tradeExitMarker', lock: true,
            points: [{ timestamp: exitTs, value: exit }],
            extendData: color,
          })
        }

        chartRef.current.scrollToRealTime()
        setLoading(false)
      } catch {
        if (!disposed) { setError(true); setLoading(false) }
      }
    })()

    return () => {
      disposed = true
      try { klinecharts.dispose(chartId) } catch {}
      chartRef.current = null
    }
  }, [trade, chartId])

  const pnl = Number(trade.pnl) || 0
  const pnlPct = Number(trade.pnl_pct) || 0
  const isWin = pnl >= 0
  const period = `${fmtLocal(trade.created_at)} → ${trade.closed_at ? fmtLocal(trade.closed_at) : '—'}`

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 6, width: 640, maxWidth: '95vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 700 }}>{trade.pair}</span>
            <span className={`tag tag-${trade.direction}`}>{trade.direction.toUpperCase()}</span>
            {(trade.pnl !== null || trade.pnl_pct !== null) && (
              <span className={isWin ? 'pnl-p' : 'pnl-n'} style={{ fontSize: '.7rem', fontWeight: 700 }}>
                {isWin ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                {trade.pnl_pct !== null && <span style={{ opacity: .7, fontSize: '.85em' }}> ({pnlPct > 0 ? '+' : ''}{pnlPct}%)</span>}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ fontSize: '.6rem', color: 'var(--dim)', padding: '8px 16px', borderBottom: '1px solid var(--line2)' }}>
          {period}
        </div>

        <div style={{ position: 'relative', height: 380 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <div className="ld-bar" style={{ width: 120 }} />
            </div>
          )}
          {error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', fontSize: '.65rem' }}>
              {t('error')}
            </div>
          )}
          <div id={chartId} ref={containerRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>
    </div>
  )
}
