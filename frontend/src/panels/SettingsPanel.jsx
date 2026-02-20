import React, { useState } from 'react';
import { useLang } from '../LangContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const inputStyle = { width: '100%', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', marginTop: 6 };
const langBtn = (active) => ({ padding: '8px 20px', borderRadius: 8, border: '1px solid ' + (active ? '#3b82f6' : 'rgba(255,255,255,0.1)'), background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#3b82f6' : '#a0a0b0', cursor: 'pointer', fontSize: 14, fontWeight: 600 });

const planCard = (highlight) => ({
  ...card, flex: 1, minWidth: 220, textAlign: 'center',
  border: highlight ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.06)',
  background: highlight ? 'rgba(59,130,246,0.05)' : '#12121a'
});

export default function SettingsPanel() {
  const { lang, setLang, t } = useLang();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 20 }}>⚙️ {t('settings')}</h2>

      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>🌐 {t('language')}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={langBtn(lang === 'ru')} onClick={() => setLang('ru')}>🇷🇺 Русский</button>
          <button style={langBtn(lang === 'en')} onClick={() => setLang('en')}>🇬🇧 English</button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>👤 {t('profile')}</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#888', fontSize: 13 }}>{t('name')}</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Satoshi Nakamoto" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#888', fontSize: 13 }}>{t('email')}</label>
          <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
        </div>
        <button style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{t('save')}</button>
      </div>

      <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>💎 {t('planUpgrade')}</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { name: t('planFree'), price: t('planFreePrice'), features: t('freeFeatures'), current: true },
          { name: t('planPro'), price: t('planProPrice'), features: t('proFeatures'), highlight: true },
          { name: t('planPremium'), price: t('planPremiumPrice'), features: t('premiumFeatures') }
        ].map((plan, i) => (
          <div key={i} style={planCard(plan.highlight)}>
            <h4 style={{ color: '#fff', fontSize: 18, marginBottom: 8 }}>{plan.name}</h4>
            <div style={{ fontSize: 28, fontWeight: 700, color: plan.highlight ? '#3b82f6' : '#fff', marginBottom: 12 }}>{plan.price}</div>
            <div style={{ color: '#888', fontSize: 13, lineHeight: 2, textAlign: 'left', whiteSpace: 'pre-line', marginBottom: 16 }}>
              {plan.features.split('\n').map((f, j) => <div key={j}>✓ {f}</div>)}
            </div>
            <button style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: plan.current ? 'rgba(255,255,255,0.06)' : '#3b82f6', color: plan.current ? '#888' : '#fff'
            }}>
              {plan.current ? t('planCurrent') : t('planUpgrade')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
