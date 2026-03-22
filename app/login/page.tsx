'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { useLang } from '@/contexts/LangContext'

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

export default function LoginPage() {
  const { t } = useLang()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('error')
      setError(msg.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('error')
      setError(msg.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
    }
    setLoading(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-mark" />
          <span className="auth-logo-text">{t('app_name')}</span>
        </div>
        <div className="auth-title">{t('login')}</div>
        <div className="auth-sub">Войдите в свой аккаунт для доступа к анализу</div>

        {error && <div className="auth-err">{error}</div>}

        <form onSubmit={handleSubmit}>
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
                placeholder="••••••••" required
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
          <button
            type="submit" className="ssave" style={{ width: '100%', marginTop: 8, padding: '9px' }}
            disabled={loading}
          >
            {loading ? '...' : t('sign_in')}
          </button>
        </form>

        <div className="auth-sep"><span>{t('or')}</span></div>

        <button className="google-btn" onClick={handleGoogle} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t('login_with_google')}
        </button>

        <div className="auth-link">
          {t('no_account')} <a href="/register">{t('sign_up')}</a>
        </div>
      </div>
    </div>
  )
}
