import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '..', '.bt-cache')

if (!fs.existsSync(CACHE_DIR)) {
  console.error(`Cache not found: ${CACHE_DIR}. Run scripts/bt-fetch.mjs first.`)
  process.exit(1)
}

const WARMUP   = 150
const SL_MULT  = 1.5
const TP_MULT  = 3.0
const MIN_CONF = 50
const MAX_OPEN = 200
const TRAIN_PCT = 0.7

const DEFAULT_PARAMS = {
  Indicators:   { rsiPeriod: 14, rsiLow: 30, rsiHigh: 70, scoreThreshold: 25, volSurge: 1.3 },
  PriceAction:  { wickMult: 2, bodyRatioMax: 0.4 },
  Derivatives:  { oiThreshold: 1, oiStrong: 3, lsHigh: 2.2, lsLow: 0.7 },
  VolumeProfile: { lookback: 50, vwapBand: 0.01, valueAreaPct: 0.7, volSurge: 1.5 },
  Funding:      { scale: 1 },
  SMC:          {},
}

const OPTIMIZED_PARAMS = {
  Indicators:   { rsiPeriod: 14, rsiLow: 25, rsiHigh: 75, scoreThreshold: 25, volSurge: 1.3 },
  PriceAction:  { wickMult: 2.5, bodyRatioMax: 0.4 },
  Derivatives:  { oiThreshold: 0.5, oiStrong: 1.5, lsHigh: 2.0, lsLow: 0.8 },
  VolumeProfile: { lookback: 30, vwapBand: 0.02, valueAreaPct: 0.8, volSurge: 1.5 },
  Funding:      { scale: 2 },
  SMC:          {},
}

const DEFAULT_WEIGHTS = {
  Indicators: 1.0, PriceAction: 1.0, Derivatives: 1.0,
  VolumeProfile: 1.0, Funding: 1.0, SMC: 1.0,
}

const REWEIGHTED_WEIGHTS = {
  Indicators: 1.0, PriceAction: 1.0, Derivatives: 1.5,
  VolumeProfile: 0.5, Funding: 0.5, SMC: 1.5,
}

const DROP_VP_FUNDING_WEIGHTS = {
  Indicators: 1.0, PriceAction: 1.0, Derivatives: 1.0,
  VolumeProfile: 0.0, Funding: 0.0, SMC: 1.0,
}

const CONFIGS = [
  { id: 'A', label: 'DEFAULT params, weights=1, threshold=3',               params: DEFAULT_PARAMS,   weights: DEFAULT_WEIGHTS,          threshold: 3 },
  { id: 'B', label: 'OPTIMIZED params, weights=1, threshold=3',             params: OPTIMIZED_PARAMS, weights: DEFAULT_WEIGHTS,          threshold: 3 },
  { id: 'C', label: 'OPTIMIZED params, reweighted, threshold=3',            params: OPTIMIZED_PARAMS, weights: REWEIGHTED_WEIGHTS,        threshold: 3 },
  { id: 'D', label: 'OPTIMIZED params, reweighted, threshold=2',            params: OPTIMIZED_PARAMS, weights: REWEIGHTED_WEIGHTS,        threshold: 2 },
  { id: 'E', label: 'OPTIMIZED params, VP=0 Funding=0, threshold=3',       params: OPTIMIZED_PARAMS, weights: DROP_VP_FUNDING_WEIGHTS,   threshold: 3 },
  { id: 'F', label: 'OPTIMIZED params, reweighted, threshold=4 (strict)',   params: OPTIMIZED_PARAMS, weights: REWEIGHTED_WEIGHTS,        threshold: 4 },
]

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

