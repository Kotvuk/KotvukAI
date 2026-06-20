import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '..', '.bt-cache')

const METHOD = process.argv[2]
const VALID_METHODS = ['Indicators', 'PriceAction', 'Derivatives', 'VolumeProfile', 'Funding', 'SMC']

if (!METHOD || !VALID_METHODS.includes(METHOD)) {
  console.error(`Usage: node scripts/bt-sweep.mjs <${VALID_METHODS.join('|')}>`)
  process.exit(1)
}

if (!fs.existsSync(CACHE_DIR)) {
  console.error(`Cache not found: ${CACHE_DIR}. Run scripts/bt-fetch.mjs first.`)
  process.exit(1)
}

const WARMUP    = 150
const SL_MULT   = 1.5
const TP_MULT   = 3.0
const MIN_CONF  = 50
const MAX_OPEN  = 200
const TRAIN_PCT = 0.7

function calcATR(candles, period = 14) {
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low  - candles[i - 1].close),
    )
    trs.push(tr)
  }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length || 0.01
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

function runBacktest(candles, oiHist, lsRatio, alignedFunding, getSignal) {
  const trainEnd = Math.floor(candles.length * TRAIN_PCT)
  const trainResult = simulate(candles.slice(0, trainEnd), oiHist, lsRatio, alignedFunding?.slice(0, trainEnd), getSignal)
  const testResult  = simulate(candles.slice(trainEnd - WARMUP), oiHist, lsRatio, alignedFunding?.slice(trainEnd - WARMUP), getSignal)
  return { train: trainResult, test: testResult }
}

function simulate(candles, oiHist, lsRatio, alignedFunding, getSignal) {
  let trades = 0, wins = 0, sumPnl = 0
  let openTrade = null
  let openSince = 0

  for (let i = WARMUP; i < candles.length - 1; i++) {
    if (openTrade) {
      if (i - openSince > MAX_OPEN) {
        openTrade = null
        continue
      }
      const c = candles[i]
      const hitTP = openTrade.dir === 'LONG' ? c.high >= openTrade.tp : c.low <= openTrade.tp
      const hitSL = openTrade.dir === 'LONG' ? c.low  <= openTrade.sl : c.high >= openTrade.sl

      if (hitTP && hitSL) {
        const next = candles[i + 1]
        if (next) {
          const bull = next.close > next.open
          const isWin = (openTrade.dir === 'LONG' && bull) || (openTrade.dir === 'SHORT' && !bull)
          const pnl = isWin ? (openTrade.tp - openTrade.entry) / openTrade.entry * 100 * (openTrade.dir === 'LONG' ? 1 : -1)
                             : (openTrade.sl - openTrade.entry) / openTrade.entry * 100 * (openTrade.dir === 'LONG' ? 1 : -1)
          trades++
          if (pnl > 0) wins++
          sumPnl += pnl
        }
        openTrade = null
        continue
      }

      if (hitTP) {
        const pnl = Math.abs(openTrade.tp - openTrade.entry) / openTrade.entry * 100
        trades++; wins++; sumPnl += pnl
        openTrade = null
        continue
      }
      if (hitSL) {
        const pnl = -Math.abs(openTrade.sl - openTrade.entry) / openTrade.entry * 100
        trades++; sumPnl += pnl
        openTrade = null
        continue
      }
      continue
    }

    const slice = candles.slice(0, i + 1)
    const fr = alignedFunding ? (alignedFunding[i] ?? null) : null
    const result = getSignal(slice, oiHist, lsRatio, fr)

    if (!result || result.signal === 'WAIT' || result.confidence < MIN_CONF) continue

    const atr = calcATR(slice.slice(-20))
    const entry = candles[i].close
    const sl = result.signal === 'LONG' ? entry - SL_MULT * atr : entry + SL_MULT * atr
    const tp = result.signal === 'LONG' ? entry + TP_MULT * atr : entry - TP_MULT * atr

    openTrade = { dir: result.signal, entry, sl, tp }
    openSince = i
  }

  const wr = trades > 0 ? (wins / trades * 100) : 0
  const avgPnl = trades > 0 ? sumPnl / trades : 0
  return { trades, wins, wr: parseFloat(wr.toFixed(1)), sumPnl: parseFloat(sumPnl.toFixed(2)), avgPnl: parseFloat(avgPnl.toFixed(2)) }
}

