'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const TIER_COLORS: Record<string, string> = {
  free: '#555', starter: '#0a84ff', pro: '#30d158', elite: '#ffd60a',
}
const TIERS = ['free', 'starter', 'pro', 'elite']

interface UserRow {
  id: number; firebase_uid: string; email: string | null; nickname: string | null
  lang: string; created_at: string; tier: string | null
  analyses_today: number | null; last_reset_date: string | null; expires_at: string | null
}
interface Stats {
  total_users: number; free_users: number; starter_users: number
  pro_users: number; elite_users: number; total_signals: number; total_trades: number
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers]   = useState<UserRow[]>([])
  const [stats, setStats]   = useState<Stats | null>(null)
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.error || 'Доступ запрещён'); return }
        setUsers(d.users)
        setStats(d.stats)
      })
      .catch(() => setError('Ошибка загрузки'))
  }, [user])

  const changeTier = async (userId: number, tier: string) => {
    setSaving(userId)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, tier }),
    })
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u))
    setSaving(null)
  }

  const filtered = users.filter(u =>
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.nickname || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ color: '#fff', padding: 40 }}>Загрузка...</div>
  if (error) return (
    <div style={{ color: '#ff453a', padding: 40, fontFamily: 'monospace' }}>
      ❌ {error}<br />
      <small style={{ color: '#888' }}>Доступ только для администраторов.</small>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e5e5e5', fontFamily: 'monospace', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0a84ff' }}>⚡ KotvukAI Admin</div>
          <button onClick={() => router.push('/dashboard')}
            style={{ marginLeft: 'auto', background: '#1a1a1a', border: '1px solid #333', color: '#aaa', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            ← Дашборд
          </button>
        </div>

        {/* Статистика */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Пользователей', value: stats.total_users, color: '#0a84ff' },
              { label: 'Free',    value: stats.free_users,    color: '#555' },
              { label: 'Starter', value: stats.starter_users, color: '#0a84ff' },
              { label: 'Pro',     value: stats.pro_users,     color: '#30d158' },
              { label: 'Elite',   value: stats.elite_users,   color: '#ffd60a' },
              { label: 'Сигналов', value: stats.total_signals, color: '#bf5af2' },
              { label: 'Сделок',   value: stats.total_trades,  color: '#ff9f0a' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Поиск */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по email или нику..."
          style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#e5e5e5',
            padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }}
        />

        {/* Таблица пользователей */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#161616', borderBottom: '1px solid #222' }}>
                {['ID', 'Email', 'Ник', 'Тариф', 'Анализов сегодня', 'Регистрация', 'Действие'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #1a1a1a', background: i % 2 === 0 ? 'transparent' : '#0a0a0a' }}>
                  <td style={{ padding: '10px 12px', color: '#555' }}>{u.id}</td>
                  <td style={{ padding: '10px 12px' }}>{u.email || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#aaa' }}>{u.nickname || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: TIER_COLORS[u.tier || 'free'] + '22', color: TIER_COLORS[u.tier || 'free'],
                      border: `1px solid ${TIER_COLORS[u.tier || 'free']}44`, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                      {u.tier || 'free'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>
                    {u.analyses_today ?? 0}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#555' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <select
                      value={u.tier || 'free'}
                      onChange={e => changeTier(u.id, e.target.value)}
                      disabled={saving === u.id}
                      style={{ background: '#1a1a1a', border: '1px solid #333', color: '#e5e5e5',
                        padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                    >
                      {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {saving === u.id && <span style={{ color: '#0a84ff', marginLeft: 8, fontSize: 11 }}>сохранение...</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#444' }}>Нет пользователей</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, color: '#444', fontSize: 11 }}>
          {filtered.length} из {users.length} пользователей
        </div>
      </div>
    </div>
  )
}
