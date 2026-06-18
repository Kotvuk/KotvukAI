'use client'
import { useEffect, useState } from 'react'
import { sessionStates, formatCountdown, type SessionState } from '@/lib/sessions'

export function useSessions(): SessionState[] {
  const [states, setStates] = useState<SessionState[]>(() => sessionStates())
  useEffect(() => {
    const tick = () => setStates(sessionStates())
    tick()
    const iv = setInterval(tick, 20000)
    return () => clearInterval(iv)
  }, [])
  return states
}

export function SessionsOpen() {
  const states = useSessions()
  const open = states.filter(s => s.open)
  if (!open.length) return <span className="fx-sess-dim">все сессии закрыты</span>
  return (
    <>
      {open.map(s => (
        <div key={s.name} className="fx-sess-line">
          <span className="fx-sess-on">● {s.name}</span>{' '}
          <span className="fx-sess-mut">закроется через {formatCountdown(s.minutesLeft)}</span>
        </div>
      ))}
    </>
  )
}

export function SessionsClosed() {
  const states = useSessions()
  const closed = states.filter(s => !s.open).sort((a, b) => a.minutesLeft - b.minutesLeft)
  if (!closed.length) return <span className="fx-sess-on">все сессии открыты</span>
  return (
    <>
      {closed.map(s => (
        <div key={s.name} className="fx-sess-line">
          <span className="fx-sess-dim">○ {s.name}</span> откр. через {formatCountdown(s.minutesLeft)}
        </div>
      ))}
    </>
  )
}
