import type { Candle } from './analysis'

export interface MethodResult {
  method: string
  signal: 'LONG' | 'SHORT' | 'WAIT'
  confidence: number
  factors: string[]
  summary: string
}

function ema(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1]
  const smoothing = 2 / (period + 1)
  let emaVal = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) emaVal = closes[i] * smoothing + emaVal * (1 - smoothing)
  return emaVal
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta > 0) gains += delta; else losses -= delta
  }
  let avgGain = gains / period, avgLoss = losses / period
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

function bollingerBands(closes: number[], period = 20, mult = 2) {
  const band = closes.slice(-period)
  if (band.length < period) return null
  const mid = band.reduce((a, b) => a + b, 0) / period
  const std = Math.sqrt(band.reduce((a, b) => a + (b - mid) ** 2, 0) / period)
  return { upper: mid + mult * std, lower: mid - mult * std, mid, std, width: (4 * std / mid) * 100 }
}

function macdLine(closes: number[]): number { return ema(closes, 12) - ema(closes, 26) }

function stochRSI(closes: number[], period = 14): number {
  if (closes.length < period * 2) return 50
  const rsiArr: number[] = []
  for (let i = period; i <= closes.length; i++) rsiArr.push(rsi(closes.slice(0, i), period))
  const rsiSlice = rsiArr.slice(-period)
  const minRsi = Math.min(...rsiSlice), maxRsi = Math.max(...rsiSlice)
  if (maxRsi === minRsi) return 50
  return ((rsiArr[rsiArr.length - 1] - minRsi) / (maxRsi - minRsi)) * 100
}

export function analyzeIndicators(candles: Candle[]): MethodResult {
  const closes   = candles.map(c => c.close)
  const price    = closes[closes.length - 1]
  const rsiVal   = rsi(closes)
  const ema50    = ema(closes, 50)
  const ema200   = ema(closes, 200)
  const macd     = macdLine(closes)
  const prevMacd = macdLine(closes.slice(0, -1))
  const bb       = bollingerBands(closes)
  const stoch    = stochRSI(closes)

  const recentVols = candles.slice(-10).map(c => c.volume)
  const avgVol = recentVols.slice(0, -1).reduce((a, b) => a + b, 0) / (recentVols.length - 1)
  const volSurge = recentVols[recentVols.length - 1] > avgVol * 1.3

  let score = 0
  const longFactors: string[] = []
  const shortFactors: string[] = []

  if (rsiVal < 30) { score += 25; longFactors.push(`RSI ${rsiVal.toFixed(1)} — oversold`) }
  else if (rsiVal < 40) { score += 10; longFactors.push(`RSI ${rsiVal.toFixed(1)} — moderately oversold`) }
  else if (rsiVal > 70) { score -= 25; shortFactors.push(`RSI ${rsiVal.toFixed(1)} — overbought`) }
  else if (rsiVal > 60) { score -= 10; shortFactors.push(`RSI ${rsiVal.toFixed(1)} — moderately overbought`) }

  if (price > ema50 && ema50 > ema200) { score += 20; longFactors.push('EMA50 > EMA200 — bullish тренд') }
  else if (price < ema50 && ema50 < ema200) { score -= 20; shortFactors.push('EMA50 < EMA200 — bearish trend') }
  else if (price > ema50) { score += 8; longFactors.push('Price above EMA50') }
  else if (price < ema50) { score -= 8; shortFactors.push('Price below EMA50') }

  if (macd > 0 && macd > prevMacd) { score += 15; longFactors.push('MACD bullish и растёт') }
  else if (macd < 0 && macd < prevMacd) { score -= 15; shortFactors.push('MACD bearish and falling') }
  else if (macd > 0) { score += 7; longFactors.push('MACD positive') }
  else if (macd < 0) { score -= 7; shortFactors.push('MACD negative') }

  if (bb) {
    if (price <= bb.lower) { score += 20; longFactors.push(`Price at lower BB ($${bb.lower.toFixed(2)})`) }
    else if (price >= bb.upper) { score -= 20; shortFactors.push(`Price at upper BB ($${bb.upper.toFixed(2)})`) }
  }

  if (stoch < 20) { score += 10; longFactors.push(`StochRSI ${stoch.toFixed(0)} — oversold zone`) }
  else if (stoch > 80) { score -= 10; shortFactors.push(`StochRSI ${stoch.toFixed(0)} — зона overboughtности`) }

  if (volSurge) {
    if (score > 0) { score += 10; longFactors.push('Volume confirms upward move') }
    else if (score < 0) { score -= 10; shortFactors.push('Volume confirms downward move') }
  }

  const absScore = Math.abs(score)
  const confidence = Math.min(95, Math.max(20, 30 + absScore))

  if (score >= 25 && absScore >= 25) {
    return {
      method: 'Indicators',
      signal: 'LONG',
      confidence,
      factors: longFactors,
      summary: `RSI ${rsiVal.toFixed(1)}, MACD ${macd > 0 ? 'bullish' : 'bearish'}, EMA: ${price > ema50 ? 'above 50' : 'below 50'}`,
    }
  }
  if (score <= -25 && absScore >= 25) {
    return {
      method: 'Indicators',
      signal: 'SHORT',
      confidence,
      factors: shortFactors,
      summary: `RSI ${rsiVal.toFixed(1)}, MACD ${macd < 0 ? 'bearish' : 'bullish'}, EMA: ${price < ema50 ? 'below 50' : 'above 50'}`,
    }
  }
  return {
    method: 'Indicators',
    signal: 'WAIT',
    confidence: 35,
    factors: ['Mixed indicator signals', `RSI ${rsiVal.toFixed(1)}`],
    summary: `No clear signal. RSI ${rsiVal.toFixed(1)}, MACD ${macd > 0 ? 'neutral+' : 'neutral-'}`,
  }
}

