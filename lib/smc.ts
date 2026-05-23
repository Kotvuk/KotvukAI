export interface Candle {
  timestamp: number
  open: number; high: number; low: number; close: number; volume: number
}

export interface OrderBlock {
  type: 'bullish' | 'bearish'
  high: number; low: number; mid: number
  timestamp: number
  strength: 'weak' | 'moderate' | 'strong'
  quality: 'A+' | 'A' | 'B' | 'C'
  impulseSize: number
  touchCount: number
  isMitigated: boolean
  mitigationPct: number
  ageCandles: number
  volume: number
  relVolume: number
}

export interface BreakerBlock {
  type: 'bullish' | 'bearish'
  high: number; low: number; mid: number
  timestamp: number
  breakTimestamp: number
  strength: 'weak' | 'moderate' | 'strong'
}

export interface MitigationBlock {
  type: 'bullish' | 'bearish'
  high: number; low: number
  timestamp: number
  mitigationPct: number
  returnProbability: number
}

export interface FVG {
  type: 'bullish' | 'bearish'
  high: number; low: number; mid: number
  gapSize: number
  gapPct: number
  startTimestamp: number; endTimestamp: number
  ageCandles: number
  isFilled: boolean
  fillPct: number
  quality: 'A+' | 'A' | 'B' | 'C'
}

export interface LiquidityLevel {
  type: 'buy' | 'sell'
  price: number
  timestamp: number
  strength: 'weak' | 'moderate' | 'strong'
  touchCount: number
  isSwept: boolean
}

export interface SMCData {
  orderBlocks: OrderBlock[]
  breakerBlocks: BreakerBlock[]
  mitigationBlocks: MitigationBlock[]
  fvgs: FVG[]
  liquidityLevels: LiquidityLevel[]
  bosLevel: number | null
  cob: number | null
  trend: 'bullish' | 'bearish' | 'ranging'
  htfBias: 'bullish' | 'bearish' | 'neutral'
  sweepCount: number

  probability: ProbabilityResult
}

export interface ProbabilityResult {
  scenario: 'LONG' | 'SHORT' | 'NEUTRAL'
  probability: number
  confidence: number
  riskReward: number
  expectedR: number
  recommendation: string
  recommendationKey: 'smc_rec_strong' | 'smc_rec_moderate' | 'smc_rec_mixed' | 'smc_rec_low'
  factors: {
    htfStructure: number
    confluenceZones: number
    volumeProfile: number
    temporalContext: number
    historicalStats: number
    marketSentiment: number
  }
  alerts: Alert[]
}

export interface Alert {
  stage: 1 | 2 | 3
  level: 'watchlist' | 'setup_ready' | 'execute'
  color: 'yellow' | 'orange' | 'green' | 'red'
  message: string
  confluenceCount?: number
  htfBiasVal?: string
  price: number
  type: 'LONG' | 'SHORT'
  confidence: number
}

export function calcEnhancedSMC(candles: Candle[], fundingRate: number | null = null): SMCData {
  const recent = candles
  const price = recent[recent.length - 1].close

  const avgVol = recent.slice(-20).reduce((s, c) => s + c.volume, 0) / 20

  const rawOBs = detectOrderBlocks(recent, price, avgVol)
  const { orderBlocks, breakerBlocks, mitigationBlocks } = classifyOBs(rawOBs, recent, price)

  const fvgs = detectFVGs(recent, price)

  const liquidityLevels = detectLiquidity(recent, price)
  const { trend, bosLevel, cob, htfBias } = detectStructure(recent)
  const sweepCount = countRecentSweeps(recent.slice(-10), liquidityLevels)
  const probability = calcProbability({
    price, trend, htfBias,
    orderBlocks, fvgs, liquidityLevels,
    bosLevel, candles: recent, avgVol, fundingRate, sweepCount,
  })

  return {
    orderBlocks,
    breakerBlocks,
    mitigationBlocks,
    fvgs,
    liquidityLevels,
    bosLevel, cob, trend, htfBias, sweepCount,
    probability,
  }
}

