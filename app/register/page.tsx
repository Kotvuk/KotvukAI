'use client'
import { useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useLang } from '@/contexts/LangContext'
import LangSwitcher from '@/components/ui/LangSwitcher'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function RegisterPage() {
  const { t } = useLang()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError(t('passwords_no_match')); return }
    if (password.length < 6) { setError(t('password_min_6')); return }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (nickname) await updateProfile(cred.user, { displayName: nickname })
      const token = await cred.user.getIdToken()
      document.cookie = `fb_token=${token}; path=/; max-age=3600; SameSite=Strict`
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('error')
      setError(msg.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
    }
    setLoading(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <LangSwitcher />
        </div>
        <div className="auth-logo">
          <div className="auth-logo-mark" />
          <span className="auth-logo-text">{t('app_name')}</span>
        </div>
        <div className="auth-title">{t('register')}</div>
        <div className="auth-sub">{t('register_sub')}</div>

        {error && <div className="auth-err">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-ff">
            <label className="fl">{t('nickname')}</label>
            <input
              type="text" className="fi" value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="trader42"
            />
          </div>
          <div className="auth-ff">
            <label className="fl">{t('email')}</label>
            <input
              type="email" className="fi" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com" required
            />
          </div>
          <div className="auth-ff">
            <label className="fl">{t('password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'} className="fi" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
                style={{ paddingRight: 32 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          <div className="auth-ff">
            <label className="fl">{t('confirm_password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'} className="fi" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" required
                style={{ paddingRight: 32 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>
          <button
            type="submit" className="ssave" style={{ width: '100%', marginTop: 8, padding: '9px' }}
            disabled={loading}
          >
            {loading ? '...' : t('sign_up')}
          </button>
        </form>

        <div className="auth-link">
          {t('have_account')} <a href="/login">{t('sign_in')}</a>
        </div>
      </div>
    </div>
  )
}
