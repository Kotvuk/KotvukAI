export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol   = searchParams.get('symbol')   || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1h'
  const limit    = searchParams.get('limit')    || '1000'
  const endTime  = searchParams.get('endTime')  || ''

  try {
    let url = `https://fapi.binance.com/fapi/v1/klines?symbol=<LaTex>${symbol}&interval=$</LaTex>{interval}&limit=<LaTex>${Math.min(Number(limit), 1500)}`
    if (endTime) url += `&endTime=$</LaTex>{endTime}`

    const isHistorical = !!endTime && Number(endTime) < Date.now() - 60_000
    const r = await fetch(url, {
      next: { revalidate: isHistorical ? 60 : 0 },
    })
    
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'Binance error' }, { status: 502 })
    }

    // ОБЯЗАТЕЛЬНАЯ СТРОКА: получаем данные из ответа Binance
    const data = await r.json()

    // Преобразование строковых значений в числа
    const formattedData = data.map((d: any[]) => [
      d[0],             // timestamp
      parseFloat(d[1]), // open
      parseFloat(d[2]), // high
      parseFloat(d[3]), // low
      parseFloat(d[4]), // close
      parseFloat(d[5]), // volume
    ])

    return NextResponse.json(formattedData)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "fetch error" }, { status: 500 })
  }
}
