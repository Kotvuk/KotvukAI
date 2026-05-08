import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol   = searchParams.get('symbol')   || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1h'
  const limit    = searchParams.get('limit')    || '500'
  const endTime  = searchParams.get('endTime')  || ''

  try {
    let url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(Number(limit), 1500)}`
    if (endTime) url += `&endTime=${endTime}`

    // isHistorical: запрос завершённых свечей (больше 90 секунд назад)
    const isHistorical = !!endTime && Number(endTime) < Date.now() - 90_000

    const r = await fetch(url, {
      next: { revalidate: isHistorical ? 300 : 15 },
    })

    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'Binance error' }, { status: 502 })
    }

    const data = await r.json()

    const formattedData = data.map((d: any[]) => [
      d[0],             // timestamp
      parseFloat(d[1]), // open
      parseFloat(d[2]), // high
      parseFloat(d[3]), // low
      parseFloat(d[4]), // close
      parseFloat(d[5]), // volume
    ])

    const res = NextResponse.json(formattedData)
    // Браузерный кэш: 15с для текущих свечей, 5 мин для исторических
    res.headers.set('Cache-Control', isHistorical
      ? 'public, max-age=300, stale-while-revalidate=60'
      : 'public, max-age=15, stale-while-revalidate=5'
    )
    return res
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'fetch error' }, { status: 500 })
  }
}
