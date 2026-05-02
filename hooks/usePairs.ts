'use client'
import { useState, useEffect } from 'react'
import { STATIC_PAIRS } from '@/lib/pairs'

// Module-level cache so all components share one fetch
let _cache: string[] | null = null
let _promise: Promise<void> | null = null

export function usePairs() {
  const [pairs, setPairs] = useState<string[]>(_cache ?? STATIC_PAIRS)

  useEffect(() => {
    if (_cache) {
      setPairs(_cache)
      return
    }
    if (!_promise) {
      _promise = fetch('/api/pairs')
        .then(r => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data) && data.length > 50) {
            _cache = data as string[]
          }
        })
        .catch(() => { /* use static fallback */ })
    }
    _promise.then(() => {
      if (_cache) setPairs(_cache)
    })
  }, [])

  return { pairs }
}
