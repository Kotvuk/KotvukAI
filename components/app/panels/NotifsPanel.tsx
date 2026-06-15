'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LangContext'
import { showToast } from '@/components/ui/Toast'
import { fmtLocal } from '@/lib/fmt'

interface Notif { id: number; message: string; read: boolean; created_at: string }

export default function NotifsPanel({ onCount }: { onCount?: (n: number) => void }) {
  const { t } = useLang()
  const [items, setItems] = useState<Notif[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const r = await fetch('/api/notifications')
    const d = await r.json()
    const list: Notif[] = d.notifications || []
    setItems(list)
    onCount?.(list.filter(n => !n.read).length)
    if (list.some(n => !n.read)) fetch('/api/notifications/read', { method: 'POST' })
  }

  async function clearAll() {
    await fetch('/api/notifications', { method: 'DELETE' })
    setItems([])
    onCount?.(0)
    showToast(t('cleared'))
  }

  return (
    <div className="panel active" id="panel-notifs">
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--line2)' }}>
          <span className="sec" style={{ margin: 0, border: 'none', padding: 0 }}>{t('alerts')}</span>
          <button className="run" onClick={clearAll} style={{ padding: '4px 11px', fontSize: '.6rem', background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid var(--line2)' }}>{t('clear')}</button>
        </div>
        <div className="tbox">
          {!items.length ? (
            <div className="empty">
              <div className="empty-t">{t('no_alerts')}</div>
              <div className="empty-s">{t('alerts_appear')}</div>
            </div>
          ) : items.map(n => (
            <div className="no-i" key={n.id} style={{ borderLeftColor: !n.read ? 'var(--cyan)' : 'transparent' }}>
              <span className="no-m">{n.message}</span>
              <span className="no-t">{fmtLocal(n.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
