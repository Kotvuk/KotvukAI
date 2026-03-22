'use client'
import { useEffect, useState } from 'react'
import { updatePassword } from 'firebase/auth'
import { useLang } from '@/contexts/LangContext'
import { useAuth } from '@/contexts/AuthContext'
import { showToast } from '@/components/ui/Toast'

export default function SettingsPanel() {
  const { t, lang, setLang } = useLang()
  const { user } = useAuth()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.ok && d.settings) {
        if (d.settings.nickname) setNickname(d.settings.nickname)
        if (d.settings.email)    setEmail(d.settings.email)
      }
    }).catch(() => {})
    if (user?.email) setEmail(user.email)
    if (user?.displayName) setNickname(user.displayName)
  }, [user])

  async function save() {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast(t('invalid_email'), 'err'); return }
    if (pass && pass !== pass2) { showToast(t('passwords_no_match'), 'err'); return }
    try {
      const r = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email, lang }),
      })
      const d = await r.json()
      if (!d.ok) { showToast(d.error || t('error'), 'err'); return }
      // Update password in Firebase if provided
      if (pass && user) {
        try {
          await updatePassword(user, pass)
          setPass(''); setPass2('')
        } catch (e: unknown) {
          showToast(e instanceof Error ? e.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '') : t('error'), 'err')
          return
        }
      }
      showToast(t('settings_saved'))
    } catch { showToast(t('error'), 'err') }
  }

  return (
    <div className="panel active" id="panel-settings">
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div className="sb2">
          <div className="st">{t('profile')}</div>
          <div className="fg">
            <div className="ff full"><label className="fl">{t('nickname')}</label>
              <input type="text" className="fi" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="username" /></div>
            <div className="ff full"><label className="fl">{t('email')}</label>
              <input type="email" className="fi" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" /></div>
          </div>
        </div>

        <div className="sb2">
          <div className="st">{t('security')}</div>
          <div className="fg">
            <div className="ff full"><label className="fl">{t('new_password')}</label>
              <input type="password" className="fi" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" /></div>
            <div className="ff full"><label className="fl">{t('confirm_password')}</label>
              <input type="password" className="fi" value={pass2} onChange={e => setPass2(e.target.value)} placeholder="••••••••" /></div>
          </div>
        </div>

        <div className="sb2">
          <div className="st">{t('language')}</div>
          <div className="tg" style={{ maxWidth: 200 }}>
            {(['ru', 'en', 'kz'] as const).map(l => (
              <button key={l} className={`tb ${lang === l ? 'a-d' : ''}`} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '.6rem', color: 'var(--dim)', marginTop: 8 }}>
            {lang === 'ru' ? 'Русский' : lang === 'en' ? 'English' : 'Қазақша'}
          </p>
        </div>

        <button className="ssave" onClick={save}>{t('save')}</button>
      </div>
    </div>
  )
}