function buildIndicatorsSignal(params) {
  return (candles) => {
    const closes = candles.map(c => c.close)
    const price  = closes[closes.length - 1]

    const rsiPeriod = params.rsiPeriod ?? 14
    const rsiLow    = params.rsiLow    ?? 30
    const rsiHigh   = params.rsiHigh   ?? 70
    const threshold = params.scoreThreshold ?? 25
    const volSurgeMulti = params.volSurge ?? 1.3

    const rsiVal = calcRSI(closes, rsiPeriod)
    const ema50  = calcEMA(closes, 50)
    const ema200 = calcEMA(closes, 200)
    const macd   = calcEMA(closes, 12) - calcEMA(closes, 26)
    const prevM  = calcEMA(closes.slice(0, -1), 12) - calcEMA(closes.slice(0, -1), 26)
    const bb     = calcBB(closes)
    const stoch  = calcStochRSI(closes, rsiPeriod)

    const recentVols = candles.slice(-10).map(c => c.volume)
    const avgVol = recentVols.slice(0, -1).reduce((a, b) => a + b, 0) / (recentVols.length - 1)
    const volSurge = recentVols[recentVols.length - 1] > avgVol * volSurgeMulti

    let score = 0
    if (rsiVal < rsiLow)        score += 25
    else if (rsiVal < rsiLow+10) score += 10
    else if (rsiVal > rsiHigh)   score -= 25
    else if (rsiVal > rsiHigh-10) score -= 10

    if (price > ema50 && ema50 > ema200)      score += 20
    else if (price < ema50 && ema50 < ema200)  score -= 20
    else if (price > ema50) score += 8
    else if (price < ema50) score -= 8

    if (macd > 0 && macd > prevM)       score += 15
    else if (macd < 0 && macd < prevM)  score -= 15
    else if (macd > 0) score += 7
    else if (macd < 0) score -= 7

    if (bb) {
      if (price <= bb.lower) score += 20
      else if (price >= bb.upper) score -= 20
    }

    if (stoch < 20) score += 10
    else if (stoch > 80) score -= 10

    if (volSurge) { if (score > 0) score += 10; else if (score < 0) score -= 10 }

    const abs = Math.abs(score)
    const confidence = Math.min(95, Math.max(20, 30 + abs))

    if (score >= threshold && abs >= threshold) return { signal: 'LONG', confidence }
    if (score <= -threshold && abs >= threshold) return { signal: 'SHORT', confidence }
    return { signal: 'WAIT', confidence: 35 }
  }
}

function buildPriceActionSignal(params) {
  return (candles) => {
    if (candles.length < 5) return { signal: 'WAIT', confidence: 30 }
    const last  = candles[candles.length - 1]
    const prev  = candles[candles.length - 2]
    const prev2 = candles[candles.length - 3]
    const wickMult    = params.wickMult    ?? 2
    const bodyRatioMax = params.bodyRatioMax ?? 0.4

    const body      = Math.abs(last.close - last.open)
    const range     = last.high - last.low
    const bullish   = last.close > last.open
    const upperWick = last.high - Math.max(last.open, last.close)
    const lowerWick = Math.min(last.open, last.close) - last.low
    const bodyRatio = range > 0 ? body / range : 0

    let signal = 'WAIT'
    let confidence = 35

    if (bullish && lowerWick >= body * wickMult && upperWick <= body * 0.3 && bodyRatio < bodyRatioMax) { signal = 'LONG'; confidence = 62 }
    if (!bullish && upperWick >= body * wickMult && lowerWick <= body * 0.3 && bodyRatio < bodyRatioMax) { signal = 'SHORT'; confidence = 62 }
    if (bullish && !(prev.close > prev.open) && last.open <= prev.close && last.close >= prev.open && body > Math.abs(prev.close - prev.open)) { signal = 'LONG'; confidence = 70 }
    if (!bullish && (prev.close > prev.open) && last.open >= prev.close && last.close <= prev.open && body > Math.abs(prev.close - prev.open)) { signal = 'SHORT'; confidence = 70 }
    if (lowerWick > range * 0.6 && body < range * 0.25) { signal = 'LONG'; confidence = Math.max(confidence, 65) }
    if (upperWick > range * 0.6 && body < range * 0.25) { signal = 'SHORT'; confidence = Math.max(confidence, 65) }
    if (!(prev2.close > prev2.open) && Math.abs(prev.close - prev.open) < Math.abs(prev2.close - prev2.open) * 0.3 && bullish && last.close > (prev2.open + prev2.close) / 2) { signal = 'LONG'; confidence = Math.max(confidence, 72) }
    if ((prev2.close > prev2.open) && Math.abs(prev.close - prev.open) < Math.abs(prev2.close - prev2.open) * 0.3 && !bullish && last.close < (prev2.open + prev2.close) / 2) { signal = 'SHORT'; confidence = Math.max(confidence, 72) }
    if (bodyRatio > 0.85 && body > 0) { signal = bullish ? 'LONG' : 'SHORT'; confidence = Math.max(confidence, 68) }

    return { signal, confidence }
  }
}