export function analyzePriceAction(candles: Candle[]): MethodResult {
  if (candles.length < 5) {
    return { method: 'Price Action', signal: 'WAIT', confidence: 30, factors: ['Insufficient data'], summary: 'Not enough candles' }
  }

  const last  = candles[candles.length - 1]
  const prev  = candles[candles.length - 2]
  const prev2 = candles[candles.length - 3]

  const body      = Math.abs(last.close - last.open)
  const range     = last.high - last.low
  const bullish   = last.close > last.open
  const upperWick = last.high - Math.max(last.open, last.close)
  const lowerWick = Math.min(last.open, last.close) - last.low
  const bodyRatio = range > 0 ? body / range : 0

  const patterns: string[] = []
  let signal: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT'
  let confidence = 35

  if (bullish && lowerWick >= body * 2 && upperWick <= body * 0.3 && bodyRatio < 0.4) {
    patterns.push('Hammer (bullish разворот)')
    signal = 'LONG'; confidence = Math.max(confidence, 62)
  }

  if (!bullish && upperWick >= body * 2 && lowerWick <= body * 0.3 && bodyRatio < 0.4) {
    patterns.push('Shooting Star (bearish reversal)')
    signal = 'SHORT'; confidence = Math.max(confidence, 62)
  }

  if (bullish && !(prev.close > prev.open) &&
      last.open <= prev.close && last.close >= prev.open &&
      body > Math.abs(prev.close - prev.open)) {
    patterns.push('Bullish Engulfing')
    signal = 'LONG'; confidence = Math.max(confidence, 70)
  }

  if (!bullish && (prev.close > prev.open) &&
      last.open >= prev.close && last.close <= prev.open &&
      body > Math.abs(prev.close - prev.open)) {
    patterns.push('Bearish Engulfing')
    signal = 'SHORT'; confidence = Math.max(confidence, 70)
  }

  if (lowerWick > range * 0.6 && body < range * 0.25) {
    patterns.push('bullish Pin Bar')
    signal = 'LONG'; confidence = Math.max(confidence, 65)
  }

  if (upperWick > range * 0.6 && body < range * 0.25) {
    patterns.push('Bearish Pin Bar')
    signal = 'SHORT'; confidence = Math.max(confidence, 65)
  }

  if (bodyRatio < 0.1) {
    const closes = candles.slice(-20).map(c => c.close)
    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length
    if (last.close < avgClose * 0.99) { patterns.push('Doji at support'); signal = 'LONG'; confidence = Math.max(confidence, 55) }
    else if (last.close > avgClose * 1.01) { patterns.push('Doji at resistance'); signal = 'SHORT'; confidence = Math.max(confidence, 55) }
    else { patterns.push('Doji (indecision)') }
  }

  if (!(prev2.close > prev2.open) && Math.abs(prev.close - prev.open) < Math.abs(prev2.close - prev2.open) * 0.3 && bullish &&
      last.close > (prev2.open + prev2.close) / 2) {
    patterns.push('Morning Star (bullish разворот 3 свечи)')
    signal = 'LONG'; confidence = Math.max(confidence, 72)
  }

  if ((prev2.close > prev2.open) && Math.abs(prev.close - prev.open) < Math.abs(prev2.close - prev2.open) * 0.3 && !bullish &&
      last.close < (prev2.open + prev2.close) / 2) {
    patterns.push('Evening Star (bearish reversal, 3 candles)')
    signal = 'SHORT'; confidence = Math.max(confidence, 72)
  }

  if (bodyRatio > 0.85 && body > 0) {
    if (bullish) { patterns.push('Bullish Marubozu (сильный bullish импульс)'); signal = 'LONG'; confidence = Math.max(confidence, 68) }
    else { patterns.push('Bearish Marubozu (strong bearish momentum)'); signal = 'SHORT'; confidence = Math.max(confidence, 68) }
  }

  if (patterns.length === 0) {
    patterns.push('No clear pattern')
  }

  return {
    method: 'Price Action',
    signal,
    confidence: patterns[0] === 'No clear pattern' ? 30 : confidence,
    factors: patterns,
    summary: patterns.join(', '),
  }
}

