export interface TrendlineData {
  type: 'resistance' | 'support'
  p1: { timestamp: number; value: number }
  p2: { timestamp: number; value: number }
  end: { timestamp: number; value: number }
  isBroken: boolean
  breakAt?: { timestamp: number; value: number }
  touchCount: number
  strength: 'strong' | 'moderate' | 'weak'
}

interface Candle {
  timestamp: number; high: number; low: number; close: number
}

const N = 3

function findPivotHighs(candles: Candle[]): Array<{ idx: number; ts: number; price: number }> {
  const out: Array<{ idx: number; ts: number; price: number }> = []
  for (let i = N; i < candles.length - N; i++) {
    const h = candles[i].high
    let ok = true
    for (let j = 1; j <= N; j++) {
      if (candles[i - j].high >= h || candles[i + j].high >= h) { ok = false; break }
    }
    if (ok) out.push({ idx: i, ts: candles[i].timestamp, price: h })
  }
  return out
}

function findPivotLows(candles: Candle[]): Array<{ idx: number; ts: number; price: number }> {
  const out: Array<{ idx: number; ts: number; price: number }> = []
  for (let i = N; i < candles.length - N; i++) {
    const l = candles[i].low
    let ok = true
    for (let j = 1; j <= N; j++) {
      if (candles[i - j].low <= l || candles[i + j].low <= l) { ok = false; break }
    }
    if (ok) out.push({ idx: i, ts: candles[i].timestamp, price: l })
  }
  return out
}

function buildLines(
  pivots: Array<{ idx: number; ts: number; price: number }>,
  type: 'resistance' | 'support',
  candles: Candle[],
  intervalMs: number,
): TrendlineData[] {
  const results: TrendlineData[] = []
  if (pivots.length < 2) return results

  const lastIdx = candles.length - 1
  const lastTs  = candles[lastIdx].timestamp

  for (let i = pivots.length - 1; i >= 1; i--) {
    const p2 = pivots[i]
    const p1 = pivots[i - 1]

    if (type === 'resistance' && p2.price >= p1.price) continue
    if (type === 'support'    && p2.price <= p1.price) continue

    const dIdx = p2.idx - p1.idx
    if (dIdx <= 0) continue
    const slope = (p2.price - p1.price) / dIdx

    let touchCount = 2
    for (let j = 0; j < pivots.length; j++) {
      if (j === i || j === i - 1) continue
      const pj = pivots[j]
      const expected = p1.price + slope * (pj.idx - p1.idx)
      if (Math.abs(pj.price - expected) / Math.abs(p1.price) < 0.006) touchCount++
    }

    let isBroken = false
    let breakAt: { timestamp: number; value: number } | undefined
    for (let j = p2.idx + 1; j <= lastIdx; j++) {
      const c = candles[j]
      const expected = p1.price + slope * (j - p1.idx)
      if (type === 'resistance' && c.close > expected * 1.0015) {
        isBroken = true
        breakAt = { timestamp: c.timestamp, value: expected }
        break
      }
      if (type === 'support' && c.close < expected * 0.9985) {
        isBroken = true
        breakAt = { timestamp: c.timestamp, value: expected }
        break
      }
    }

    let endTs: number, endVal: number
    if (isBroken && breakAt) {
      endTs  = breakAt.timestamp
      endVal = breakAt.value
    } else {
      const extIdx = lastIdx + 5
      endTs  = lastTs + 5 * intervalMs
      endVal = p1.price + slope * (extIdx - p1.idx)
    }

    results.push({
      type,
      p1: { timestamp: p1.ts, value: p1.price },
      p2: { timestamp: p2.ts, value: p2.price },
      end: { timestamp: endTs, value: endVal },
      isBroken, breakAt, touchCount,
      strength: touchCount >= 4 ? 'strong' : touchCount >= 3 ? 'moderate' : 'weak',
    })

    const activeCount = results.filter(r => !r.isBroken).length
    const brokenCount = results.filter(r =>  r.isBroken).length
    if (activeCount >= 1 && brokenCount >= 2) break
  }

  return results
}

export function calcTrendlines(
  candles: Candle[],
  intervalMs: number,
): TrendlineData[] {
  if (candles.length < 20) return []

  const work = candles.length > 200 ? candles.slice(-200) : candles

  const pivotHighs = findPivotHighs(work)
  const pivotLows  = findPivotLows(work)

  const offset = candles.length - work.length
  pivotHighs.forEach(p => { p.idx += offset })
  pivotLows.forEach(p =>  { p.idx += offset })

  const resistance = buildLines(pivotHighs, 'resistance', candles, intervalMs)
  const support    = buildLines(pivotLows,  'support',    candles, intervalMs)

  return [...resistance, ...support]
}
