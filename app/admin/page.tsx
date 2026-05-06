'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const TIER_COLORS: Record<string, string> = {
  free: '#666', starter: '#0a84ff', pro: '#30d158', elite: '#ffd60a',
}
const TIER_LIMITS: Record<string, { analyses: number; label: string; price: string }> = {
  free:    { analyses: 3,   label: 'Free',    price: '$0/РјРµСЃ' },
  starter: { analyses: 10,  label: 'Starter', price: '$9/РјРµСЃ' },
  pro:     { analyses: 30,  label: 'Pro',     price: '$29/РјРµСЃ' },
  elite:   { analyses: 100, label: 'Elite',   price: '$79/РјРµСЃ' },
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
  const [users, setUsers]           = useState<UserRow[]>([])
  const [stats, setStats]           = useState<Stats | null>(null)
  const [error, setError]           = useState('')
  const [saving, setSaving]         = useState<number | null>(null)
  const [deleting, setDeleting]     = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [search, setSearch]         = useState('')
  const [expiryMap, setExpiryMap]   = useState<Record<number, string>>({})

  const loadUsers = useCallback(() => {
    if (!user) return
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.error || 'Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰С‘РЅ'); return }
        setUsers(d.users)
        setStats(d.stats)
        const map: Record<number, string> = {}
        for (const u of d.users) {
          if (u.expires_at) map[u.id] = u.expires_at.slice(0, 10)
        }
        setExpiryMap(map)
      })
      .catch(() => setError('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё'))
  }, [user])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => { loadUsers() }, [loadUsers])

  const changeTier = async (userId: number, tier: string) => {
    setSaving(userId)
    const expires = expiryMap[userId] || null
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, tier, expires_at: expires }),
    })
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier, expires_at: expires } : u))
    setSaving(null)
  }

  const deleteUser = async (userId: number) => {
    setDeleting(userId)
    const r = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    if ((await r.json()).ok) {
      setUsers(prev => prev.filter(u => u.id !== userId))
      setConfirmDel(null)
      loadUsers()
    }
    setDeleting(null)
  }

  const isExpired = (expires_at: string | null) => {
    if (!expires_at) return false
    return new Date(expires_at) < new Date()
  }

  const filtered = users.filter(u =>
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
    String(u.id).includes(search)
  )

  if (loading) return <div style={{ color: '#fff', padding: 40 }}>Р—Р°РіСЂСѓР·РєР°...</div>
  if (error) return (
    <div style={{ color: '#ff453a', padding: 40, fontFamily: 'monospace' }}>
      вќЊ {error}<br />
      <small style={{ color: '#888' }}>Р”РѕСЃС‚СѓРї С‚РѕР»СЊРєРѕ РґР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРІ.</small>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e5e5e5', fontFamily: 'monospace', padding: 24 }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>

        {/* Р—Р°РіРѕР»РѕРІРѕРє */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0a84ff' }}>вљЎ KotvukAI Admin</div>
          <button onClick={() => loadUsers()}
            style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            в†» РћР±РЅРѕРІРёС‚СЊ
          </button>
          <button onClick={() => router.push('/dashboard')}
            style={{ marginLeft: 'auto', background: '#1a1a1a', border: '1px solid #333', color: '#aaa', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            в†ђ Р”Р°С€Р±РѕСЂРґ
          </button>
        </div>

        {/* РљР°СЂС‚РѕС‡РєРё С‚Р°СЂРёС„РѕРІ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {TIERS.map(tier => {
            const count = users.filter(u => (u.tier || 'free') === tier).length
            const info = TIER_LIMITS[tier]
            const color = TIER_COLORS[tier]
            return (
              <div key={tier} style={{ background: '#111', border: `1px solid ${color}33`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color, textTransform: 'uppercase' }}>{info.label}</span>
                  <span style={{ fontSize: 11, color: '#555' }}>{info.price}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ В· {info.analyses} Р°РЅР°Р»РёР·РѕРІ/РґРµРЅСЊ</div>
              </div>
            )
          })}
        </div>

        {/* РћР±С‰Р°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР° */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 28 }}>
            {[
              { label: 'Р’СЃРµРіРѕ РїРѕР»СЊР·.', value: stats.total_users, color: '#0a84ff' },
              { label: 'РЎРёРіРЅР°Р»РѕРІ',     value: stats.total_signals, color: '#bf5af2' },
              { label: 'РЎРґРµР»РѕРє',       value: stats.total_trades,  color: '#ff9f0a' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* РџРѕРёСЃРє */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="РџРѕРёСЃРє РїРѕ email, РЅРёРєСѓ РёР»Рё ID..."
          style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#e5e5e5',
            padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
        />

        {/* РўР°Р±Р»РёС†Р° */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#161616', borderBottom: '1px solid #222' }}>
                {['ID', 'Email', 'РќРёРє', 'РўР°СЂРёС„', 'РђРЅР°Р»РёР·РѕРІ', 'РСЃС‚РµРєР°РµС‚', 'РЎРјРµРЅР° С‚Р°СЂРёС„Р° + РґР°С‚Р°', 'Р РµРіРёСЃС‚СЂР°С†РёСЏ', 'РЈРґР°Р»РёС‚СЊ'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#555', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const tier = u.tier || 'free'
                const color = TIER_COLORS[tier]
                const limit = TIER_LIMITS[tier].analyses
                const expired = isExpired(u.expires_at)
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1a1a1a', background: i % 2 === 0 ? 'transparent' : '#0a0a0a' }}>
                    {/* ID */}
                    <td style={{ padding: '10px 12px', color: '#444' }}>{u.id}</td>

                    {/* Email */}
                    <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email || 'вЂ”'}
                    </td>

                    {/* РќРёРє */}
                    <td style={{ padding: '10px 12px', color: '#888' }}>{u.nickname || 'вЂ”'}</td>

                    {/* РўР°СЂРёС„ */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: color + '22', color, border: `1px solid ${color}44`,
                        padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                        {tier}
                      </span>
                      {expired && tier !== 'free' && (
                        <span style={{ marginLeft: 6, color: '#ff453a', fontSize: 10 }}>РРЎРўРЃРљ</span>
                      )}
                    </td>

                    {/* РђРЅР°Р»РёР·РѕРІ СЃРµРіРѕРґРЅСЏ */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: (u.analyses_today ?? 0) >= limit ? '#ff453a' : '#888' }}>
                        {u.analyses_today ?? 0}
                      </span>
                      <span style={{ color: '#444' }}>/{limit}</span>
                    </td>

                    {/* Р”Р°С‚Р° РёСЃС‚РµС‡РµРЅРёСЏ */}
                    <td style={{ padding: '10px 12px', color: expired ? '#ff453a' : '#555', whiteSpace: 'nowrap' }}>
                      {u.expires_at ? new Date(u.expires_at).toLocaleDateString('ru-RU') : 'в€ћ'}
                    </td>

                    {/* РЎРјРµРЅР° С‚Р°СЂРёС„Р° + РґР°С‚Р° */}
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          value={tier}
                          onChange={e => changeTier(u.id, e.target.value)}
                          disabled={saving === u.id}
                          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#e5e5e5',
                            padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
                        >
                          {TIERS.map(t => <option key={t} value={t}>{TIER_LIMITS[t].label}</option>)}
                        </select>
                        <input
                          type="date"
                          value={expiryMap[u.id] || ''}
                          onChange={e => setExpiryMap(prev => ({ ...prev, [u.id]: e.target.value }))}
                          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888',
                            padding: '3px 6px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
                        />
                        <button onClick={() => changeTier(u.id, tier)} disabled={saving === u.id}
                          style={{ background: '#0a84ff22', border: '1px solid #0a84ff44', color: '#0a84ff',
                            padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {saving === u.id ? '...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ'}
                        </button>
                      </div>
                    </td>

                    {/* Р РµРіРёСЃС‚СЂР°С†РёСЏ */}
                    <td style={{ padding: '10px 12px', color: '#444', whiteSpace: 'nowrap' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : 'вЂ”'}
                    </td>

                    {/* РЈРґР°Р»РёС‚СЊ */}
                    <td style={{ padding: '10px 12px' }}>
                      {confirmDel === u.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => deleteUser(u.id)} disabled={deleting === u.id}
                            style={{ background: '#ff453a22', border: '1px solid #ff453a44', color: '#ff453a',
                              padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
                            {deleting === u.id ? '...' : 'Р”Р°, СѓРґР°Р»РёС‚СЊ'}
                          </button>
                          <button onClick={() => setConfirmDel(null)}
                            style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888',
                              padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
                            РћС‚РјРµРЅР°
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(u.id)}
                          style={{ background: 'transparent', border: '1px solid #333', color: '#555',
                            padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
                          рџ—‘ РЈРґР°Р»РёС‚СЊ
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#444' }}>
                  {users.length === 0 ? 'РќРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№' : 'РќРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РїРѕРёСЃРєР°'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, color: '#333', fontSize: 11 }}>
          {filtered.length} РёР· {users.length} РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
        </div>
      </div>
    </div>
  )
}