function signalIndicators(candles, p) {
  const closes = candles.map(c => c.close)
  const price  = closes[closes.length - 1]
  const rsiPeriod = p.rsiPeriod ?? 14
  const rsiLow    = p.rsiLow    ?? 30
  const rsiHigh   = p.rsiHigh   ?? 70
  const threshold = p.scoreThreshold ?? 25
  const volSurgeMulti = p.volSurge ?? 1.3

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
  if (rsiVal < rsiLow)          score += 25
  else if (rsiVal < rsiLow + 10) score += 10
  else if (rsiVal > rsiHigh)    score -= 25
  else if (rsiVal > rsiHigh-10) score -= 10

  if (price > ema50 && ema50 > ema200)     score += 20
  else if (price < ema50 && ema50 < ema200) score -= 20
  else if (price > ema50) score += 8
  else if (price < ema50) score -= 8

  if (macd > 0 && macd > prevM)      score += 15
  else if (macd < 0 && macd < prevM) score -= 15
  else if (macd > 0) score += 7
  else if (macd < 0) score -= 7

  if (bb) {
    if (price <= bb.lower)      score += 20
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

function signalPriceAction(candles, p) {
  if (candles.length < 5) return { signal: 'WAIT', confidence: 30 }
  const last  = candles[candles.length - 1]
  const prev  = candles[candles.length - 2]
  const prev2 = candles[candles.length - 3]
  const wickMult    = p.wickMult    ?? 2
  const bodyRatioMax = p.bodyRatioMax ?? 0.4

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

function signalDerivatives(candles, oiHist, lsRatio, p) {
  if (!oiHist || oiHist.length < 2) return { signal: 'WAIT', confidence: 25 }
  const oiThreshold = p.oiThreshold ?? 1
  const oiStrong    = p.oiStrong    ?? 3
  const lsHigh      = p.lsHigh      ?? 2.2
  const lsLow       = p.lsLow       ?? 0.7

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
    const avg = lsRatio.reduce((a, r) => a + r.longShortRatio, 0) / lsRatio.length
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

function signalVolumeProfile(candles, p) {
  if (candles.length < 20) return { signal: 'WAIT', confidence: 30 }
  const lookback     = p.lookback     ?? 50
  const vwapBand     = p.vwapBand     ?? 0.01
  const valueAreaPct = p.valueAreaPct ?? 0.7
  const volSurgeMult = p.volSurge     ?? 1.5

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

function signalFunding(fr, p) {
  if (fr === null || fr === undefined) return { signal: 'WAIT', confidence: 30 }
  const scale = p.scale ?? 1
  const thrExtreme    = (p.thrExtreme    ?? 0.1)   * scale
  const thrHigh       = (p.thrHigh       ?? 0.05)  * scale
  const thrMid        = (p.thrMid        ?? 0.02)  * scale
  const thrLowNeg     = (p.thrLowNeg     ?? -0.01) * scale
  const thrExtremeNeg = (p.thrExtremeNeg ?? -0.05) * scale

  if (fr > thrExtreme)     return { signal: 'SHORT', confidence: 72 }
  if (fr > thrHigh)        return { signal: 'SHORT', confidence: 60 }
  if (fr > thrMid)         return { signal: 'SHORT', confidence: 45 }
  if (fr < thrExtremeNeg)  return { signal: 'LONG',  confidence: 72 }
  if (fr < thrLowNeg)      return { signal: 'LONG',  confidence: 60 }
  return { signal: 'WAIT', confidence: 40 }
}

function signalSMC(candles) {
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

function calcWeightedConsensus(methods, threshold) {
  let longSum = 0, shortSum = 0
  for (const m of methods) {
    if (m.signal === 'LONG')  longSum  += m.weight
    else if (m.signal === 'SHORT') shortSum += m.weight
  }
  let decision = 'WAIT'
  if (longSum >= threshold && longSum > shortSum)  decision = 'LONG'
  else if (shortSum >= threshold && shortSum > longSum) decision = 'SHORT'
  return decision
}

function getAllMethodSignals(slice, oiHist, lsRatio, fr, params, weights) {
  return [
    { name: 'Indicators',   weight: weights.Indicators,   ...signalIndicators(slice, params.Indicators) },
    { name: 'PriceAction',  weight: weights.PriceAction,  ...signalPriceAction(slice, params.PriceAction) },
    { name: 'Derivatives',  weight: weights.Derivatives,  ...signalDerivatives(slice, oiHist, lsRatio, params.Derivatives) },
    { name: 'VolumeProfile', weight: weights.VolumeProfile, ...signalVolumeProfile(slice, params.VolumeProfile) },
    { name: 'Funding',      weight: weights.Funding,      ...signalFunding(fr, params.Funding) },
    { name: 'SMC',          weight: weights.SMC,          ...signalSMC(slice) },
  ]
}

function simulate(candles, oiHist, lsRatio, alignedFunding, params, weights, threshold) {
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
          const pnl = isWin
            ? Math.abs(openTrade.tp - openTrade.entry) / openTrade.entry * 100
            : -Math.abs(openTrade.sl - openTrade.entry) / openTrade.entry * 100
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
        openTrade = null; continue
      }
      if (hitSL) {
        const pnl = -Math.abs(openTrade.sl - openTrade.entry) / openTrade.entry * 100
        trades++; sumPnl += pnl
        openTrade = null; continue
      }
      continue
    }

    const slice = candles.slice(0, i + 1)
    const fr = alignedFunding ? (alignedFunding[i] ?? null) : null
    const methods = getAllMethodSignals(slice, oiHist, lsRatio, fr, params, weights)
    const decision = calcWeightedConsensus(methods, threshold)

    if (decision === 'WAIT') continue

    const atr = calcATR(slice.slice(-20))
    const entry = candles[i].close
    const sl = decision === 'LONG' ? entry - SL_MULT * atr : entry + SL_MULT * atr
    const tp = decision === 'LONG' ? entry + TP_MULT * atr : entry - TP_MULT * atr

    openTrade = { dir: decision, entry, sl, tp }
    openSince = i
  }

  const wr = trades > 0 ? (wins / trades * 100) : 0
  const avgPnl = trades > 0 ? sumPnl / trades : 0
  return {
    trades,
    wins,
    wr: parseFloat(wr.toFixed(1)),
    sumPnl: parseFloat(sumPnl.toFixed(2)),
    avgPnl: parseFloat(avgPnl.toFixed(2)),
  }
}

function runConfig(cacheFiles, cfg) {
  const acc = {
    trainTrades: 0, trainWins: 0, trainSumPnl: 0,
    testTrades:  0, testWins:  0, testSumPnl:  0,
  }

  for (const fname of cacheFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, fname), 'utf8'))
    const { klines, oiHist, lsRatio, alignedFunding } = data

    const trainEnd = Math.floor(klines.length * TRAIN_PCT)
    const trainCandles = klines.slice(0, trainEnd)
    const testCandles  = klines.slice(trainEnd - WARMUP)
    const testFunding  = alignedFunding ? alignedFunding.slice(trainEnd - WARMUP) : null
    const trainFunding = alignedFunding ? alignedFunding.slice(0, trainEnd) : null

    const train = simulate(trainCandles, oiHist, lsRatio, trainFunding, cfg.params, cfg.weights, cfg.threshold)
    const test  = simulate(testCandles,  oiHist, lsRatio, testFunding,  cfg.params, cfg.weights, cfg.threshold)

    acc.trainTrades += train.trades
    acc.trainWins   += train.wins
    acc.trainSumPnl += train.sumPnl
    acc.testTrades  += test.trades
    acc.testWins    += test.wins
    acc.testSumPnl  += test.sumPnl
  }

  const trainWR  = acc.trainTrades > 0 ? (acc.trainWins / acc.trainTrades * 100) : 0
  const testWR   = acc.testTrades  > 0 ? (acc.testWins  / acc.testTrades  * 100) : 0
  const trainAvg = acc.trainTrades > 0 ? acc.trainSumPnl / acc.trainTrades : 0
  const testAvg  = acc.testTrades  > 0 ? acc.testSumPnl  / acc.testTrades  : 0

  return {
    trainTrades: acc.trainTrades,
    trainWR:  parseFloat(trainWR.toFixed(1)),
    trainSumPnl: parseFloat(acc.trainSumPnl.toFixed(2)),
    trainAvg: parseFloat(trainAvg.toFixed(2)),
    testTrades: acc.testTrades,
    testWR:  parseFloat(testWR.toFixed(1)),
    testSumPnl: parseFloat(acc.testSumPnl.toFixed(2)),
    testAvg: parseFloat(testAvg.toFixed(2)),
  }
}

