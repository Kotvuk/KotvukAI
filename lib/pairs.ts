export const EXCLUDED_SUFFIXES = ['UP', 'DOWN', 'BULL', 'BEAR', '3L', '3S', '2L', '2S', '5L', '5S']

export const EXCLUDED_BASES = new Set([
  'WBTC', 'BTCDOM', 'BNBDOM', 'DEFI', 'ALTDOM', 'MIDDOM', 'BVOL', 'IBVOL', 'ETHBTC',
  'AAPL', 'AMD',  'AMZN', 'AVGO', 'BABA', 'BRKB', 'COIN', 'CSCO', 'DIS',
  'GOOGL', 'HD',  'HOOD', 'INTC', 'JPM',  'LITE', 'META', 'MRVL', 'MSFT',
  'MU',   'NVDA', 'ORCL', 'PLTR', 'QCOM', 'RKLB', 'SNDK', 'TSLA', 'TSM',
  'UBER', 'V',    'WMT',  'MSTR',
  'QQQ',  'SPY',  'EWY',  'SOXL',
  'BZ',   'CL',   'USAR', 'XPD',  'XPT',
  'XAU',  'XAG',  'PAXG',
  'EWJ',  'NATGAS', 'USDC', 'BTCST',
])

export function isExcluded(symbol: string): boolean {
  const base = symbol.slice(0, -4)
  if (EXCLUDED_BASES.has(base)) return true
  if (EXCLUDED_SUFFIXES.some(s => base.endsWith(s))) return true
  if (base.length < 2) return true
  if (!/^[A-Z0-9]+$/.test(base)) return true
  return false
}

export const DEFAULT_WATCHLIST: string[] = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'TRXUSDT', 'LTCUSDT', 'ATOMUSDT',
]

export const BAD_PAIRS = new Set([
  'TRUMPUSDT', 'HYPEUSDT', 'ONDOUSDT',
  'TRUMP/USDT', 'HYPE/USDT', 'ONDO/USDT',
])

export const STATIC_PAIRS: string[] = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'LTC/USDT',
  'BCH/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT', 'ATOM/USDT',
  'NEAR/USDT', 'APT/USDT', 'OP/USDT', 'ARB/USDT',
  'SUI/USDT', 'TIA/USDT', 'SEI/USDT', 'RUNE/USDT', 'TAO/USDT',
  'WLD/USDT', 'RNDR/USDT', 'FET/USDT', 'AAVE/USDT', 'MKR/USDT',
  'CRV/USDT', 'LDO/USDT', 'PENDLE/USDT', 'GMX/USDT',
  'DYDX/USDT', 'JUP/USDT', 'PYTH/USDT', 'ENA/USDT',
  'EIGEN/USDT', 'ETHFI/USDT', 'BERA/USDT', 'STX/USDT',
  'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'TRX/USDT', 'XLM/USDT',
  'HBAR/USDT', 'VET/USDT', 'EGLD/USDT', 'FIL/USDT', 'ICP/USDT',
  'THETA/USDT', 'FLOW/USDT', 'ALGO/USDT', 'SAND/USDT', 'MANA/USDT',
  'AXS/USDT', 'IMX/USDT', 'GALA/USDT', 'APE/USDT', 'GRT/USDT',
  'WIF/USDT', 'PEPE/USDT', 'SHIB/USDT', 'FLOKI/USDT', 'BONK/USDT',

  'TON/USDT', 'NOT/USDT', 'ORDI/USDT', 'BLUR/USDT',
]
