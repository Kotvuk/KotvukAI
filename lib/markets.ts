import { DEFAULT_WATCHLIST } from './pairs'

export type Market = 'crypto' | 'forex'

export const FOREX_WATCHLIST: string[] = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
  'USD/CHF', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
]

export interface MarketConfig {
  watchlist: string[]
  limitThreshold: number
  defaultAtrPct: number
  maxDeviation: number
  minRR: number
  tradingWindow: { days: number[]; startHour: number; endHour: number } | null
}

export const MARKETS: Record<Market, MarketConfig> = {
  crypto: {
    watchlist: DEFAULT_WATCHLIST,
    limitThreshold: 0.005,
    defaultAtrPct: 2.0,
    maxDeviation: 0.20,
    minRR: 2.0,
    tradingWindow: null,
  },
  forex: {
    watchlist: FOREX_WATCHLIST,
    limitThreshold: 0.001,
    defaultAtrPct: 0.4,
    maxDeviation: 0.04,
    minRR: 2.0,
    tradingWindow: { days: [1, 2, 3, 4, 5], startHour: 7, endHour: 16 },
  },
}

export function isMarketOpen(market: Market, now: Date = new Date()): boolean {
  const window = MARKETS[market].tradingWindow
  if (!window) return true
  const day = now.getUTCDay()
  const hour = now.getUTCHours()
  return window.days.includes(day) && hour >= window.startHour && hour < window.endHour
}
