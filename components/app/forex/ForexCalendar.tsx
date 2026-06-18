'use client'
import { useEffect, useState } from 'react'

interface CalEvent {
  time: string; currency: string; title: string
  importance: 'high' | 'medium' | 'low'
  forecast?: string | null; previous?: string | null
}

const IMP_COLOR: Record<string, string> = {
  high: 'var(--short)', medium: 'var(--wait)', low: 'var(--line3)',
}

export default function ForexCalendar() {
  const [events, setEvents] = useState<CalEvent[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/forex/calendar')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setEvents(d.events || []))
      .catch(() => setErr(true))
  }, [])

  return (
    <div>
      <div className="fx-seclbl">ЭКОНОМИЧЕСКИЙ КАЛЕНДАРЬ · СЕГОДНЯ</div>
      <div className="tbox" style={{ padding: '4px 16px' }}>
        {events && events.length > 0 && events.map((e, i) => (
          <div className="fx-cal-row" key={i} style={{ borderBottom: i === events.length - 1 ? 'none' : undefined }}>
            <span className="fx-cal-imp" style={{ color: IMP_COLOR[e.importance] }}>●</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '.62rem' }}>{e.time}</span>
            <b style={{ fontWeight: 500 }}>{e.currency}</b>
            <span>{e.title}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '.58rem', color: 'var(--muted)' }}>
              {e.forecast ? `прогноз ${e.forecast}` : ''}{e.previous ? ` · пред ${e.previous}` : ''}
            </span>
          </div>
        ))}
        {events && events.length === 0 && (
          <div style={{ textAlign: 'center', padding: 18, color: 'var(--muted)', fontSize: '.66rem' }}>Сегодня значимых событий нет</div>
        )}
        {!events && !err && (
          <div style={{ textAlign: 'center', padding: 18, color: 'var(--muted)', fontSize: '.66rem' }}>Загрузка…</div>
        )}
        {err && (
          <div style={{ textAlign: 'center', padding: 18, color: 'var(--muted)', fontSize: '.66rem' }}>Источник календаря подключается</div>
        )}
      </div>
      <div className="fx-cal-leg">
        <span style={{ color: 'var(--short)' }}>●</span> высокое влияние — торговля блокируется ±1ч &nbsp;
        <span style={{ color: 'var(--wait)' }}>●</span> среднее — нужна повышенная уверенность &nbsp;
        <span style={{ color: 'var(--line3)' }}>●</span> низкое
      </div>
    </div>
  )
}
