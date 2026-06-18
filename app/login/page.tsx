'use client'
import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { useLang } from '@/contexts/LangContext'
import LangSwitcher from '@/components/ui/LangSwitcher'
import Logo from '@/components/app/Logo'

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

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export default function LoginPage() {
  const { t } = useLang()
  useEffect(() => {
    document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = '' }
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [unverifiedUser, setUnverifiedUser] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  async function handleGoogleSignIn() {
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      const token = await cred.user.getIdToken()
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      document.cookie = `fb_token=${token}; path=/; max-age=3600; SameSite=Strict`
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('error')
      setError(msg.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
    }
    setLoading(false)
  }

  async function handleResendVerification() {
    setResendLoading(true)
    try {
      const user = auth.currentUser
      if (user) await sendEmailVerification(user)
      setResendDone(true)
    } catch {
      setResendDone(true)
    }
    setResendLoading(false)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError(t('enter_email_required')); return }
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setForgotSent(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('error')
      setError(msg.replace('Firebase: ', '').replace(/\(auth.*\)/, ''))
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUnverifiedUser(false)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      if (!cred.user.emailVerified) {
        setUnverifiedUser(true)
        setLoading(false)
        return
      }
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
          <Logo size={24} />
        </div>
        <div className="auth-title">{t('login')}</div>
        <div className="auth-sub">{t('login_sub')}</div>

        {!forgotMode && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fff', border: '1px solid #ddd', borderRadius: 2, padding: '8px 12px', cursor: 'pointer', fontSize: '.65rem', fontFamily: 'var(--mono)', fontWeight: 600, color: '#333', letterSpacing: '.04em', transition: 'background .12s', marginBottom: 4 }}
            >
              <GoogleIcon />
              {t('login_with_google')}
            </button>
            <div className="auth-sep"><span>{t('or')}</span></div>
          </>
        )}

        {!forgotMode && unverifiedUser && (
          <div style={{ background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: '.63rem', color: '#ff9f0a', lineHeight: 1.5 }}>
              {t('email_not_verified')}
            </div>
            <div style={{ marginTop: 8 }}>
              {resendDone ? (
                <span style={{ fontSize: '.6rem', color: 'var(--long)' }}>{t('verify_email_resent')}</span>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  style={{ background: 'none', border: 'none', color: '#ff9f0a', fontSize: '.6rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  {resendLoading ? '...' : t('verify_email_resend')}
                </button>
              )}
            </div>
          </div>
        )}

        {!forgotMode && !unverifiedUser && error && <div className="auth-err">{error}</div>}
        {!forgotMode && unverifiedUser && error && <div className="auth-err">{error}</div>}

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
                onClick={() => { setForgotMode(true); setError(''); setForgotSent(false); setUnverifiedUser(false) }}
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
