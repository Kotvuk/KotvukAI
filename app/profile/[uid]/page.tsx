import { notFound } from 'next/navigation'
import { getPublicProfile } from '@/lib/db'
import type { Metadata } from 'next'

interface Props {
  params: { uid: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseInt(params.uid, 10)
  if (isNaN(id)) return { title: 'Profile | KotvukAI' }
  const profile = await getPublicProfile(id).catch(() => null)
  if (!profile) return { title: 'Profile | KotvukAI' }
  return {
    title: `${profile.nickname} | KotvukAI`,
    description: `${profile.nickname} — ${profile.totalSignals} signals, ${profile.winRate ?? '—'}% win rate on KotvukAI`,
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const id = parseInt(params.uid, 10)
  if (isNaN(id) || id <= 0) notFound()

  const profile = await getPublicProfile(id).catch(() => null)
  if (!profile) notFound()

  const tierColors: Record<string, string> = {
    free: '#888',
    starter: '#60a5fa',
    pro: '#a78bfa',
    elite: '#fbbf24',
  }
  const tierColor = tierColors[profile.tier] ?? '#888'

  const joined = new Date(profile.joinedAt).toLocaleDateString('en', {
    year: 'numeric', month: 'long',
  })

  return (
    <main style={{
      minHeight: '100vh', background: '#0a0f1e', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#111827',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
        padding: '32px 28px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', fontWeight: 700, flexShrink: 0,
          }}>
            {profile.nickname.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{profile.nickname}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{
                fontSize: '.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                background: `${tierColor}20`, color: tierColor, textTransform: 'uppercase',
                border: `1px solid ${tierColor}40`,
              }}>{profile.tier}</span>
              <span style={{ fontSize: '.6rem', color: '#6b7280' }}>Joined {joined}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {[
            { label: 'Signals',     value: profile.totalSignals.toString() },
            { label: 'Win Rate',    value: profile.winRate !== null ? `${profile.winRate}%` : '—',
              color: profile.winRate !== null ? (profile.winRate >= 55 ? '#00e676' : profile.winRate >= 45 ? '#ffa500' : '#ff4444') : '#888' },
            { label: 'Wins',        value: profile.wins.toString(),   color: '#00e676' },
            { label: 'Losses',      value: profile.losses.toString(), color: '#ff4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 8,
              padding: '14px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '.55rem', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color ?? '#fff' }}>{value}</div>
            </div>
          ))}
        </div>

        {(profile.avgConf !== null || profile.avgPnl !== null) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {profile.avgConf !== null && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '.55rem', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Avg Confidence</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{profile.avgConf}%</div>
              </div>
            )}
            {profile.avgPnl !== null && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '.55rem', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Avg Win PnL</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00e676' }}>+{profile.avgPnl}%</div>
              </div>
            )}
          </div>
        )}

        <a href="/" style={{
          display: 'block', textAlign: 'center', marginTop: 24, padding: '10px 0',
          background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 6, color: '#a78bfa', fontSize: '.68rem', fontWeight: 600,
          textDecoration: 'none',
        }}>
          Try KotvukAI →
        </a>
      </div>
    </main>
  )
}
