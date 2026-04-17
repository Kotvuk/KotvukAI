export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { calcEnhancedSMC } from '@/lib/smc'

const TF_MAP: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m',
  '1ч': '1h', '4ч': '4h', '1д': '1d',
}

interface Candle {
  timestamp: number; open: number; high: number; low: number; close: number; volume: number
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { pair, timeframe } = body
  if (!pair || !timeframe) return NextResponse.json({ ok: false, error: 'Missing pair/timeframe' }, { status: 400 })

  const symbol = (pair as string).replace('/', '')
  const interval = TF_MAP[timeframe as string] || '1h'

  let candles: Candle[] = []
  try {
    const r = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!r.ok) return NextResponse.json({ ok: false, error: 'Binance error' }, { status: 502 })
    const raw = await r.json() as unknown[][]
    candles = raw.map((k) => ({
      timestamp: Number(k[0]),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    }))
  } catch {
    return NextResponse.json({ ok: false, error: 'Fetch failed' }, { status: 502 })
  }

  if (candles.length < 200) return NextResponse.json({ ok: false, error: 'Not enough data' }, { status: 400 })

  const HISTORY = Math.min(400, candles.length - 50)
  const historicCandles = candles.slice(0, HISTORY)
  const verifCandles = candles.slice(HISTORY)
  const VERIFY = verifCandles.length

  const smc = calcEnhancedSMC(historicCandles, null)

  interface OBResult {
    type: string
    high: number
    low: number
    quality: string
    strength: string
    hit: boolean
    bounce: boolean
    breakThrough: boolean
    touchCandle: number
    rr: number | null
  }

  const obResults: OBResult[] = []

  for (const ob of smc.orderBlocks) {
    if (ob.isMitigated) continue

    let hit = false
    let bounce = false
    let breakThrough = false
    let touchCandle = VERIFY
    let rr: number | null = null

    for (let j = 0; j < verifCandles.length; j++) {
      const vc = verifCandles[j]
      const inZone = ob.type === 'bullish'
        ? (vc.low <= ob.high && vc.high >= ob.low)
        : (vc.high >= ob.low && vc.low <= ob.high)

      if (inZone && !hit) {
        hit = true
        touchCandle = j + 1
        const postTouch = verifCandles.slice(j + 1, j + 11)
        if (postTouch.length >= 3) {
          if (ob.type === 'bullish') {
            const maxClose = Math.max(...postTouch.map(c => c.close))
            bounce = maxClose > ob.high * 1.005
            breakThrough = postTouch.some(c => c.close < ob.low * 0.998)
            if (!breakThrough && bounce) {
              const reward = ob.high * 1.005 - ob.mid
              const risk = ob.mid - ob.low
              rr = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null
            }
          } else {
            const minClose = Math.min(...postTouch.map(c => c.close))
            bounce = minClose < ob.low * 0.995
            breakThrough = postTouch.some(c => c.close > ob.high * 1.002)
            if (!breakThrough && bounce) {
              const reward = ob.mid - ob.low * 0.995
              const risk = ob.high - ob.mid
              rr = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null
            }
          }
        }
        break
      }
      if (ob.type === 'bullish' && vc.close < ob.low) break
      if (ob.type === 'bearish' && vc.close > ob.high) break
    }

    obResults.push({
      type: ob.type, high: ob.high, low: ob.low,
      quality: ob.quality, strength: ob.strength,
      hit, bounce, breakThrough, touchCandle, rr,
    })
  }

  const total = obResults.length
  const bullOBs = obResults.filter(r => r.type === 'bullish').length
  const bearOBs = obResults.filter(r => r.type === 'bearish').length
  const hitCount = obResults.filter(r => r.hit).length
  const bounceCount = obResults.filter(r => r.hit && r.bounce).length
  const breakCount = obResults.filter(r => r.hit && r.breakThrough).length
  const hitRate = total > 0 ? Math.round((hitCount / total) * 100) : 0
  const bounceRate = hitCount > 0 ? Math.round((bounceCount / hitCount) * 100) : 0
  const rrValues = obResults.filter(r => r.rr !== null).map(r => r.rr as number)
  const avgRR = rrValues.length > 0 ? parseFloat((rrValues.reduce((s, v) => s + v, 0) / rrValues.length).toFixed(2)) : null

  const byQuality = ['A+', 'A', 'B', 'C'].map(q => {
    const qOBs = obResults.filter(r => r.quality === q)
    const qHit = qOBs.filter(r => r.hit).length
    const qBounce = qOBs.filter(r => r.hit && r.bounce).length
    return {
      quality: q,
      total: qOBs.length,
      hit_rate: qOBs.length > 0 ? Math.round((qHit / qOBs.length) * 100) : 0,
      bounce_rate: qHit > 0 ? Math.round((qBounce / qHit) * 100) : 0,
    }
  }).filter(q => q.total > 0)

  return NextResponse.json({
    ok: true, pair, timeframe,
    history_candles: HISTORY,
    verify_candles: VERIFY,
    stats: { total_obs: total, bull_obs: bullOBs, bear_obs: bearOBs, hit_count: hitCount, hit_rate: hitRate, bounce_count: bounceCount, bounce_rate: bounceRate, break_count: breakCount, avg_rr: avgRR },
    by_quality: byQuality,
    obs: obResults.slice(0, 20),
  })
}