function buildDerivativesSignal(params) {
  return (candles, oiHist, lsRatio) => {
    if (!oiHist || oiHist.length < 2) return { signal: 'WAIT', confidence: 25 }
    const oiThreshold = params.oiThreshold ?? 1
    const oiStrong    = params.oiStrong    ?? 3
    const lsHigh      = params.lsHigh      ?? 2.2
    const lsLow       = params.lsLow       ?? 0.7

    const oiFirst = oiHist[0].sumOpenInterest
    const oiLast  = oiHist[oiHist.length - 1].sumOpenInterest
    const oiDelta = oiFirst > 0 ? ((oiLast - oiFirst) / oiFirst) * 100 : 0

    const periodMs = oiHist.length > 1 ? oiHist[1].timestamp - oiHist[0].timestamp : 900000
    const spanMs   = oiHist[oiHist.length - 1].timestamp - oiHist[0].timestamp
    const cnt      = Math.max(2, Math.round(spanMs / Math.max(1, periodMs)) + 1)
    const priceSlice = candles.slice(-cnt)
    const pFirst = priceSlice[0]?.close ?? candles[0].close
    const pLast  = priceSlice[priceSlice.length - 1]?.close ?? candles[candles.length - 1].close
    const pDelta = pFirst > 0 ? ((pLast - pFirst) / pFirst) * 100 : 0

    const abs = Math.abs(oiDelta)
    let confidence = abs > oiStrong ? 65 : abs > oiThreshold ? 50 : 35
    let signal = 'WAIT'

    if (oiDelta > oiThreshold && pDelta > 0) signal = 'LONG'
    else if (oiDelta > oiThreshold && pDelta < 0) signal = 'SHORT'
    else if (oiDelta < -oiThreshold) { signal = 'WAIT'; confidence = Math.min(confidence, 35) }

    if (lsRatio && lsRatio.length > 0) {
      const avg = lsRatio.reduce((a, p) => a + p.longShortRatio, 0) / lsRatio.length
      if (avg > lsHigh) {
        if (signal === 'LONG') { signal = 'WAIT'; confidence = Math.min(confidence, 40) }
        else if (signal === 'WAIT') { signal = 'SHORT'; confidence = Math.max(confidence, 45) }
      } else if (avg < lsLow) {
        if (signal === 'SHORT') { signal = 'WAIT'; confidence = Math.min(confidence, 40) }
        else if (signal === 'WAIT') { signal = 'LONG'; confidence = Math.max(confidence, 45) }
      }
    }

    return { signal, confidence }
  }
}