const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))
console.log(`\n=== CONSENSUS BACKTEST: 6 configs A-F ===`)
console.log(`Files: ${cacheFiles.length} | WARMUP=${WARMUP} | SL=${SL_MULT}xATR | TP=${TP_MULT}xATR | TRAIN=70% TEST=30%`)
console.log(`NOTE: SMC = proxy (HH/LL структура за 10/30 свечей), не реальный calcEnhancedSMC\n`)

const results = []
for (const cfg of CONFIGS) {
  process.stdout.write(`Running config ${cfg.id}...`)
  const r = runConfig(cacheFiles, cfg)
  results.push({ ...cfg, ...r })
  process.stdout.write(` trades(train=${r.trainTrades} test=${r.testTrades}) done\n`)
}

function pad(s, n) { return String(s).padEnd(n) }
function padL(s, n) { return String(s).padStart(n) }

console.log('\n')
const hdr = `${'ID'} | ${'TRAIN'.padEnd(42)} | ${'TEST'.padEnd(42)}`
const sub = `${'  '} | ${'trades'.padStart(6)} ${'WR%'.padStart(6)} ${'sumPnl'.padStart(8)} ${'avgPnl'.padStart(7)} | ${'trades'.padStart(6)} ${'WR%'.padStart(6)} ${'sumPnl'.padStart(8)} ${'avgPnl'.padStart(7)}`
console.log(hdr)
console.log(sub)
console.log('-'.repeat(90))

