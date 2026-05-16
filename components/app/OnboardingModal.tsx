'use client'
import { useState, useEffect } from 'react'
import { useLang } from '@/contexts/LangContext'

export default function OnboardingModal() {
  const { t } = useLang()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('kotvukai_onboarded')) {
      setVisible(true)
    }
  }, [])

  function finish() {
    localStorage.setItem('kotvukai_onboarded', '1')
    setVisible(false)
  }

  if (!visible) return null

  const STEPS = [
    { title: t('ob_step1_title'), icon: '🤖', body: t('ob_step1_body') },
    { title: t('ob_step2_title'), icon: '📊', body: t('ob_step2_body') },
    { title: t('ob_step3_title'), icon: '📈', body: t('ob_step3_body') },
  ]

  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10,
        maxWidth: 420, width: '100%', padding: '28px 28px 22px', position: 'relative',
      }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 22 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'var(--cyan)' : 'var(--bg3)',
              transition: 'width .25s, background .25s',
            }} />
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: '2rem', marginBottom: 12 }}>{s.icon}</div>
        <div style={{ textAlign: 'center', fontSize: '.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          {s.title}
        </div>
        <div style={{ fontSize: '.68rem', color: 'var(--muted)', lineHeight: 1.65, textAlign: 'center', marginBottom: 24 }}>
          {s.body}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{ flex: 1, padding: '9px', background: 'var(--bg3)', border: '1px solid var(--line2)', borderRadius: 5, color: 'var(--muted)', fontSize: '.65rem', cursor: 'pointer' }}
            >
              {t('ob_back_lbl')}
            </button>
          )}
          <button
            onClick={() => isLast ? finish() : setStep(s => s + 1)}
            style={{ flex: 2, padding: '9px', background: 'var(--cyan)', border: 'none', borderRadius: 5, color: '#000', fontSize: '.68rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {isLast ? t('ob_start_lbl') : t('ob_next_lbl')}
          </button>
        </div>

        <button
          onClick={finish}
          style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: 'var(--dim)', fontSize: '.75rem', cursor: 'pointer', padding: 4 }}
          title={t('ob_skip_lbl')}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