function buildVolumeProfileSignal(params) {
  return (candles) => {
    if (candles.length < 20) return { signal: 'WAIT', confidence: 30 }
    const lookback    = params.lookback    ?? 50
    const vwapBand    = params.vwapBand    ?? 0.01
    const valueAreaPct = params.valueAreaPct ?? 0.7
    const volSurgeMult = params.volSurge   ?? 1.5

    const price = candles[candles.length - 1].close
    const slice = candles.slice(-lookback)
    const totalVol = slice.reduce((a, c) => a + c.volume, 0)
    const vwap = slice.reduce((a, c) => a + ((c.high + c.low + c.close) / 3) * c.volume, 0) / totalVol

    const sorted = [...slice].sort((a, b) => ((b.high + b.low) / 2) - ((a.high + a.low) / 2))
    let cumVol = 0, vah = 0, val = 0
    const targetVol = totalVol * valueAreaPct
    for (const c of sorted) {
      cumVol += c.volume
      if (cumVol <= targetVol * 0.5 && vah === 0) vah = (c.high + c.low) / 2
      if (cumVol >= targetVol && val === 0) val = (c.high + c.low) / 2
    }
    if (val === 0) val = Math.min(...slice.map(c => (c.high + c.low) / 2))
    if (vah === 0) vah = Math.max(...slice.map(c => (c.high + c.low) / 2))

    let signal = 'WAIT'
    let confidence = 35

    if (price < vwap * (1 - vwapBand)) { signal = 'SHORT'; confidence = 55 }
    else if (price > vwap * (1 + vwapBand)) { signal = 'LONG'; confidence = 55 }

    if (price <= val * 1.005) { signal = 'LONG'; confidence = Math.max(confidence, 65) }
    else if (price >= vah * 0.995) { signal = 'SHORT'; confidence = Math.max(confidence, 65) }

    const recentVols = candles.slice(-5).map(c => c.volume)
    const avgRecent  = recentVols.reduce((a, b) => a + b, 0) / recentVols.length
    if (avgRecent > totalVol / slice.length * volSurgeMult) confidence = Math.min(confidence + 8, 85)

    return { signal, confidence }
  }
}

function buildFundingSignal(params) {
  return (candles, _oi, _ls, fr) => {
    if (fr === null || fr === undefined) return { signal: 'WAIT', confidence: 30 }
    const scale = params.scale ?? 1
    const thrExtreme    = (params.thrExtreme    ?? 0.1)   * scale
    const thrHigh       = (params.thrHigh       ?? 0.05)  * scale
    const thrMid        = (params.thrMid        ?? 0.02)  * scale
    const thrLowNeg     = (params.thrLowNeg     ?? -0.01) * scale
    const thrExtremeNeg = (params.thrExtremeNeg ?? -0.05) * scale

    if (fr > thrExtreme)     return { signal: 'SHORT', confidence: 72 }
    if (fr > thrHigh)        return { signal: 'SHORT', confidence: 60 }
    if (fr > thrMid)         return { signal: 'SHORT', confidence: 45 }
    if (fr < thrExtremeNeg)  return { signal: 'LONG',  confidence: 72 }
    if (fr < thrLowNeg)      return { signal: 'LONG',  confidence: 60 }
    return { signal: 'WAIT', confidence: 40 }
  }
}

function buildSMCSignal() {
  return (candles) => {
    if (candles.length < 30) return { signal: 'WAIT', confidence: 30 }
    const last10 = candles.slice(-10)
    const last30 = candles.slice(-30)
    const hhs = last10.filter((c, i) => i > 0 && c.high > last10[i - 1].high).length
    const lls = last10.filter((c, i) => i > 0 && c.low  < last10[i - 1].low).length
    const htfHHs = last30.filter((c, i) => i > 0 && c.high > last30[i - 1].high).length
    const htfLLs = last30.filter((c, i) => i > 0 && c.low  < last30[i - 1].low).length
    const htfBias = htfHHs > htfLLs * 1.4 ? 'bullish' : htfLLs > htfHHs * 1.4 ? 'bearish' : 'neutral'
    const trend   = hhs > 6 ? 'bullish' : lls > 6 ? 'bearish' : 'ranging'
    if (htfBias === 'neutral' || trend === 'ranging') return { signal: 'WAIT', confidence: 35 }
    if (htfBias === 'bullish' && trend === 'bullish') return { signal: 'LONG',  confidence: 60 }
    if (htfBias === 'bearish' && trend === 'bearish') return { signal: 'SHORT', confidence: 60 }
    return { signal: 'WAIT', confidence: 40 }
  }
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  let ag = gains / period, al = losses / period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    ag = (ag * (period - 1) + Math.max(d, 0)) / period
    al = (al * (period - 1) + Math.max(-d, 0)) / period
  }
  if (al === 0) return 100
  return 100 - 100 / (1 + ag / al)
}

function calcEMA(closes, period) {
  if (closes.length < period) return closes[closes.length - 1] ?? 0
  const k = 2 / (period + 1)
  let val = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) val = closes[i] * k + val * (1 - k)
  return val
}

function calcBB(closes, period = 20) {
  const band = closes.slice(-period)
  if (band.length < period) return null
  const mid = band.reduce((a, b) => a + b, 0) / period
  const std = Math.sqrt(band.reduce((a, b) => a + (b - mid) ** 2, 0) / period)
  return { upper: mid + 2 * std, lower: mid - 2 * std }
}