interface RawOB {
  type: 'bullish' | 'bearish'
  high: number; low: number; mid: number
  timestamp: number; index: number
  bosIndex: number
  impulseSize: number; volume: number; relVolume: number
}

function calcATR(candles: Candle[], period = 200): number[] {
  const atrs: number[] = []
  let prev = 0
  for (let i = 0; i < candles.length; i++) {
    const tr = i === 0
      ? candles[i].high - candles[i].low
      : Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - candles[i - 1].close),
          Math.abs(candles[i].low  - candles[i - 1].close),
        )
    if (i === 0) { prev = tr; atrs.push(tr); continue }
    const k = i < period ? 1 / (i + 1) : 1 / period
    prev = prev * (1 - k) + tr * k
    atrs.push(prev)
  }
  return atrs
}

function computeParsed(candles: Candle[]) {
  return {
    parsedHighs: candles.map(c => c.high),
    parsedLows:  candles.map(c => c.low),
  }
}

function detectPivots(candles: Candle[], N: number) {
  const highs: Array<{ idx: number; price: number; ts: number }> = []
  const lows:  Array<{ idx: number; price: number; ts: number }> = []
  for (let i = N; i < candles.length - N; i++) {
    let ph = true, pl = true
    for (let j = 1; j <= N; j++) {
      if (candles[i - j].high >= candles[i].high || candles[i + j].high >= candles[i].high) { ph = false }
      if (candles[i - j].low  <= candles[i].low  || candles[i + j].low  <= candles[i].low)  { pl = false }
    }
    if (ph) highs.push({ idx: i, price: candles[i].high, ts: candles[i].timestamp })
    if (pl) lows.push({  idx: i, price: candles[i].low,  ts: candles[i].timestamp })
  }
  return { highs, lows }
}

