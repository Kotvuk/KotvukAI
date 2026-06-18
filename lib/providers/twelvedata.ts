const TWELVE_DATA_URL = 'https://api.twelvedata.com/time_series'
const TWELVE_DATA_PRICE_URL = 'https://api.twelvedata.com/price'

const INTERVAL_MAP: Record<string, string> = {
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '4h': '4h',
}

export function loadTwelveDataKeys(): string[] {
  const keys: string[] = []
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`TWELVE_DATA_API_KEY_${i}`]
    if (k) keys.push(k)
  }
  if (keys.length === 0 && process.env.TWELVE_DATA_API_KEY) keys.push(process.env.TWELVE_DATA_API_KEY)
  return keys
}

function isRateLimitError(body: Record<string, unknown>): boolean {
  if (Number(body.code) === 429) return true
  const msg = String(body.message || '')
  return /api credits/i.test(msg)
}

export async function fetchForexCandles(symbol: string, interval: string, limit = 500): Promise<number[][]> {
  const keys = loadTwelveDataKeys()
  if (keys.length === 0) throw new Error('No TWELVE_DATA_API_KEY found. Add TWELVE_DATA_API_KEY_1 to environment variables.')

  const tdInterval = INTERVAL_MAP[interval] || interval
  const outputsize = Math.min(limit, 5000)

  let lastError = ''
  for (let i = 0; i < keys.length; i++) {
    const url = `${TWELVE_DATA_URL}?symbol=${encodeURIComponent(symbol)}&interval=${tdInterval}&outputsize=${outputsize}&apikey=${keys[i]}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    const data = await res.json() as Record<string, unknown>

    if (data.status === 'error' || !Array.isArray(data.values)) {
      if (isRateLimitError(data)) {
        lastError = `key ${i + 1}/${keys.length} rate limited`
        continue
      }
      throw new Error(`Twelve Data error: ${data.message || res.status}`)
    }

    const values = data.values as Record<string, string>[]
    return values
      .map(v => [
        new Date(v.datetime.replace(' ', 'T') + 'Z').getTime(),
        parseFloat(v.open),
        parseFloat(v.high),
        parseFloat(v.low),
        parseFloat(v.close),
        v.volume ? parseFloat(v.volume) : 0,
      ])
      .reverse()
  }
  throw new Error(`All ${keys.length} Twelve Data keys exhausted. (${lastError})`)
}

export async function fetchForexPrice(symbol: string): Promise<number | null> {
  const keys = loadTwelveDataKeys()
  if (keys.length === 0) return null

  for (let i = 0; i < keys.length; i++) {
    const url = `${TWELVE_DATA_PRICE_URL}?symbol=${encodeURIComponent(symbol)}&apikey=${keys[i]}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    const data = await res.json() as Record<string, unknown>

    if (data.status === 'error' || !data.price) {
      if (isRateLimitError(data)) continue
      return null
    }
    return parseFloat(String(data.price))
  }
  return null
}