function calcStochRSI(closes, period = 14) {
  if (closes.length < period * 2) return 50
  const arr = []
  for (let i = period; i <= closes.length; i++) arr.push(calcRSI(closes.slice(0, i), period))
  const sl = arr.slice(-period)
  const mn = Math.min(...sl), mx = Math.max(...sl)
  if (mx === mn) return 50
  return ((arr[arr.length - 1] - mn) / (mx - mn)) * 100
}

const GRIDS = {
  Indicators: (() => {
    const combos = []
    for (const rsiPeriod of [14, 21, 28]) {
      for (const [rsiLow, rsiHigh] of [[30, 70], [25, 75], [35, 65]]) {
        for (const scoreThreshold of [20, 25, 30]) {
          combos.push({ rsiPeriod, rsiLow, rsiHigh, scoreThreshold, volSurge: 1.3 })
        }
      }
    }
    return combos
  })(),
  PriceAction: (() => {
    const combos = []
    for (const wickMult of [1.5, 2, 2.5]) {
      for (const bodyRatioMax of [0.3, 0.4, 0.5]) {
        combos.push({ wickMult, bodyRatioMax })
      }
    }
    return combos
  })(),
  Derivatives: (() => {
    const combos = []
    for (const oiThreshold of [0.5, 1, 2]) {
      for (const [lsHigh, lsLow] of [[2.2, 0.7], [2.5, 0.5], [2.0, 0.8]]) {
        combos.push({ oiThreshold, oiStrong: oiThreshold * 3, lsHigh, lsLow })
      }
    }
    return combos
  })(),
  VolumeProfile: (() => {
    const combos = []
    for (const lookback of [30, 50, 100]) {
      for (const vwapBand of [0.005, 0.01, 0.02]) {
        for (const valueAreaPct of [0.6, 0.7, 0.8]) {
          combos.push({ lookback, vwapBand, valueAreaPct, volSurge: 1.5 })
        }
      }
    }
    return combos
  })(),
  Funding: (() => {
    return [0.5, 1, 1.5, 2].map(scale => ({ scale }))
  })(),
  SMC: [{}],
}

const BUILDERS = {
  Indicators:   (p) => buildIndicatorsSignal(p),
  PriceAction:  (p) => buildPriceActionSignal(p),
  Derivatives:  (p) => buildDerivativesSignal(p),
  VolumeProfile: (p) => buildVolumeProfileSignal(p),
  Funding:      (p) => buildFundingSignal(p),
  SMC:          (p) => buildSMCSignal(p),
}

const DEFAULT_PARAMS = {
  Indicators:   { rsiPeriod: 14, rsiLow: 30, rsiHigh: 70, scoreThreshold: 25, volSurge: 1.3 },
  PriceAction:  { wickMult: 2, bodyRatioMax: 0.4 },
  Derivatives:  { oiThreshold: 1, oiStrong: 3, lsHigh: 2.2, lsLow: 0.7 },
  VolumeProfile: { lookback: 50, vwapBand: 0.01, valueAreaPct: 0.7, volSurge: 1.5 },
  Funding:      { scale: 1 },
  SMC:          {},
}

function paramsKey(p) {
  return JSON.stringify(p)
}

function paramsLabel(p) {
  return Object.entries(p).map(([k, v]) => `${k}=${v}`).join(', ')
}

const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))

const accumulators = new Map()

let fileIdx = 0
for (const fname of cacheFiles) {
  fileIdx++
  process.stdout.write(`\r[${fileIdx}/${cacheFiles.length}] ${fname}...    `)
  const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, fname), 'utf8'))
  const { klines, oiHist, lsRatio, alignedFunding } = data

  const grid   = GRIDS[METHOD]
  const builder = BUILDERS[METHOD]

  for (const params of grid) {
    const key = paramsKey(params)
    const signalFn = builder(params)

    const { train, test } = runBacktest(klines, oiHist, lsRatio, alignedFunding, signalFn)

    if (!accumulators.has(key)) {
      accumulators.set(key, {
        params,
        trainTrades: 0, trainWins: 0, trainSumPnl: 0,
        testTrades:  0, testWins:  0, testSumPnl:  0,
      })
    }
    const acc = accumulators.get(key)
    acc.trainTrades += train.trades
    acc.trainWins   += train.wins
    acc.trainSumPnl += train.sumPnl
    acc.testTrades  += test.trades
    acc.testWins    += test.wins
    acc.testSumPnl  += test.sumPnl
  }
}