function detectOrderBlocks(candles: Candle[], _price: number, avgVol: number): RawOB[] {
  const obs: RawOB[] = []

  const atrs = calcATR(candles)
  const lastATR = atrs[atrs.length - 1] || 1
  const lastPrice = candles[candles.length - 1].close || 1
  const relVol = lastATR / lastPrice
  const N = relVol > 0.015 ? 5 : relVol > 0.005 ? 3 : 2

  const { parsedHighs, parsedLows } = computeParsed(candles)
  const { highs: pivHighs, lows: pivLows } = detectPivots(candles, N)

  type PE = { idx: number; type: 'H' | 'L'; price: number; ts: number }
  const events: PE[] = [
    ...pivHighs.map(p => ({ idx: p.idx, type: 'H' as const, price: p.price, ts: p.ts })),
    ...pivLows.map(p  => ({ idx: p.idx, type: 'L' as const, price: p.price, ts: p.ts })),
  ].sort((a, b) => a.idx - b.idx)

  let swingHigh: { idx: number; price: number; crossed: boolean } | null = null
  let swingLow:  { idx: number; price: number; crossed: boolean } | null = null
  let evtPtr = 0

  for (let i = N; i < candles.length; i++) {
    const c = candles[i]

    while (evtPtr < events.length && events[evtPtr].idx + N <= i) {
      const ev = events[evtPtr++]
      if (ev.type === 'H') swingHigh = { idx: ev.idx, price: ev.price, crossed: false }
      else                  swingLow  = { idx: ev.idx, price: ev.price, crossed: false }
    }

    if (swingHigh && !swingHigh.crossed && c.close > swingHigh.price) {
      swingHigh.crossed = true
      const from = swingHigh.idx, to = i

      let minPL = Infinity, obIdx = from
      for (let j = from; j <= to; j++) {
        if (parsedLows[j] < minPL) { minPL = parsedLows[j]; obIdx = j }
      }

      const obH = Math.max(parsedHighs[obIdx], parsedLows[obIdx])
      const obL = Math.min(parsedHighs[obIdx], parsedLows[obIdx])
      obs.push({
        type: 'bullish',
        high: obH, low: obL, mid: (obH + obL) / 2,
        timestamp: candles[obIdx].timestamp, index: obIdx, bosIndex: i,
        impulseSize: Math.abs(c.close - candles[from].close) / candles[from].close * 100,
        volume: candles[obIdx].volume,
        relVolume: candles[obIdx].volume / avgVol,
      })
    }

    if (swingLow && !swingLow.crossed && c.close < swingLow.price) {
      swingLow.crossed = true
      const from = swingLow.idx, to = i

      let maxPH = -Infinity, obIdx = from
      for (let j = from; j <= to; j++) {
        if (parsedHighs[j] > maxPH) { maxPH = parsedHighs[j]; obIdx = j }
      }

      const obH = Math.max(parsedHighs[obIdx], parsedLows[obIdx])
      const obL = Math.min(parsedHighs[obIdx], parsedLows[obIdx])
      obs.push({
        type: 'bearish',
        high: obH, low: obL, mid: (obH + obL) / 2,
        timestamp: candles[obIdx].timestamp, index: obIdx, bosIndex: i,
        impulseSize: Math.abs(candles[from].close - c.close) / candles[from].close * 100,
        volume: candles[obIdx].volume,
        relVolume: candles[obIdx].volume / avgVol,
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

    const startScan = Math.max(ob.bosIndex + 1, ob.index + 1)
    const future = candles.slice(startScan)
    const ageCandles = totalCandles - startScan

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

      if (ob.type === 'bullish' && fc.low  < ob.low)  { isBroken = true; breakIdx = j; break }
      if (ob.type === 'bearish' && fc.high > ob.high) { isBroken = true; breakIdx = j; break }
    }

    const obSize = ob.high - ob.low
    let mitigationPct = 0
    if (ob.type === 'bullish' && obSize > 0) {
      mitigationPct = Math.min(100, ((ob.high - minFill) / obSize) * 100)
    } else if (ob.type === 'bearish' && obSize > 0) {
      mitigationPct = Math.min(100, ((maxFill - ob.low) / obSize) * 100)
    }

    const isMitigated = ob.type === 'bullish'
      ? (price <= ob.high && price >= ob.low)
      : (price >= ob.low && price <= ob.high)

    const strength: OrderBlock['strength'] = ob.impulseSize > 2 ? 'strong' : ob.impulseSize > 0.8 ? 'moderate' : 'weak'

    const isFresh = touchCount === 0
    const highRelVol = ob.relVolume > 1.5
    const isRecent = ageCandles < 20
    let quality: OrderBlock['quality']
    if (isFresh && highRelVol && isRecent && strength === 'strong') quality = 'A+'
    else if ((isFresh || highRelVol) && strength !== 'weak') quality = 'A'
    else if (touchCount <= 1 && !isBroken) quality = 'B'
    else quality = 'C'

    if (isBroken) {

      if (ob.bosIndex >= candles.length - 150) {
        breakerBlocks.push({
          type: ob.type === 'bullish' ? 'bearish' : 'bullish',
          high: ob.high, low: ob.low, mid: ob.mid,
          timestamp: ob.timestamp,
          breakTimestamp: future[breakIdx]?.timestamp ?? ob.timestamp,
          strength,
        })
      }

    } else if (mitigationPct >= 80 && mitigationPct < 100) {

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

  const qRank = (q: string) => ({ 'A+': 4, 'A': 3, 'B': 2, 'C': 1 }[q] ?? 0)
  orderBlocks.sort((a, b) => qRank(b.quality) - qRank(a.quality) || b.timestamp - a.timestamp)

  return { orderBlocks, breakerBlocks, mitigationBlocks }
}

function detectFVGs(candles: Candle[], price: number): FVG[] {
  const fvgs: FVG[] = []

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]
    const next = candles[i + 1]

    const bullGap = next.low - prev.high
    if (bullGap > 0 && bullGap / curr.close > 0.001) {
      const gapLow = prev.high, gapHigh = next.low, gapMid = (gapLow + gapHigh) / 2
      const ageCandles = candles.length - 1 - i

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

  return fvgs
    .filter(f => !f.isFilled)
    .sort((a, b) => a.ageCandles - b.ageCandles)
}

function detectLiquidity(candles: Candle[], price: number): LiquidityLevel[] {
  const levels: LiquidityLevel[] = []
  const tol = price * 0.003
  const recent20 = candles.slice(-200)

  const highs = recent20.map((c, i) => ({ price: c.high, idx: i, ts: c.timestamp }))
  for (let i = 0; i < highs.length; i++) {
    const matches = highs.filter((h, j) => j !== i && Math.abs(h.price - highs[i].price) < tol)
    if (matches.length >= 1) {
      const lvlPrice = parseFloat(highs[i].price.toFixed(2))
      if (!levels.find(l => l.type === 'sell' && Math.abs(l.price - lvlPrice) < tol)) {
        const touchCount = matches.length + 1
        const isSwept = candles.slice(-5).some(c => c.high > lvlPrice)

        const allTs = [highs[i], ...matches].map(h => h.ts)
        const ts = Math.min(...allTs)
        levels.push({
          type: 'sell', price: lvlPrice, timestamp: ts,
          strength: touchCount >= 3 ? 'strong' : touchCount === 2 ? 'moderate' : 'weak',
          touchCount, isSwept,
        })
      }
    }
  }

  const lows = recent20.map((c, i) => ({ price: c.low, idx: i, ts: c.timestamp }))
  for (let i = 0; i < lows.length; i++) {
    const matches = lows.filter((l, j) => j !== i && Math.abs(l.price - lows[i].price) < tol)
    if (matches.length >= 1) {
      const lvlPrice = parseFloat(lows[i].price.toFixed(2))
      if (!levels.find(l => l.type === 'buy' && Math.abs(l.price - lvlPrice) < tol)) {
        const touchCount = matches.length + 1
        const isSwept = candles.slice(-5).some(c => c.low < lvlPrice)
        const allTs = [lows[i], ...matches].map(l => l.ts)
        const ts = Math.min(...allTs)
        levels.push({
          type: 'buy', price: lvlPrice, timestamp: ts,
          strength: touchCount >= 3 ? 'strong' : touchCount === 2 ? 'moderate' : 'weak',
          touchCount, isSwept,
        })
      }
    }
  }

  return levels
    .sort((a, b) => {
      const sRank = (s: string) => ({ strong: 3, moderate: 2, weak: 1 }[s] ?? 0)
      return sRank(b.strength) - sRank(a.strength)
    })
}

function detectStructure(candles: Candle[]): {
  trend: SMCData['trend']; bosLevel: number | null; cob: number | null; htfBias: SMCData['htfBias']
} {
  const last10 = candles.slice(-10)
  const last30 = candles.slice(-30)
  const last5  = candles.slice(-5)

  const hhs = last10.filter((c, i) => i > 0 && c.high > last10[i - 1].high).length
  const lls = last10.filter((c, i) => i > 0 && c.low < last10[i - 1].low).length

  const htfHHs = last30.filter((c, i) => i > 0 && c.high > last30[i - 1].high).length
  const htfLLs = last30.filter((c, i) => i > 0 && c.low < last30[i - 1].low).length
  const htfBias: SMCData['htfBias'] = htfHHs > htfLLs * 1.4 ? 'bullish' : htfLLs > htfHHs * 1.4 ? 'bearish' : 'neutral'

  const trend: SMCData['trend'] = hhs > 6 ? 'bullish' : lls > 6 ? 'bearish' : 'ranging'

  const bosLevel = trend !== 'ranging' ? parseFloat(
    (trend === 'bullish' ? Math.max(...last10.map(c => c.high)) : Math.min(...last10.map(c => c.low))).toFixed(2)
  ) : null

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

  let f1 = 10
  if (htfBias === 'bullish' && trend === 'bullish') f1 = 25
  else if (htfBias === 'bearish' && trend === 'bearish') f1 = 25
  else if (htfBias !== 'neutral' && trend === 'ranging') f1 = 15
  else if (htfBias === 'neutral') f1 = 10

  const htfDir: 'LONG' | 'SHORT' | 'NEUTRAL' = htfBias === 'bullish' ? 'LONG' : htfBias === 'bearish' ? 'SHORT' : 'NEUTRAL'

  const nearZoneThreshold = price * 0.01
  const nearBullOBs = orderBlocks.filter(o => o.type === 'bullish' && price - o.high < nearZoneThreshold && price > o.low).length
  const nearBearOBs = orderBlocks.filter(o => o.type === 'bearish' && o.low - price < nearZoneThreshold && price < o.high).length
  const nearFVGs   = fvgs.filter(f => Math.abs(f.mid - price) < nearZoneThreshold).length
  const confluence = nearBullOBs + nearBearOBs + nearFVGs
  let f2 = Math.min(20, confluence * 6 + (orderBlocks.some(o => o.quality === 'A+') ? 4 : 0))

  const last5Vols = candles.slice(-5).map(c => c.volume)
  const recentAvgVol = last5Vols.reduce((a, b) => a + b, 0) / 5
  const volRatio = recentAvgVol / avgVol
  let f3 = 7
  if (volRatio > 1.5) f3 = 15
  else if (volRatio > 1.2) f3 = 12
  else if (volRatio > 0.8) f3 = 7
  else f3 = 4

  const hour = new Date().getUTCHours()

  const inLondon = hour >= 7 && hour < 16
  const inNY = hour >= 13 && hour < 21
  const inAsiaOpen = hour >= 0 && hour < 3
  let f4 = 8
  if (inLondon && inNY) f4 = 15
  else if (inLondon || inNY) f4 = 12
  else if (inAsiaOpen) f4 = 8
  else f4 = 5

  if (sweepCount >= 2) f4 = Math.min(15, f4 + 3)

  const aPlusCount = orderBlocks.filter(o => o.quality === 'A+').length
  const aCount = orderBlocks.filter(o => o.quality === 'A').length
  const freshFVGs = fvgs.filter(f => f.quality === 'A+' || f.quality === 'A').length
  let f5 = Math.min(20, aPlusCount * 8 + aCount * 4 + freshFVGs * 3)
  if (f5 < 4) f5 = 4

  let f6 = 2
  if (fundingRate !== null) {
    if (fundingRate > 0.05) f6 = htfDir === 'SHORT' ? 4 : 1
    else if (fundingRate < -0.01) f6 = htfDir === 'LONG' ? 4 : 1
    else f6 = 3
  }

  const totalScore = f1 + f2 + f3 + f4 + f5 + f6
  const probability = Math.min(95, Math.max(20, totalScore))

  let scenario: ProbabilityResult['scenario']
  if (probability >= 60 && htfDir !== 'NEUTRAL') scenario = htfDir
  else if (probability >= 45) scenario = htfDir === 'NEUTRAL' ? 'NEUTRAL' : htfDir
  else scenario = 'NEUTRAL'

  const confidence = Math.round(probability * 0.95)

  const nearestBullOB = orderBlocks.filter(o => o.type === 'bullish' && o.high < price).sort((a, b) => b.high - a.high)[0]
  const nearestBearOB = orderBlocks.filter(o => o.type === 'bearish' && o.low > price).sort((a, b) => a.low - b.low)[0]
  const nearestSellLiq = liquidityLevels.filter(l => l.type === 'sell' && l.price > price).sort((a, b) => a.price - b.price)[0]
  const nearestBuyLiq  = liquidityLevels.filter(l => l.type === 'buy' && l.price < price).sort((a, b) => b.price - a.price)[0]

  let riskReward = 1.5
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

  let recommendation: string
  let recommendationKey: ProbabilityResult['recommendationKey']
  if (probability >= 75 && scenario !== 'NEUTRAL') {
    recommendation     = `Strong ${scenario} setup — enter on LTF confirmation`
    recommendationKey  = 'smc_rec_strong'
  } else if (probability >= 60 && scenario !== 'NEUTRAL') {
    recommendation     = `Moderate ${scenario} setup — wait for key zone retest`
    recommendationKey  = 'smc_rec_moderate'
  } else if (probability >= 45) {
    recommendation     = 'Mixed signals — observe, do not trade'
    recommendationKey  = 'smc_rec_mixed'
  } else {
    recommendation     = 'Low probability — skip this setup'
    recommendationKey  = 'smc_rec_low'
  }

  const dirEmoji = (s: string) =>
    s === 'LONG' ? '🟢 LONG' : s === 'SHORT' ? '🔴 SHORT' : '⚪ NEUTRAL'

  const alerts: Alert[] = []

  if (f1 >= 15 && probability >= 45) {
    alerts.push({
      stage: 1, level: 'watchlist', color: 'yellow',
      message: `${dirEmoji(scenario)} forming — HTF structure confirms ${htfBias}`,
      htfBiasVal: htfBias,
      price, type: scenario === 'NEUTRAL' ? 'LONG' : scenario, confidence: Math.round(probability * 0.7),
    })
  }

  if (probability >= 60 && riskReward >= 1.5 && confluence >= 2) {
    alerts.push({
      stage: 2, level: 'setup_ready', color: 'orange',
      message: `Setup ready: ${scenario} | Confluence ${confluence} zones | R:R ${riskReward}`,
      confluenceCount: confluence,
      price, type: scenario === 'NEUTRAL' ? 'LONG' : scenario, confidence: Math.round(probability * 0.85),
    })
  }

  if (sweepCount >= 1 && probability >= 70 && (nearBullOBs > 0 || nearBearOBs > 0)) {
    alerts.push({
      stage: 3, level: 'execute', color: scenario === 'LONG' ? 'green' : 'red',
      message: `TRIGGER: ${scenario} | Liquidity sweep + OB retest | Confidence ${confidence}%`,
      price, type: scenario === 'NEUTRAL' ? 'LONG' : scenario, confidence,
    })
  }

  return {
    scenario, probability, confidence, riskReward, expectedR, recommendation, recommendationKey,
    factors: { htfStructure: f1, confluenceZones: f2, volumeProfile: f3, temporalContext: f4, historicalStats: f5, marketSentiment: f6 },
    alerts,
  }
}

export function scoreOrderBlock(ob: OrderBlock): {
  score: number
  factors: Record<string, number>
  verdict: string
} {
  const f: Record<string, number> = {}

  f.freshness = ob.touchCount === 0 ? 30 : ob.touchCount === 1 ? 15 : ob.touchCount === 2 ? 5 : 0

  f.volume = ob.relVolume >= 2.5 ? 20 : ob.relVolume >= 2.0 ? 17 : ob.relVolume >= 1.5 ? 13 : ob.relVolume >= 1.0 ? 7 : 2

  f.impulse = ob.impulseSize >= 3 ? 20 : ob.impulseSize >= 2 ? 15 : ob.impulseSize >= 1 ? 9 : 3

  f.recency = ob.ageCandles <= 5 ? 15 : ob.ageCandles <= 15 ? 11 : ob.ageCandles <= 30 ? 7 : ob.ageCandles <= 60 ? 4 : 1

  f.quality = ob.quality === 'A+' ? 15 : ob.quality === 'A' ? 10 : ob.quality === 'B' ? 3 : 0

  const score = Math.min(100, Math.round(Object.values(f).reduce((a, b) => a + b, 0)))
  const verdict =
    score >= 80 ? '🟢 High reliability' :
    score >= 60 ? '🟡 Moderate reliability' :
    score >= 40 ? '🟠 Weak reliability' :
                  '🔴 Low reliability'

  return { score, factors: f, verdict }
}
