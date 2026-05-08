'use client'
import { useState } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
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

export default function LoginPage() {
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError(t('enter_email_required')); return }
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setForgotSent(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка'
      setError(msg.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
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
        <div className="auth-title">{t('login')}</div>
        <div className="auth-sub">{t('login_sub')}</div>

        {!forgotMode && error && <div className="auth-err">{error}</div>}

        {!forgotMode && <form onSubmit={handleSubmit}>
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
        </form>}

        {!forgotMode ? (
          <>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(''); setForgotSent(false) }}
                style={{ background: 'none', border: 'none', color: 'var(--cyan)', fontSize: '.65rem', cursor: 'pointer', padding: 0 }}
              >
                {t('forgot_password')}
              </button>
            </div>
            <div className="auth-link">
              {t('no_account')} <a href="/register">{t('sign_up')}</a>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 14 }}>
            {forgotSent ? (
              <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 4, padding: '10px 14px', fontSize: '.65rem', color: 'var(--long)', textAlign: 'center' }}>
                {t('forgot_sent_prefix')} <strong>{email}</strong>.<br />{t('forgot_sent_check')}
              </div>
            ) : (
              <form onSubmit={handleForgot}>
                <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 10 }}>
                  {t('forgot_desc')}
                </div>
                {error && <div className="auth-err">{error}</div>}
                <div className="auth-ff">
                  <label className="fl">{t('email')}</label>
                  <input
                    type="email" className="fi" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="user@example.com" required
                  />
                </div>
                <button type="submit" className="ssave" style={{ width: '100%', padding: '9px' }} disabled={loading}>
                  {loading ? '...' : t('forgot_send')}
                </button>
              </form>
            )}
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setError(''); setForgotSent(false) }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '.63rem', cursor: 'pointer', padding: 0 }}
              >
                {t('forgot_back')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