console.log('\n')

const defaultKey = paramsKey(DEFAULT_PARAMS[METHOD])

const results = []
for (const [key, acc] of accumulators) {
  const trainWR = acc.trainTrades > 0 ? parseFloat((acc.trainWins / acc.trainTrades * 100).toFixed(1)) : 0
  const testWR  = acc.testTrades  > 0 ? parseFloat((acc.testWins  / acc.testTrades  * 100).toFixed(1)) : 0
  const trainAvg = acc.trainTrades > 0 ? parseFloat((acc.trainSumPnl / acc.trainTrades).toFixed(2)) : 0
  const testAvg  = acc.testTrades  > 0 ? parseFloat((acc.testSumPnl  / acc.testTrades).toFixed(2)) : 0

  let defaultEntry = null
  if (key === defaultKey) {
    const defAcc = acc
    defaultEntry = { trainWR, testWR, trainSumPnl: parseFloat(acc.trainSumPnl.toFixed(2)), testSumPnl: parseFloat(acc.testSumPnl.toFixed(2)) }
  }

  results.push({
    key,
    params: acc.params,
    isDefault: key === defaultKey,
    trainTrades: acc.trainTrades, trainWR, trainSumPnl: parseFloat(acc.trainSumPnl.toFixed(2)), trainAvg,
    testTrades:  acc.testTrades,  testWR,  testSumPnl:  parseFloat(acc.testSumPnl.toFixed(2)),  testAvg,
  })
}

const defResult = results.find(r => r.isDefault)
const top5 = [...results].sort((a, b) => b.trainSumPnl - a.trainSumPnl).slice(0, 5)

const robustThreshold = defResult
  ? { trainSumPnl: defResult.trainSumPnl, testSumPnl: defResult.testSumPnl }
  : { trainSumPnl: 0, testSumPnl: 0 }

console.log(`=== BACKTEST SWEEP: ${METHOD} ===`)
console.log(`Files: ${cacheFiles.length} | Grid: ${GRIDS[METHOD].length} combos | WARMUP=${WARMUP} SL=${SL_MULT}×ATR TP=${TP_MULT}×ATR TRAIN=70% TEST=30%\n`)

function pad(s, n) { return String(s).padEnd(n) }
function padL(s, n) { return String(s).padStart(n) }

const hdr = `${pad('PARAMS', 50)} | ${pad('TR_TRADES', 9)} ${pad('TR_WR%', 7)} ${pad('TR_PNL', 8)} | ${pad('TS_TRADES', 9)} ${pad('TS_WR%', 7)} ${pad('TS_PNL', 8)} | ROBUST | DEFAULT`
console.log(hdr)
console.log('-'.repeat(hdr.length))

function printRow(r) {
  const robust  = r.trainSumPnl > robustThreshold.trainSumPnl && r.testSumPnl > robustThreshold.testSumPnl ? 'YES' : 'no'
  const isDefault = r.isDefault ? 'DEFAULT' : ''
  console.log(
    `${pad(paramsLabel(r.params), 50)} | ` +
    `${padL(r.trainTrades, 9)} ${padL(r.trainWR + '%', 7)} ${padL(r.trainSumPnl, 8)} | ` +
    `${padL(r.testTrades,  9)} ${padL(r.testWR  + '%', 7)} ${padL(r.testSumPnl,  8)} | ` +
    `${pad(robust, 6)} | ${isDefault}`
  )
}

if (defResult) {
  console.log('[DEFAULT]')
  printRow(defResult)
  console.log()
}

console.log('[TOP-5 by train sumPnl]')
for (const r of top5) printRow(r)

console.log('\n[ROBUST — beat default on BOTH train AND test]:')
const robust = results.filter(r => !r.isDefault && r.trainSumPnl > robustThreshold.trainSumPnl && r.testSumPnl > robustThreshold.testSumPnl)
if (robust.length === 0) {
  console.log('  none found')
} else {
  for (const r of robust.sort((a, b) => b.testSumPnl - a.testSumPnl)) printRow(r)
}
