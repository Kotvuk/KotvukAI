export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { type Candle } from '@/lib/analysis'
import { calcEnhancedSMC } from '@/lib/smc'
import {
  analyzeIndicators,
  analyzePriceAction,
  analyzeVolumeProfile,
  analyzeFunding,
  analyzeDerivatives,
  type OpenInterestPoint,
  type LongShortRatioPoint,
} from '@/lib/indicators'
import { BAD_PAIRS } from '@/lib/pairs'

const WARMUP = 150
const PAIR_RE = /^[A-Z0-9]{2,12}USDT$/

interface MethodAcc {
  trades: number
  wins: number
  sumPnl: number
}

interface PairMethodKey {
  pair: string
  method: string
}

function atr14(candles: Candle[]): number {
  const slice = candles.slice(-15)
  if (slice.length < 2) return candles[candles.length - 1].close * 0.02
  let sum = 0
  for (let i = 1; i < slice.length; i++) {
    const tr = Math.max(
      slice[i].high - slice[i].low,
      Math.abs(slice[i].high - slice[i - 1].close),
      Math.abs(slice[i].low - slice[i - 1].close),
    )
    sum += tr
  }
  return sum / (slice.length - 1)
}

function scanOutcome(
  candles: Candle[],
  entryIdx: number,
  isLong: boolean,
  sl: number,
  tp: number,
): { closeIdx: number; pnlPct: number } | null {
  const entry = candles[entryIdx].close
  const limit = Math.min(entryIdx + 200, candles.length - 1)

  for (let j = entryIdx + 1; j <= limit; j++) {
    const c = candles[j]
    const hitTp = isLong ? c.high >= tp : c.low <= tp
    const hitSl = isLong ? c.low <= sl : c.high >= sl

    if (hitTp && hitSl) {
      const next = candles[j + 1]
      if (!next) return { closeIdx: j, pnlPct: isLong ? ((sl - entry) / entry) * 100 : ((entry - sl) / entry) * 100 }
      const bullish = next.close >= next.open
      const exitTp = isLong ? bullish : !bullish
      if (exitTp) {
        return { closeIdx: j, pnlPct: isLong ? ((tp - entry) / entry) * 100 : ((entry - tp) / entry) * 100 }
      }
      return { closeIdx: j, pnlPct: isLong ? ((sl - entry) / entry) * 100 : ((entry - sl) / entry) * 100 }
    }

    if (hitTp) return { closeIdx: j, pnlPct: isLong ? ((tp - entry) / entry) * 100 : ((entry - tp) / entry) * 100 }
    if (hitSl) return { closeIdx: j, pnlPct: isLong ? ((sl - entry) / entry) * 100 : ((entry - sl) / entry) * 100 }
  }

  return null
}

async function fetchCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const r = await fetch(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    { signal: AbortSignal.timeout(10000) },
  )
  if (!r.ok) return []
  const raw = await r.json() as unknown[][]
  return raw.map(k => ({
    timestamp: Number(k[0]),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }))
}

