'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

let _show: ((msg: string, type?: 'ok' | 'err') => void) | null = null

export function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
  _show?.(msg, type)
}

export default function Toast() {
  const [visible, setVisible] = useState(false)
  const [msg, setMsg] = useState('')
  const [type, setType] = useState<'ok' | 'err'>('ok')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((m: string, t: 'ok' | 'err' = 'ok') => {
    if (timer.current) clearTimeout(timer.current)
    setMsg(m); setType(t); setVisible(true)
    timer.current = setTimeout(() => setVisible(false), 2400)
  }, [])

  useEffect(() => {
    _show = show
    return () => { _show = null }
  }, [show])

  return (
    <div className={`toast ${type} ${visible ? 'show' : ''}`}>
      {msg}
    </div>
  )
}
