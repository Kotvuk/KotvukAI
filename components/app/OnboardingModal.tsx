'use client'
import { useState, useEffect } from 'react'

const STEPS = [
  {
    title: 'Добро пожаловать в KotvukAI',
    icon: '🤖',
    body: 'KotvukAI — AI-аналитик криптовалют на основе Smart Money Concepts. Автоматически находит Order Blocks, Fair Value Gaps, определяет HTF Bias и генерирует сигналы LONG/SHORT.',
  },
  {
    title: 'Как пользоваться',
    icon: '📊',
    body: 'Перейдите во вкладку "AI Анализ" → выберите торговую пару и таймфрейм → нажмите "Запустить анализ". AI проведёт 4-шаговый разбор и выдаст сигнал с точками входа, TP и SL.',
  },
  {
    title: 'Торговый журнал и история',
    icon: '📈',
    body: 'Все сигналы автоматически сохраняются в "История". В разделе "Сделки" ведите торговый журнал с PnL. Отмечайте результаты (Win/Loss) — AI будет считать статистику и помогать улучшить систему.',
  },
]

export default function OnboardingModal() {
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
        {/* Progress dots */}
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
              Назад
            </button>
          )}
          <button
            onClick={() => isLast ? finish() : setStep(s => s + 1)}
            style={{ flex: 2, padding: '9px', background: 'var(--cyan)', border: 'none', borderRadius: 5, color: '#000', fontSize: '.68rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {isLast ? 'Начать работу' : 'Далее →'}
          </button>
        </div>

        <button
          onClick={finish}
          style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: 'var(--dim)', fontSize: '.75rem', cursor: 'pointer', padding: 4 }}
          title="Пропустить"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
