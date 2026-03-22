'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import Header from '@/components/app/Header'
import Toast from '@/components/ui/Toast'
import DashPanel from '@/components/app/panels/DashPanel'
import AiPanel from '@/components/app/panels/AiPanel'
import TradesPanel from '@/components/app/panels/TradesPanel'
import NewsPanel from '@/components/app/panels/NewsPanel'
import NotifsPanel from '@/components/app/panels/NotifsPanel'
import HistoryPanel from '@/components/app/panels/HistoryPanel'
import SettingsPanel from '@/components/app/panels/SettingsPanel'
import AiChat from '@/components/app/AiChat'

type Panel = 'dash' | 'ai' | 'trades' | 'news' | 'notifs' | 'history' | 'settings'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [active, setActive] = useState<Panel>('dash')
  const [notifCount, setNotifCount] = useState(0)
  const chatContextFnRef = useRef<(() => Record<string, unknown>) | null>(null)
  const getChatContext = useCallback(() => chatContextFnRef.current?.() || {}, [])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' }}>
        <div className="loading">
          <div className="ld-bar" />
          <div className="ld-t">KOTVUK AI</div>
          <div className="ld-s">инициализация...</div>
        </div>
      </div>
    )
  }

  if (!user) return null

  const navItems: { id: Panel; label: string; icon: React.ReactNode; dot?: boolean }[] = [
    {
      id: 'dash', label: t('nav_dashboard'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
    },
    {
      id: 'ai', label: t('nav_ai'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
    },
    {
      id: 'trades', label: t('nav_trades'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
    },
    {
      id: 'news', label: t('nav_news'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" /><line x1="6" y1="8" x2="18" y2="8" /><line x1="6" y1="12" x2="14" y2="12" /></svg>,
    },
    {
      id: 'notifs', label: t('nav_alerts'), dot: notifCount > 0,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
    },
    {
      id: 'history', label: t('nav_history'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    },
    {
      id: 'settings', label: t('nav_settings'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" /></svg>,
    },
  ]

  return (
    <>
      <Toast />
      <div id="app">
        <Header />

        <nav id="nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nb ${active === item.id ? 'active' : ''}`}
              onClick={() => setActive(item.id)}
            >
              {item.icon}
              {item.label}
              {item.dot && <span className="nb-dot" />}
            </button>
          ))}
        </nav>

        <div id="content">
          {active === 'dash'     && <DashPanel />}
          {active === 'ai'       && <AiPanel active={active === 'ai'} onGetContext={fn => { chatContextFnRef.current = fn }} />}
          {active === 'trades'   && <TradesPanel />}
          {active === 'news'     && <NewsPanel />}
          {active === 'notifs'   && <NotifsPanel onCount={setNotifCount} />}
          {active === 'history'  && <HistoryPanel />}
          {active === 'settings' && <SettingsPanel />}
        </div>
      </div>
      <AiChat onNavigate={setActive} getContext={getChatContext} />
    </>
  )
}
