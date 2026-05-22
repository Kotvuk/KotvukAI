'use client'
import { useState, useEffect, useRef } from 'react'
import { STATIC_PAIRS } from '@/lib/pairs'

let _cache: string[] | null = null
let _promise: Promise<void> | null = null

export function usePairs() {
  const [pairs, setPairs] = useState<string[]>(_cache ?? STATIC_PAIRS)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

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
        .catch(() => {
          _promise = null
        })
    }
    _promise.then(() => {
      if (mounted.current && _cache) setPairs(_cache)
    })
  }, [])

  return { pairs }
}
