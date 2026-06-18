'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Market } from '@/lib/markets'

interface MarketCtx {
  market: Market
  setMarket: (m: Market) => void
}

const MarketContext = createContext<MarketCtx>({ market: 'crypto', setMarket: () => {} })

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [market, setMarketState] = useState<Market>('crypto')

  useEffect(() => {
    const saved = localStorage.getItem('kotvuk_market') as Market | null
    if (saved === 'forex' || saved === 'crypto') {
      setMarketState(saved)
      document.documentElement.setAttribute('data-market', saved)
    }
  }, [])

  const setMarket = (m: Market) => {
    setMarketState(m)
    localStorage.setItem('kotvuk_market', m)
    document.documentElement.setAttribute('data-market', m)
  }

  return (
    <MarketContext.Provider value={{ market, setMarket }}>
      {children}
    </MarketContext.Provider>
  )
}

export const useMarket = () => useContext(MarketContext)