async function fetchFunding(symbol: string): Promise<Array<{ fundingTime: number; fundingRate: number }>> {
  try {
    const r = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1000`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!r.ok) return []
    const raw = await r.json() as Array<{ fundingTime: number | string; fundingRate: number | string }>
    return raw.map(x => ({ fundingTime: Number(x.fundingTime), fundingRate: parseFloat(String(x.fundingRate)) * 100 }))
  } catch {
    return []
  }
}

async function fetchDerivatives(symbol: string, period: string): Promise<{ oi: OpenInterestPoint[]; ls: LongShortRatioPoint[] }> {
  const [oiRes, lsRes] = await Promise.allSettled([
    fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=500`, { signal: AbortSignal.timeout(10000) }),
    fetch(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=500`, { signal: AbortSignal.timeout(10000) }),
  ])

  const oi: OpenInterestPoint[] = []
  const ls: LongShortRatioPoint[] = []

  if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
    const raw = await oiRes.value.json() as Array<{ sumOpenInterest: string; timestamp: number }>
    for (const x of raw) oi.push({ sumOpenInterest: parseFloat(x.sumOpenInterest), timestamp: Number(x.timestamp) })
  }

  if (lsRes.status === 'fulfilled' && lsRes.value.ok) {
    const raw = await lsRes.value.json() as Array<{ longShortRatio: string; timestamp: number }>
    for (const x of raw) ls.push({ longShortRatio: parseFloat(x.longShortRatio), timestamp: Number(x.timestamp) })
  }

  return { oi, ls }
}

const OI_PERIOD_MAP: Record<string, string> = {
  '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h',
}

function getFundingAtTime(funding: Array<{ fundingTime: number; fundingRate: number }>, ts: number): number | null {
  if (!funding.length) return null
  let best: number | null = null
  for (const f of funding) {
    if (f.fundingTime <= ts) best = f.fundingRate
    else break
  }
  return best
}

function getOISliceAt(oi: OpenInterestPoint[], ts: number): OpenInterestPoint[] {
  return oi.filter(x => x.timestamp <= ts)
}

function getLSSliceAt(ls: LongShortRatioPoint[], ts: number): LongShortRatioPoint[] {
  return ls.filter(x => x.timestamp <= ts)
}

function makeSMCResult(smcData: ReturnType<typeof calcEnhancedSMC>): { signal: 'LONG' | 'SHORT' | 'WAIT'; confidence: number } {
  const p = smcData.probability
  if (p.scenario === 'LONG') return { signal: 'LONG', confidence: p.confidence }
  if (p.scenario === 'SHORT') return { signal: 'SHORT', confidence: p.confidence }
  return { signal: 'WAIT', confidence: p.confidence }
}

async function runPairTf(
  pair: string,
  tf: string,
  limit: number,
  pairAcc: Map<string, MethodAcc>,
  methodAcc: Map<string, MethodAcc>,
  pmAcc: Map<string, MethodAcc>,
) {
  const candles = await fetchCandles(pair, tf, limit)
  if (candles.length < WARMUP + 10) return

  const funding = await fetchFunding(pair)
  const period = OI_PERIOD_MAP[tf] || '1h'
  const { oi, ls } = await fetchDerivatives(pair, period)

  const methodNames = ['Indicators', 'PriceAction', 'VolumeProfile', 'Funding', 'Derivatives', 'SMC']

  const accs: Record<string, MethodAcc> = {}
  for (const m of methodNames) accs[m] = { trades: 0, wins: 0, sumPnl: 0 }

  const nextI: Record<string, number> = {}
  for (const m of methodNames) nextI[m] = WARMUP

  for (let i = WARMUP; i < candles.length - 2; i++) {
    const slice = candles.slice(0, i + 1)
    const ts = candles[i].timestamp
    const entry = candles[i].close
    const atrVal = atr14(slice)
    const slDist = 1.5 * atrVal
    const tpDist = 3.0 * atrVal

    const fundingRate = getFundingAtTime(funding, ts)
    const oiSlice = getOISliceAt(oi, ts)
    const lsSlice = getLSSliceAt(ls, ts)

    const methodResults: Record<string, { signal: 'LONG' | 'SHORT' | 'WAIT'; confidence: number }> = {
      Indicators: analyzeIndicators(slice),
      PriceAction: analyzePriceAction(slice),
      VolumeProfile: analyzeVolumeProfile(slice),
      Funding: analyzeFunding(fundingRate),
      Derivatives: analyzeDerivatives(oiSlice.length >= 2 ? oiSlice : null, lsSlice.length > 0 ? lsSlice : null, slice),
      SMC: makeSMCResult(calcEnhancedSMC(slice, fundingRate)),
    }

    for (const method of methodNames) {
      if (i < nextI[method]) continue

      const res = methodResults[method]
      if ((res.signal === 'LONG' || res.signal === 'SHORT') && res.confidence >= 50) {
        const isLong = res.signal === 'LONG'
        const sl = isLong ? entry - slDist : entry + slDist
        const tp = isLong ? entry + tpDist : entry - tpDist

        const outcome = scanOutcome(candles, i, isLong, sl, tp)
        if (!outcome) continue

        const pnl = isLong
          ? ((candles[outcome.closeIdx].close - entry) / entry) * 100
          : ((entry - candles[outcome.closeIdx].close) / entry) * 100

        const rawPnl = outcome.pnlPct

        accs[method].trades++
        if (rawPnl > 0) accs[method].wins++
        accs[method].sumPnl += rawPnl

        nextI[method] = outcome.closeIdx + 1
      }
    }
  }

  for (const method of methodNames) {
    const a = accs[method]
    if (!a.trades) continue

    const pairKey = pair
    const methodKey = method
    const pmKey = `${pair}::${method}`

    const addTo = (map: Map<string, MethodAcc>, key: string) => {
      const existing = map.get(key) || { trades: 0, wins: 0, sumPnl: 0 }
      existing.trades += a.trades
      existing.wins += a.wins
      existing.sumPnl += a.sumPnl
      map.set(key, existing)
    }

    addTo(pairAcc, pairKey)
    addTo(methodAcc, methodKey)
    addTo(pmAcc, pmKey)
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const pairsParam = req.nextUrl.searchParams.get('pairs')
  const tfsParam = req.nextUrl.searchParams.get('tfs') || '15m,30m,1h,4h'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '1000', 10)
  const tfs = tfsParam.split(',').map(s => s.trim()).filter(Boolean)

  let pairs: string[]

  if (pairsParam) {
    pairs = pairsParam.split(',').map(s => s.trim().toUpperCase()).filter(s => PAIR_RE.test(s) && !BAD_PAIRS.has(s))
  } else {
    try {
      const r = await fetch('https://fapi.binance.com/fapi/v1/ticker/price', { signal: AbortSignal.timeout(10000) })
      const all = await r.json() as Array<{ symbol: string; price: string }>
      pairs = all
        .filter(x => PAIR_RE.test(x.symbol) && !BAD_PAIRS.has(x.symbol) && !BAD_PAIRS.has(x.symbol.slice(0, -4) + '/USDT'))
        .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        .slice(0, 20)
        .map(x => x.symbol)
    } catch {
      return NextResponse.json({ ok: false, error: 'Failed to fetch Binance ticker' }, { status: 502 })
    }
  }

  if (!pairs.length) return NextResponse.json({ ok: false, error: 'No valid pairs' }, { status: 400 })

  const pairAcc = new Map<string, MethodAcc>()
  const methodAcc = new Map<string, MethodAcc>()
  const pmAcc = new Map<string, MethodAcc>()

  for (const pair of pairs) {
    for (const tf of tfs) {
      try {
        await runPairTf(pair, tf, limit, pairAcc, methodAcc, pmAcc)
      } catch {
      }
    }
  }

  const toRow = (key: string, acc: MethodAcc) => ({
    name: key,
    trades: acc.trades,
    wins: acc.wins,
    winRate: acc.trades > 0 ? parseFloat(((acc.wins / acc.trades) * 100).toFixed(1)) : 0,
    sumPnl: parseFloat(acc.sumPnl.toFixed(2)),
    avgPnl: acc.trades > 0 ? parseFloat((acc.sumPnl / acc.trades).toFixed(2)) : 0,
  })

  const perPair = Array.from(pairAcc.entries())
    .map(([k, v]) => ({ pair: k, ...toRow(k, v) }))
    .sort((a, b) => b.sumPnl - a.sumPnl)
    .map(({ name: _, ...rest }) => rest)

  const perMethod = Array.from(methodAcc.entries())
    .map(([k, v]) => ({ method: k, ...toRow(k, v) }))
    .sort((a, b) => b.winRate - a.winRate)
    .map(({ name: _, ...rest }) => rest)

  const perPairMethod = Array.from(pmAcc.entries())
    .map(([k, v]) => {
      const [pair, method] = k.split('::')
      return { pair, method, ...toRow(k, v) }
    })
    .sort((a, b) => b.winRate - a.winRate)
    .map(({ name: _, ...rest }) => rest)

  return NextResponse.json({
    ok: true,
    perPair,
    perMethod,
    perPairMethod,
    meta: {
      pairsScanned: pairs.length,
      pairs,
      tfs,
      candlesPerPair: limit,
      warmup: WARMUP,
      note: 'Derivatives limited to ~30d OI history. Незакрытые сделки в окне +200 свечей — пропускаются.',
    },
  })
}