export function analyzeWyckoff(candles: Candle[]): MethodResult {
  if (candles.length < 50) {
    return { method: 'Wyckoff', signal: 'WAIT', confidence: 30, factors: ['Insufficient data'], summary: 'Not enough candles для Wyckoff' }
  }

  const price    = candles[candles.length - 1].close
  const lookback = candles.slice(-50)
  const rangeHigh = Math.max(...lookback.map(c => c.high))
  const rangeLow  = Math.min(...lookback.map(c => c.low))
  const rangeSize = rangeHigh - rangeLow

  const recentHigh  = Math.max(...candles.slice(-10).map(c => c.high))
  const recentLow   = Math.min(...candles.slice(-10).map(c => c.low))
  const recentRange = recentHigh - recentLow
  const totalRange  = Math.max(...candles.slice(-30).map(c => c.high)) - Math.min(...candles.slice(-30).map(c => c.low))

  const compression = recentRange < totalRange * 0.35

  const avgVol      = lookback.slice(0, 40).map(c => c.volume).reduce((a, b) => a + b, 0) / 40
  const recentAvgVol = lookback.slice(-10).map(c => c.volume).reduce((a, b) => a + b, 0) / 10
  const volDecline  = recentAvgVol < avgVol * 0.7

  const last5Low   = Math.min(...candles.slice(-5).map(c => c.low))
  const last5Close = candles[candles.length - 1].close
  const prevLows   = candles.slice(-20, -5).map(c => c.low)
  const prevLowMin = Math.min(...prevLows)

  const springDetected   = last5Low < prevLowMin * 0.995 && last5Close > prevLowMin && volDecline
  const upthrustDetected = Math.max(...candles.slice(-5).map(c => c.high)) > Math.max(...candles.slice(-20, -5).map(c => c.high)) * 1.005
    && last5Close < Math.max(...candles.slice(-20, -5).map(c => c.high)) && volDecline

  const posInRange = rangeSize > 0 ? (price - rangeLow) / rangeSize : 0.5
  const factors: string[] = []
  let signal: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT'
  let confidence = 35

  if (springDetected) {
    factors.push('Spring detected (Phase C — Wyckoff)')
    factors.push(`Price broke support $${prevLowMin.toFixed(2)} and recovered`)
    signal = 'LONG'; confidence = 72
  } else if (upthrustDetected) {
    factors.push('Upthrust detected (Phase C — Wyckoff)')
    factors.push('Price broke resistance and returned')
    signal = 'SHORT'; confidence = 70
  } else if (compression && volDecline) {
    if (posInRange < 0.35) {
      factors.push('Accumulation Phase (B) — price in lower range')
      factors.push('Сжатие волатильности + падение объёма')
      signal = 'LONG'; confidence = 55
    } else if (posInRange > 0.65) {
      factors.push('Distribution Phase (B) — price in upper range')
      factors.push('Сжатие волатильности + падение объёма')
      signal = 'SHORT'; confidence = 55
    } else {
      factors.push('Wyckoff: sideways consolidation, no clear direction')
    }
  } else {
    const closes30  = candles.slice(-30).map(c => c.close)
    const firstHalf = closes30.slice(0, 15).reduce((a, b) => a + b, 0) / 15
    const secondHalf = closes30.slice(15).reduce((a, b) => a + b, 0) / 15
    if (secondHalf > firstHalf * 1.02) {
      factors.push('Wyckoff Markup Phase — uptrend')
      signal = 'LONG'; confidence = 58
    } else if (secondHalf < firstHalf * 0.98) {
      factors.push('Wyckoff Markdown Phase — downtrend')
      signal = 'SHORT'; confidence = 58
    } else {
      factors.push('Wyckoff: no clear phase')
    }
  }

  factors.push(`Range: $${rangeLow.toFixed(2)}–$${rangeHigh.toFixed(2)} | Position: ${(posInRange * 100).toFixed(0)}%`)

  return {
    method: 'Wyckoff',
    signal,
    confidence,
    factors,
    summary: factors[0],
  }
}

