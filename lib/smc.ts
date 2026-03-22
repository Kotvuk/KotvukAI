// lib/smc.ts — Enhanced Smart Money Concepts analysis engine

export interface Candle {
  timestamp: number
  open: number; high: number; low: number; close: number; volume: number
}

// ── Enhanced Order Block ─────────────────────────────────────────────────────
export interface OrderBlock {
  type: 'bullish' | 'bearish'
  high: number; low: number; mid: number
  timestamp: number
  strength: 'weak' | 'moderate' | 'strong'
  quality: 'A+' | 'A' | 'B' | 'C'
  impulseSize: number       // % size of impulse after OB
  touchCount: number        // how many times price revisited
  isMitigated: boolean      // price entered the OB zone
  mitigationPct: number     // 0-100: how deep price went into OB
  ageCandles: number        // candles since formation
  volume: number            // volume at OB candle
  relVolume: number         // relative volume vs 20-bar avg
}

// ── Breaker Block ─────────────────────────────────────────────────────────────
export interface BreakerBlock {
  type: 'bullish' | 'bearish'   // bullish = broken bearish OB (now acts as support)
  high: number; low: number; mid: number
  timestamp: number
  breakTimestamp: number         // when it was broken
  strength: 'weak' | 'moderate' | 'strong'
}

// ── Mitigation Block ──────────────────────────────────────────────────────────
export interface MitigationBlock {
  type: 'bullish' | 'bearish'
  high: number; low: number
  timestamp: number
  mitigationPct: number          // % filled (50-99, not fully mitigated)
  returnProbability: number      // estimated probability of return
}

// ── Enhanced FVG ──────────────────────────────────────────────────────────────
export interface FVG {
  type: 'bullish' | 'bearish'
  high: number; low: number; mid: number
  gapSize: number                // absolute gap size
  gapPct: number                 // gap as % of price
  startTimestamp: number; endTimestamp: number
  ageCandles: number
  isFilled: boolean
  fillPct: number                // 0-100
  quality: 'A+' | 'A' | 'B' | 'C'
}

// ── Liquidity Level ───────────────────────────────────────────────────────────
export interface LiquidityLevel {
  type: 'buy' | 'sell'
  price: number
  strength: 'weak' | 'moderate' | 'strong'
  touchCount: number
  isSwept: boolean               // has price swept through this level
}

// ── Full SMC Data ─────────────────────────────────────────────────────────────
export interface SMCData {
  orderBlocks: OrderBlock[]
  breakerBlocks: BreakerBlock[]
  mitigationBlocks: MitigationBlock[]
  fvgs: FVG[]
  liquidityLevels: LiquidityLevel[]
  bosLevel: number | null
  cob: number | null             // Change of Character level
  trend: 'bullish' | 'bearish' | 'ranging'
  htfBias: 'bullish' | 'bearish' | 'neutral'
  sweepCount: number             // recent liquidity sweeps (last 10 candles)
  // Probability model output
  probability: ProbabilityResult
}

export interface ProbabilityResult {
  scenario: 'LONG' | 'SHORT' | 'NEUTRAL'
  probability: number           // 0-100
  confidence: number            // 0-100
  riskReward: number            // e.g. 2.5
  expectedR: number             // expected R value
  recommendation: string        // human-readable action
  factors: {
    htfStructure: number        // 0-25
    confluenceZones: number     // 0-20
    volumeProfile: number       // 0-15
    temporalContext: number     // 0-15
    historicalStats: number     // 0-20
    marketSentiment: number     // 0-5
  }
  alerts: Alert[]
}

