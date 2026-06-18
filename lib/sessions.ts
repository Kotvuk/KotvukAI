export interface ForexSession {
  name: string
  open: number
  close: number
}

export const FOREX_SESSIONS: ForexSession[] = [
  { name: 'Азия', open: 0, close: 9 },
  { name: 'Лондон', open: 7, close: 16 },
  { name: 'Нью-Йорк', open: 12, close: 21 },
]

export interface SessionState {
  name: string
  open: boolean
  minutesLeft: number
}

export function sessionStates(now: Date = new Date()): SessionState[] {
  const cur = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  return FOREX_SESSIONS.map(s => {
    if (cur >= s.open && cur < s.close) {
      return { name: s.name, open: true, minutesLeft: (s.close - cur) * 60 }
    }
    let delta = s.open - cur
    if (delta < 0) delta += 24
    return { name: s.name, open: false, minutesLeft: delta * 60 }
  })
}

export function isForexMarketOpen(now: Date = new Date()): boolean {
  const day = now.getUTCDay()
  if (day === 0 || day === 6) return false
  return sessionStates(now).some(s => s.open)
}

export function formatCountdown(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return (h > 0 ? `${h}ч ` : '') + `${m}м`
}