export function analyzeVolumeProfile(candles: Candle[]): MethodResult {
  if (candles.length < 20) {
    return { method: 'Volume Profile', signal: 'WAIT', confidence: 30, factors: ['Insufficient data'], summary: 'No data' }
  }

  const price = candles[candles.length - 1].close
  const slice = candles.slice(-50)
  const totalVolume = slice.reduce((a, c) => a + c.volume, 0)
  const vwap = slice.reduce((a, c) => a + ((c.high + c.low + c.close) / 3) * c.volume, 0) / totalVolume

  const poc     = [...slice].sort((a, b) => b.volume - a.volume)[0]
  const pocPrice = (poc.high + poc.low) / 2

  const sorted    = [...slice].sort((a, b) => ((b.high + b.low) / 2) - ((a.high + a.low) / 2))
  let cumVol = 0
  const targetVol = totalVolume * 0.7
  let vah = 0, val = 0
  for (const c of sorted) {
    cumVol += c.volume
    if (cumVol <= targetVol * 0.5 && vah === 0) vah = (c.high + c.low) / 2
    if (cumVol >= targetVol && val === 0) val = (c.high + c.low) / 2
  }
  if (val === 0) val = Math.min(...slice.map(c => (c.high + c.low) / 2))
  if (vah === 0) vah = Math.max(...slice.map(c => (c.high + c.low) / 2))

  const factors: string[] = []
  let signal: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT'
  let confidence = 35

  const vwapDist = ((price - vwap) / vwap) * 100
  if (price < vwap * 0.99) {
    factors.push(`Цена ниже VWAP ($${vwap.toFixed(2)}) на ${Math.abs(vwapDist).toFixed(1)}% — bearish bias`)
    signal = 'SHORT'; confidence = Math.max(confidence, 55)
  } else if (price > vwap * 1.01) {
    factors.push(`Цена выше VWAP ($${vwap.toFixed(2)}) на ${vwapDist.toFixed(1)}% — bullish bias`)
    signal = 'LONG'; confidence = Math.max(confidence, 55)
  } else {
    factors.push(`Цена у VWAP ($${vwap.toFixed(2)}) — neutral zone`)
  }

  const pocDist = ((price - pocPrice) / pocPrice) * 100
  if (Math.abs(pocDist) < 0.5) {
    factors.push(`Цена у POC ($${pocPrice.toFixed(2)}) — maximum volume zone`)
  } else if (price < pocPrice) {
    factors.push(`Цена ниже POC ($${pocPrice.toFixed(2)}) — gravitating to level`)
    if (signal === 'SHORT') confidence = Math.min(confidence + 10, 85)
  } else {
    factors.push(`Цена выше POC ($${pocPrice.toFixed(2)}) — gravitating to level`)
    if (signal === 'LONG') confidence = Math.min(confidence + 10, 85)
  }

  if (price <= val * 1.005) {
    factors.push(`Цена у VAL ($${val.toFixed(2)}) — lower value area boundary — support`)
    signal = 'LONG'; confidence = Math.max(confidence, 65)
  } else if (price >= vah * 0.995) {
    factors.push(`Цена у VAH ($${vah.toFixed(2)}) — upper value area boundary — resistance`)
    signal = 'SHORT'; confidence = Math.max(confidence, 65)
  }

  const recentVols = candles.slice(-5).map(c => c.volume)
  const avgRecentVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length
  if (avgRecentVol > totalVolume / slice.length * 1.5) {
    factors.push('Volume surge confirms direction')
    confidence = Math.min(confidence + 8, 85)
  }

  return {
    method: 'Volume Profile',
    signal,
    confidence,
    factors,
    summary: `VWAP $${vwap.toFixed(2)} | POC $${pocPrice.toFixed(2)} | VAH $${vah.toFixed(2)} | VAL $${val.toFixed(2)}`,
  }
}

