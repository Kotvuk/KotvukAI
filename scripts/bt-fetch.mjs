import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '..', '.bt-cache')

const PAIRS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','TAOUSDT','BCHUSDT','AAVEUSDT','SOLUSDT','LTCUSDT',
  'LINKUSDT','AVAXUSDT','GMXUSDT','ORDIUSDT','EGLDUSDT','ICPUSDT','NEARUSDT',
  'ATOMUSDT','TONUSDT','PENDLEUSDT','XRPUSDT','AXSUSDT',
]

const TFS = ['15m', '30m', '1h', '4h']

const TF_INTERVAL_MAP = {
  '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h',
}

const OI_PERIOD_MAP = {
  '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h',
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

async function fetchKlines(symbol, interval) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=1000`
  const raw = await fetchJSON(url)
  return raw.map(k => ({
    timestamp: k[0],
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}

async function fetchFunding(symbol) {
  const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1000`
  try {
    const raw = await fetchJSON(url)
    return raw.map(r => ({
      timestamp:   parseInt(r.fundingTime),
      fundingRate: parseFloat(r.fundingRate) * 100,
    }))
  } catch {
    return []
  }
}

async function fetchOI(symbol, period) {
  const url = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=500`
  try {
    const raw = await fetchJSON(url)
    return raw.map(r => ({
      timestamp:       parseInt(r.timestamp),
      sumOpenInterest: parseFloat(r.sumOpenInterest),
    }))
  } catch {
    return []
  }
}

async function fetchLS(symbol, period) {
  const url = `https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=500`
  try {
    const raw = await fetchJSON(url)
    return raw.map(r => ({
      timestamp:      parseInt(r.timestamp),
      longShortRatio: parseFloat(r.longShortRatio),
    }))
  } catch {
    return []
  }
}

function alignFunding(candles, fundingArr) {
  const sorted = [...fundingArr].sort((a, b) => a.timestamp - b.timestamp)
  return candles.map(c => {
    let last = null
    for (const f of sorted) {
      if (f.timestamp <= c.timestamp) last = f.fundingRate
      else break
    }
    return last
  })
}

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

let done = 0
const total = PAIRS.length * TFS.length

for (const symbol of PAIRS) {
  for (const tf of TFS) {
    const filePath = path.join(CACHE_DIR, `${symbol}_${tf}.json`)
    if (fs.existsSync(filePath)) {
      console.log(`[skip] ${symbol} ${tf} (cached)`)
      done++
      continue
    }

    process.stdout.write(`[${++done}/${total}] ${symbol} ${tf} ... `)

    try {
      const [klines, fundingArr, oiHist, lsRatio] = await Promise.allSettled([
        fetchKlines(symbol, TF_INTERVAL_MAP[tf]),
        fetchFunding(symbol),
        fetchOI(symbol, OI_PERIOD_MAP[tf]),
        fetchLS(symbol, OI_PERIOD_MAP[tf]),
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : []))

      const alignedFunding = alignFunding(klines, fundingArr)

      const data = { symbol, tf, klines, alignedFunding, oiHist, lsRatio }
      fs.writeFileSync(filePath, JSON.stringify(data))
      console.log(`ok (${klines.length} candles, OI=${oiHist.length}, LS=${lsRatio.length}, FR=${fundingArr.length})`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }

    await sleep(300)
  }
  await sleep(200)
}

const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))
console.log(`\nDone. Cache: ${files.length} files in ${CACHE_DIR}`)