export interface Alert {
  stage: 1 | 2 | 3
  level: 'watchlist' | 'setup_ready' | 'execute'
  color: 'yellow' | 'orange' | 'green' | 'red'
  message: string
  price: number
  type: 'LONG' | 'SHORT'
  confidence: number
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
export function calcEnhancedSMC(candles: Candle[], fundingRate: number | null = null): SMCData {
  const recent = candles.slice(-100)
  const price = recent[recent.length - 1].close

  // Volume baseline (20-bar avg)
  const avgVol = recent.slice(-20).reduce((s, c) => s + c.volume, 0) / 20

  // ── Order Blocks ─────────────────────────────────────────────────────────
  const rawOBs = detectOrderBlocks(recent, price, avgVol)
  const { orderBlocks, breakerBlocks, mitigationBlocks } = classifyOBs(rawOBs, recent, price)

  // ── FVGs ──────────────────────────────────────────────────────────────────
  const fvgs = detectFVGs(recent, price)

  // ── Liquidity Levels ─────────────────────────────────────────────────────
  const liquidityLevels = detectLiquidity(recent, price)

  // ── BOS / COB / Trend ────────────────────────────────────────────────────
  const { trend, bosLevel, cob, htfBias } = detectStructure(recent)

  // ── Sweeps ───────────────────────────────────────────────────────────────
  const sweepCount = countRecentSweeps(recent.slice(-10), liquidityLevels)

  // ── Probability Model ─────────────────────────────────────────────────────
  const probability = calcProbability({
    price, trend, htfBias,
    orderBlocks, fvgs, liquidityLevels,
    bosLevel, candles: recent, avgVol, fundingRate, sweepCount,
  })

  return {
    orderBlocks: orderBlocks.slice(0, 6),
    breakerBlocks: breakerBlocks.slice(0, 4),
    mitigationBlocks: mitigationBlocks.slice(0, 3),
    fvgs: fvgs.slice(0, 6),
    liquidityLevels: liquidityLevels.slice(0, 8),
    bosLevel, cob, trend, htfBias, sweepCount,
    probability,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER BLOCK DETECTION
// ─────────────────────────────────────────────────────────────────────────────
interface RawOB {
  type: 'bullish' | 'bearish'
  high: number; low: number; mid: number
  timestamp: number; index: number
  impulseSize: number; volume: number; relVolume: number
}

function detectOrderBlocks(candles: Candle[], price: number, avgVol: number): RawOB[] {
  const obs: RawOB[] = []

  for (let i = 2; i < candles.length - 4; i++) {
    const c = candles[i]
    const isBearishCandle = c.close < c.open
    const isBullishCandle = c.close > c.open

    // Measure impulse over next 3 candles
    const next3 = candles.slice(i + 1, i + 4)
    const impulseHigh = Math.max(...next3.map(x => x.high))
    const impulseLow  = Math.min(...next3.map(x => x.low))
    const impulseSize = Math.abs(impulseHigh - impulseLow) / c.close * 100

    if (impulseSize < 0.3) continue // too small

    const relVol = c.volume / avgVol

    // Bullish OB: bearish candle before upward impulse
    if (isBearishCandle && impulseHigh > c.high * 1.001) {
      obs.push({
        type: 'bullish',
        high: c.high, low: c.low, mid: (c.high + c.low) / 2,
        timestamp: c.timestamp, index: i,
        impulseSize, volume: c.volume, relVolume: relVol,
      })
    }
    // Bearish OB: bullish candle before downward impulse
    else if (isBullishCandle && impulseLow < c.low * 0.999) {
      obs.push({
        type: 'bearish',
        high: c.high, low: c.low, mid: (c.high + c.low) / 2,
        timestamp: c.timestamp, index: i,
        impulseSize, volume: c.volume, relVolume: relVol,
      })
    }
  }

  return obs
}

function classifyOBs(
  rawOBs: RawOB[],
  candles: Candle[],
  price: number
): { orderBlocks: OrderBlock[]; breakerBlocks: BreakerBlock[]; mitigationBlocks: MitigationBlock[] } {
  const orderBlocks: OrderBlock[] = []
  const breakerBlocks: BreakerBlock[] = []
  const mitigationBlocks: MitigationBlock[] = []
  const totalCandles = candles.length

  for (const ob of rawOBs) {
    const future = candles.slice(ob.index + 4)
    const ageCandles = totalCandles - ob.index - 4

    // Count touches (price entering OB zone)
    let touchCount = 0
    let minFill = ob.type === 'bullish' ? ob.high : ob.low
    let maxFill = ob.type === 'bullish' ? ob.high : ob.low
    let isBroken = false
    let breakIdx = -1

    for (let j = 0; j < future.length; j++) {
      const fc = future[j]
      const inZone = ob.type === 'bullish'
        ? (fc.low <= ob.high && fc.high >= ob.low)
        : (fc.high >= ob.low && fc.low <= ob.high)
      if (inZone) {
        touchCount++
        if (ob.type === 'bullish') minFill = Math.min(minFill, fc.low)
        else maxFill = Math.max(maxFill, fc.high)
      }

      // Check if OB is broken (price closes beyond OB)
      if (ob.type === 'bullish' && fc.close < ob.low) { isBroken = true; breakIdx = j; break }
      if (ob.type === 'bearish' && fc.close > ob.high) { isBroken = true; breakIdx = j; break }
    }

    // Calculate mitigation %
    const obSize = ob.high - ob.low
    let mitigationPct = 0
    if (ob.type === 'bullish' && obSize > 0) {
      mitigationPct = Math.min(100, ((ob.high - minFill) / obSize) * 100)
    } else if (ob.type === 'bearish' && obSize > 0) {
      mitigationPct = Math.min(100, ((maxFill - ob.low) / obSize) * 100)
    }

    // Is currently mitigated (price inside zone)
    const isMitigated = ob.type === 'bullish'
      ? (price <= ob.high && price >= ob.low)
      : (price >= ob.low && price <= ob.high)

    // Strength based on impulse size
    const strength: OrderBlock['strength'] = ob.impulseSize > 2 ? 'strong' : ob.impulseSize > 0.8 ? 'moderate' : 'weak'

    // Quality grade
    const isFresh = touchCount === 0
    const highRelVol = ob.relVolume > 1.5
    const isRecent = ageCandles < 20
    let quality: OrderBlock['quality']
    if (isFresh && highRelVol && isRecent && strength === 'strong') quality = 'A+'
    else if ((isFresh || highRelVol) && strength !== 'weak') quality = 'A'
    else if (touchCount <= 1 && !isBroken) quality = 'B'
    else quality = 'C'

    if (isBroken) {
      // Becomes a Breaker Block
      breakerBlocks.push({
        type: ob.type === 'bullish' ? 'bearish' : 'bullish', // flip
        high: ob.high, low: ob.low, mid: ob.mid,
        timestamp: ob.timestamp,
        breakTimestamp: future[breakIdx]?.timestamp ?? ob.timestamp,
        strength,
      })
    } else if (mitigationPct >= 50 && mitigationPct < 100) {
      // Partial mitigation — Mitigation Block
      mitigationBlocks.push({
        type: ob.type, high: ob.high, low: ob.low,
        timestamp: ob.timestamp, mitigationPct,
        returnProbability: Math.round((100 - mitigationPct) * 0.8),
      })
    } else {
      orderBlocks.push({
        type: ob.type, high: ob.high, low: ob.low, mid: ob.mid,
        timestamp: ob.timestamp, strength, quality,
        impulseSize: parseFloat(ob.impulseSize.toFixed(2)),
        touchCount, isMitigated, mitigationPct: parseFloat(mitigationPct.toFixed(1)),
        ageCandles, volume: ob.volume, relVolume: parseFloat(ob.relVolume.toFixed(2)),
      })
    }
  }

  // Sort: quality A+ > A > B > C, then by recency
  const qRank = (q: string) => ({ 'A+': 4, 'A': 3, 'B': 2, 'C': 1 }[q] ?? 0)
  orderBlocks.sort((a, b) => qRank(b.quality) - qRank(a.quality) || b.timestamp - a.timestamp)

  return { orderBlocks, breakerBlocks, mitigationBlocks }
}

// ─────────────────────────────────────────────────────────────────────────────
// FVG DETECTION
// ─────────────────────────────────────────────────────────────────────────────
function detectFVGs(candles: Candle[], price: number): FVG[] {
  const fvgs: FVG[] = []

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]
    const next = candles[i + 1]

    // Bullish FVG: gap between prev.high and next.low
    const bullGap = next.low - prev.high
    if (bullGap > 0 && bullGap / curr.close > 0.001) {
      const gapLow = prev.high, gapHigh = next.low, gapMid = (gapLow + gapHigh) / 2
      const ageCandles = candles.length - 1 - i

      // Check fill
      let fillPct = 0
      for (let j = i + 2; j < candles.length; j++) {
        const fc = candles[j]
        if (fc.low <= gapLow) { fillPct = 100; break }
        if (fc.low < gapHigh) {
          fillPct = Math.min(100, ((gapHigh - fc.low) / (gapHigh - gapLow)) * 100)
        }
      }

      const gapPct = (bullGap / curr.close) * 100
      fvgs.push({
        type: 'bullish', high: gapHigh, low: gapLow, mid: gapMid,
        gapSize: parseFloat(bullGap.toFixed(2)), gapPct: parseFloat(gapPct.toFixed(3)),
        startTimestamp: prev.timestamp, endTimestamp: next.timestamp,
        ageCandles, isFilled: fillPct >= 100, fillPct: parseFloat(fillPct.toFixed(1)),
        quality: gapPct > 0.5 ? (ageCandles < 10 ? 'A+' : 'A') : (fillPct < 50 ? 'B' : 'C'),
      })
    }

    // Bearish FVG: gap between next.high and prev.low
    const bearGap = prev.low - next.high
    if (bearGap > 0 && bearGap / curr.close > 0.001) {
      const gapHigh = prev.low, gapLow = next.high, gapMid = (gapLow + gapHigh) / 2
      const ageCandles = candles.length - 1 - i

      let fillPct = 0
      for (let j = i + 2; j < candles.length; j++) {
        const fc = candles[j]
        if (fc.high >= gapHigh) { fillPct = 100; break }
        if (fc.high > gapLow) {
          fillPct = Math.min(100, ((fc.high - gapLow) / (gapHigh - gapLow)) * 100)
        }
      }

      const gapPct = (bearGap / curr.close) * 100
      fvgs.push({
        type: 'bearish', high: gapHigh, low: gapLow, mid: gapMid,
        gapSize: parseFloat(bearGap.toFixed(2)), gapPct: parseFloat(gapPct.toFixed(3)),
        startTimestamp: prev.timestamp, endTimestamp: next.timestamp,
        ageCandles, isFilled: fillPct >= 100, fillPct: parseFloat(fillPct.toFixed(1)),
        quality: gapPct > 0.5 ? (ageCandles < 10 ? 'A+' : 'A') : (fillPct < 50 ? 'B' : 'C'),
      })
    }
  }

  // Filter: unfilled FVGs near price, sort by recency
  return fvgs
    .filter(f => !f.isFilled)
    .sort((a, b) => a.ageCandles - b.ageCandles)
    .slice(0, 8)
}

// ─────────────────────────────────────────────────────────────────────────────
// LIQUIDITY DETECTION
// ─────────────────────────────────────────────────────────────────────────────
function detectLiquidity(candles: Candle[], price: number): LiquidityLevel[] {
  const levels: LiquidityLevel[] = []
  const tol = price * 0.003  // 0.3% tolerance
  const recent20 = candles.slice(-30)

  // Equal Highs → sell liquidity (stops above)
  const highs = recent20.map((c, i) => ({ price: c.high, idx: i, ts: c.timestamp }))
  for (let i = 0; i < highs.length; i++) {
    const matches = highs.filter((h, j) => j !== i && Math.abs(h.price - highs[i].price) < tol)
    if (matches.length >= 1) {
      const lvlPrice = parseFloat(highs[i].price.toFixed(2))
      if (!levels.find(l => l.type === 'sell' && Math.abs(l.price - lvlPrice) < tol)) {
        const touchCount = matches.length + 1
        const isSwept = candles.slice(-5).some(c => c.high > lvlPrice)
        levels.push({
          type: 'sell', price: lvlPrice,
          strength: touchCount >= 3 ? 'strong' : touchCount === 2 ? 'moderate' : 'weak',
          touchCount, isSwept,
        })
      }
    }
  }

  // Equal Lows → buy liquidity (stops below)
  const lows = recent20.map((c, i) => ({ price: c.low, idx: i, ts: c.timestamp }))
  for (let i = 0; i < lows.length; i++) {
    const matches = lows.filter((l, j) => j !== i && Math.abs(l.price - lows[i].price) < tol)
    if (matches.length >= 1) {
      const lvlPrice = parseFloat(lows[i].price.toFixed(2))
      if (!levels.find(l => l.type === 'buy' && Math.abs(l.price - lvlPrice) < tol)) {
        const touchCount = matches.length + 1
        const isSwept = candles.slice(-5).some(c => c.low < lvlPrice)
        levels.push({
          type: 'buy', price: lvlPrice,
          strength: touchCount >= 3 ? 'strong' : touchCount === 2 ? 'moderate' : 'weak',
          touchCount, isSwept,
        })
      }
    }
  }

  // Sort: strong first, then by proximity to price
  return levels
    .sort((a, b) => {
      const sRank = (s: string) => ({ strong: 3, moderate: 2, weak: 1 }[s] ?? 0)
      return sRank(b.strength) - sRank(a.strength)
    })
    .slice(0, 8)
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────
function detectStructure(candles: Candle[]): {
  trend: SMCData['trend']; bosLevel: number | null; cob: number | null; htfBias: SMCData['htfBias']
} {
  const last10 = candles.slice(-10)
  const last30 = candles.slice(-30)
  const last5  = candles.slice(-5)

  // Short-term: last 10 candles
  const hhs = last10.filter((c, i) => i > 0 && c.high > last10[i - 1].high).length
  const lls = last10.filter((c, i) => i > 0 && c.low < last10[i - 1].low).length

  // HTF bias: last 30 candles
  const htfHHs = last30.filter((c, i) => i > 0 && c.high > last30[i - 1].high).length
  const htfLLs = last30.filter((c, i) => i > 0 && c.low < last30[i - 1].low).length
  const htfBias: SMCData['htfBias'] = htfHHs > htfLLs * 1.4 ? 'bullish' : htfLLs > htfHHs * 1.4 ? 'bearish' : 'neutral'

  const trend: SMCData['trend'] = hhs > 6 ? 'bullish' : lls > 6 ? 'bearish' : 'ranging'

  // BOS level = most recent swing high/low
  const bosLevel = trend !== 'ranging' ? parseFloat(
    (trend === 'bullish' ? Math.max(...last10.map(c => c.high)) : Math.min(...last10.map(c => c.low))).toFixed(2)
  ) : null

  // COB (Change of Character): recent candles broke against trend
  const prevTrend = last30.slice(0, 20)
  const prevHHs = prevTrend.filter((c, i) => i > 0 && c.high > prevTrend[i - 1].high).length
  const prevLLs = prevTrend.filter((c, i) => i > 0 && c.low < prevTrend[i - 1].low).length
  const prevBias = prevHHs > prevLLs * 1.3 ? 'bullish' : prevLLs > prevHHs * 1.3 ? 'bearish' : 'neutral'
  let cob: number | null = null
  if (prevBias === 'bullish' && htfBias !== 'bullish') {
    cob = parseFloat(Math.min(...last5.map(c => c.low)).toFixed(2))
  } else if (prevBias === 'bearish' && htfBias !== 'bearish') {
    cob = parseFloat(Math.max(...last5.map(c => c.high)).toFixed(2))
  }

  return { trend, bosLevel, cob, htfBias }
}

function countRecentSweeps(recentCandles: Candle[], levels: LiquidityLevel[]): number {
  let sweeps = 0
  for (const candle of recentCandles) {
    for (const lvl of levels) {
      if (lvl.type === 'sell' && candle.high > lvl.price && candle.close < lvl.price) sweeps++
      if (lvl.type === 'buy' && candle.low < lvl.price && candle.close > lvl.price) sweeps++
    }
  }
  return sweeps
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBABILITY MODEL — 6 factors
// ─────────────────────────────────────────────────────────────────────────────
interface ProbInput {
  price: number
  trend: SMCData['trend']
  htfBias: SMCData['htfBias']
  orderBlocks: OrderBlock[]
  fvgs: FVG[]
  liquidityLevels: LiquidityLevel[]
  bosLevel: number | null
  candles: Candle[]
  avgVol: number
  fundingRate: number | null
  sweepCount: number
}

function calcProbability(inp: ProbInput): ProbabilityResult {
  const { price, trend, htfBias, orderBlocks, fvgs, liquidityLevels, candles, avgVol, fundingRate, sweepCount } = inp

  // ── Factor 1: HTF Structure (max 25) ─────────────────────────────────────
  let f1 = 10 // baseline neutral
  if (htfBias === 'bullish' && trend === 'bullish') f1 = 25
  else if (htfBias === 'bearish' && trend === 'bearish') f1 = 25
  else if (htfBias !== 'neutral' && trend === 'ranging') f1 = 15
  else if (htfBias === 'neutral') f1 = 10

  const htfDir: 'LONG' | 'SHORT' | 'NEUTRAL' = htfBias === 'bullish' ? 'LONG' : htfBias === 'bearish' ? 'SHORT' : 'NEUTRAL'

  // ── Factor 2: Confluence Zones (max 20) ──────────────────────────────────
  // Count how many zones (OB + FVG + S/R) are near current price (within 1%)
  const nearZoneThreshold = price * 0.01
  const nearBullOBs = orderBlocks.filter(o => o.type === 'bullish' && price - o.high < nearZoneThreshold && price > o.low).length
  const nearBearOBs = orderBlocks.filter(o => o.type === 'bearish' && o.low - price < nearZoneThreshold && price < o.high).length
  const nearFVGs   = fvgs.filter(f => Math.abs(f.mid - price) < nearZoneThreshold).length
  const confluence = nearBullOBs + nearBearOBs + nearFVGs
  let f2 = Math.min(20, confluence * 6 + (orderBlocks.some(o => o.quality === 'A+') ? 4 : 0))

  // ── Factor 3: Volume Profile (max 15) ─────────────────────────────────────
  const last5Vols = candles.slice(-5).map(c => c.volume)
  const recentAvgVol = last5Vols.reduce((a, b) => a + b, 0) / 5
  const volRatio = recentAvgVol / avgVol
  let f3 = 7 // baseline
  if (volRatio > 1.5) f3 = 15
  else if (volRatio > 1.2) f3 = 12
  else if (volRatio > 0.8) f3 = 7
  else f3 = 4 // low volume — unreliable

  // ── Factor 4: Temporal Context (max 15) ───────────────────────────────────
  const hour = new Date().getUTCHours()
  // Key sessions: London (7-16), NY (13-21), Asia (0-8)
  const inLondon = hour >= 7 && hour < 16
  const inNY = hour >= 13 && hour < 21
  const inAsiaOpen = hour >= 0 && hour < 3
  let f4 = 8 // baseline
  if (inLondon && inNY) f4 = 15  // overlap — highest volatility
  else if (inLondon || inNY) f4 = 12
  else if (inAsiaOpen) f4 = 8
  else f4 = 5  // dead hours

  // Liquidity sweeps boost f4 (swept liquidity = likely reversal/continuation)
  if (sweepCount >= 2) f4 = Math.min(15, f4 + 3)

  // ── Factor 5: Historical Stats (max 20) ───────────────────────────────────
  // Proxy: A+/A quality OBs with unmitigated status = high historical win rate
  const aPlusCount = orderBlocks.filter(o => o.quality === 'A+').length
  const aCount = orderBlocks.filter(o => o.quality === 'A').length
  const freshFVGs = fvgs.filter(f => f.quality === 'A+' || f.quality === 'A').length
  let f5 = Math.min(20, aPlusCount * 8 + aCount * 4 + freshFVGs * 3)
  if (f5 < 4) f5 = 4  // min baseline

  // ── Factor 6: Market Sentiment (max 5) ───────────────────────────────────
  let f6 = 2 // neutral baseline
  if (fundingRate !== null) {
    if (fundingRate > 0.05) f6 = htfDir === 'SHORT' ? 4 : 1  // overheated longs: bearish bias
    else if (fundingRate < -0.01) f6 = htfDir === 'LONG' ? 4 : 1  // negative: bearish sentiment
    else f6 = 3  // neutral funding
  }

  const totalScore = f1 + f2 + f3 + f4 + f5 + f6
  const probability = Math.min(95, Math.max(20, totalScore))

  // Determine scenario direction
  let scenario: ProbabilityResult['scenario']
  if (probability >= 60 && htfDir !== 'NEUTRAL') scenario = htfDir
  else if (probability >= 45) scenario = htfDir === 'NEUTRAL' ? 'NEUTRAL' : htfDir
  else scenario = 'NEUTRAL'

  const confidence = Math.round(probability * 0.95)

  // Estimate R:R from nearest OB/FVG vs nearest liquidity
  const nearestBullOB = orderBlocks.filter(o => o.type === 'bullish' && o.high < price).sort((a, b) => b.high - a.high)[0]
  const nearestBearOB = orderBlocks.filter(o => o.type === 'bearish' && o.low > price).sort((a, b) => a.low - b.low)[0]
  const nearestSellLiq = liquidityLevels.filter(l => l.type === 'sell' && l.price > price).sort((a, b) => a.price - b.price)[0]
  const nearestBuyLiq  = liquidityLevels.filter(l => l.type === 'buy' && l.price < price).sort((a, b) => b.price - a.price)[0]

  let riskReward = 1.5 // default
  if (scenario === 'LONG' && nearestBullOB && nearestSellLiq) {
    const reward = nearestSellLiq.price - price
    const risk   = price - nearestBullOB.low
    if (risk > 0) riskReward = parseFloat((reward / risk).toFixed(2))
  } else if (scenario === 'SHORT' && nearestBearOB && nearestBuyLiq) {
    const reward = price - nearestBuyLiq.price
    const risk   = nearestBearOB.high - price
    if (risk > 0) riskReward = parseFloat((reward / risk).toFixed(2))
  }
  riskReward = Math.max(0.5, Math.min(10, riskReward))
  const expectedR = parseFloat((riskReward * (probability / 100) - (1 - probability / 100)).toFixed(2))

  // Recommendation
  let recommendation: string
  if (probability >= 75 && scenario !== 'NEUTRAL') {
    recommendation = `Сильный сетап ${scenario} — входить при подтверждении на младшем ТФ`
  } else if (probability >= 60 && scenario !== 'NEUTRAL') {
    recommendation = `Умеренный ${scenario} сетап — ждать ретеста ключевой зоны`
  } else if (probability >= 45) {
    recommendation = 'Смешанные сигналы — наблюдать, не торговать'
  } else {
    recommendation = 'Низкая вероятность — пропустить этот сетап'
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: Alert[] = []

  // Stage 1 — Watchlist: good HTF + forming confluence
  if (f1 >= 15 && probability >= 45) {
    alerts.push({
      stage: 1, level: 'watchlist', color: 'yellow',
      message: `${pair_placeholder(scenario)} формируется — структура HTF подтверждает ${htfBias}`,
      price, type: scenario === 'NEUTRAL' ? 'LONG' : scenario, confidence: Math.round(probability * 0.7),
    })
  }

  // Stage 2 — Setup Ready: all criteria met
  if (probability >= 60 && riskReward >= 1.5 && confluence >= 2) {
    alerts.push({
      stage: 2, level: 'setup_ready', color: 'orange',
      message: `Сетап готов: ${scenario} | Конфлюэнс ${confluence} зон | R:R ${riskReward}`,
      price, type: scenario === 'NEUTRAL' ? 'LONG' : scenario, confidence: Math.round(probability * 0.85),
    })
  }

  // Stage 3 — Execute: fresh sweep + OB touch
  if (sweepCount >= 1 && probability >= 70 && (nearBullOBs > 0 || nearBearOBs > 0)) {
    alerts.push({
      stage: 3, level: 'execute', color: scenario === 'LONG' ? 'green' : 'red',
      message: `ТРИГГЕР: ${scenario} | Свип ликвидности + ретест OB | Уверенность ${confidence}%`,
      price, type: scenario === 'NEUTRAL' ? 'LONG' : scenario, confidence,
    })
  }

  return {
    scenario, probability, confidence, riskReward, expectedR, recommendation,
    factors: { htfStructure: f1, confluenceZones: f2, volumeProfile: f3, temporalContext: f4, historicalStats: f5, marketSentiment: f6 },
    alerts,
  }
}

function pair_placeholder(s: string) {
  return s === 'LONG' ? '🟢 LONG' : s === 'SHORT' ? '🔴 SHORT' : '⚪ NEUTRAL'
}

// ── Legacy compat (used by existing ollama.ts SMCData interface) ──────────────
export function toOllamaFormat(smc: SMCData) {
  return {
    orderBlocks: smc.orderBlocks.map(o => ({ type: o.type, high: o.high, low: o.low, timestamp: o.timestamp })),
    fvgs: smc.fvgs.map(f => ({ type: f.type, high: f.high, low: f.low, startTimestamp: f.startTimestamp, endTimestamp: f.endTimestamp })),
    liquidityLevels: smc.liquidityLevels.map(l => ({ type: l.type, price: l.price })),
    bosLevel: smc.bosLevel,
    trend: smc.trend,
  }
}