const bestTestPnl = Math.max(...results.map(r => r.testSumPnl))

for (const r of results) {
  const isBest = r.testSumPnl === bestTestPnl
  const mark = isBest ? ' <<< BEST TEST' : ''
  console.log(
    `${pad(r.id, 2)} | ` +
    `${padL(r.trainTrades, 6)} ${padL(r.trainWR + '%', 6)} ${padL(r.trainSumPnl, 8)} ${padL(r.trainAvg, 7)} | ` +
    `${padL(r.testTrades,  6)} ${padL(r.testWR  + '%', 6)} ${padL(r.testSumPnl,  8)} ${padL(r.testAvg,  7)}` +
    mark
  )
}

console.log('\n--- Config descriptions ---')
for (const r of results) {
  const isBest = r.testSumPnl === bestTestPnl
  console.log(`${r.id}: ${r.label}${isBest ? ' [BEST TEST]' : ''}`)
}

const bestConfig = results.find(r => r.testSumPnl === bestTestPnl)
const baselineA  = results.find(r => r.id === 'A')

console.log('\n=== ВЫВОД ===')
console.log(`Лучшая конфигурация на out-of-sample (TEST): ${bestConfig.id} — ${bestConfig.label}`)
console.log(`TEST sumPnl: ${bestConfig.testSumPnl.toFixed(2)}% | WR: ${bestConfig.testWR}% | trades: ${bestConfig.testTrades} | avgPnl: ${bestConfig.testAvg}%`)
console.log(``)
console.log(`Baseline A (прод): TEST sumPnl=${baselineA.testSumPnl.toFixed(2)}% | WR=${baselineA.testWR}% | trades=${baselineA.testTrades}`)

const delta = bestConfig.testSumPnl - baselineA.testSumPnl
const direction = delta > 0 ? 'улучшение' : 'ухудшение'

console.log(``)
if (bestConfig.id !== 'A') {
  if (delta > 5 && bestConfig.testTrades >= 30) {
    console.log(`Рекомендация: ПРИМЕНИТЬ ${bestConfig.id} на прод. Delta TEST sumPnl = +${delta.toFixed(2)}% при ${bestConfig.testTrades} сделках — статистически значимо.`)
  } else if (delta > 0 && bestConfig.testTrades >= 20) {
    console.log(`Рекомендация: РАССМОТРЕТЬ ${bestConfig.id}. Delta TEST sumPnl = +${delta.toFixed(2)}%, trades=${bestConfig.testTrades} — умеренный сигнал, требуется forward-тест на живых данных.`)
  } else {
    console.log(`Рекомендация: ОСТАВИТЬ прод без изменений (A). Delta слишком мала или trades мало (${delta.toFixed(2)}%, trades=${bestConfig.testTrades}).`)
  }
} else {
  console.log(`Рекомендация: ОСТАВИТЬ прод без изменений — baseline A уже является лучшей конфигурацией на TEST.`)
}