export function analyzeFunding(fundingRate: number | null): MethodResult {
  if (fundingRate === null) {
    return {
      method: 'Funding Rate',
      signal: 'WAIT',
      confidence: 30,
      factors: ['Данные фандинга недоступны (только для фьючерсов)'],
      summary: 'No data',
    }
  }

  const rate = fundingRate
  const factors: string[] = [`Funding Rate: ${rate.toFixed(4)}%`]
  let signal: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT'
  let confidence = 35

  if (rate > 0.1) {
    factors.push('EXTREME long overheating — high probability of downward squeeze')
    factors.push('Market makers will hunt long stops')
    signal = 'SHORT'; confidence = 72
  } else if (rate > 0.05) {
    factors.push('Longs overheated — bearish pressure through expensive funding')
    signal = 'SHORT'; confidence = 60
  } else if (rate > 0.02) {
    factors.push('Weak bullish imbalance — moderate bearish bias')
    signal = 'SHORT'; confidence = 45
  } else if (rate < -0.05) {
    factors.push('EXTREME short overheating — high probability of upward squeeze')
    factors.push('Shorts paying longs — upward squeeze likely')
    signal = 'LONG'; confidence = 72
  } else if (rate < -0.01) {
    factors.push('Shorts overheated — bullish pressure through expensive funding')
    signal = 'LONG'; confidence = 60
  } else {
    factors.push(`Neutral funding (${rate.toFixed(4)}%) — no imbalance`)
    signal = 'WAIT'; confidence = 40
  }

  return {
    method: 'Funding Rate',
    signal,
    confidence,
    factors,
    summary: `Funding ${rate.toFixed(4)}% → ${signal === 'LONG' ? 'squeeze up' : signal === 'SHORT' ? 'squeeze down' : 'neutral'}`,
  }
}

export interface ConsensusResult {
  long: number
  short: number
  wait: number
  threshold: number
  decision: 'LONG' | 'SHORT' | 'WAIT'
  avgConfidenceLong: number
  avgConfidenceShort: number
  agreeing: string[]
  disagreeing: string[]
}

export function calcConsensus(methods: MethodResult[], threshold = 3): ConsensusResult {
  const long  = methods.filter(m => m.signal === 'LONG')
  const short = methods.filter(m => m.signal === 'SHORT')
  const wait  = methods.filter(m => m.signal === 'WAIT')

  const avgConfLong  = long.length  ? long.reduce((a, m) => a + m.confidence, 0) / long.length : 0
  const avgConfShort = short.length ? short.reduce((a, m) => a + m.confidence, 0) / short.length : 0

  let decision: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT'

  if (long.length >= threshold && long.length > short.length) {
    decision = 'LONG'
  } else if (short.length >= threshold && short.length > long.length) {
    decision = 'SHORT'
  }

  const agreeing    = methods.filter(m => m.signal === decision).map(m => m.method)
  const disagreeing = methods.filter(m => m.signal !== decision && decision !== 'WAIT').map(m => m.method)

  return {
    long: long.length, short: short.length, wait: wait.length,
    threshold, decision, avgConfidenceLong: Math.round(avgConfLong),
    avgConfidenceShort: Math.round(avgConfShort),
    agreeing, disagreeing,
  }
}
