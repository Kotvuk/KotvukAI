import React, { useState } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  inputStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', marginTop: 6 },
  langBtn: (active) => ({ padding: '8px 20px', borderRadius: 8, border: '1px solid ' + (active ? theme.accent : theme.border), background: active ? theme.accent + '33' : 'transparent', color: active ? theme.accent : theme.textSecondary, cursor: 'pointer', fontSize: 14, fontWeight: 600 }),
  planCard: (highlight) => ({
    border: '1px solid ' + (highlight ? theme.accent : theme.border), borderRadius: 12, padding: 20, marginBottom: 16,
    flex: 1, minWidth: 220, textAlign: 'center',
    borderWidth: highlight ? '2px' : '1px',
    background: highlight ? theme.accent + '0D' : theme.cardBg
  }),
});

export default function SettingsPanel() {
  const { lang, setLang, t } = useLang();
  const { theme, themeName, setThemeName } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const styles = getStyles(theme);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ color: theme.text, fontSize: 20, marginBottom: 20 }}>⚙️ {t('settings')}</h2>

      <div style={styles.card}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>🌐 {t('language')}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.langBtn(lang === 'ru')} onClick={() => setLang('ru')}>🇷🇺 Русский</button>
          <button style={styles.langBtn(lang === 'en')} onClick={() => setLang('en')}>🇬🇧 English</button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>🎨 {t('theme')}</h3>
        <p style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>{t('chooseTheme')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.langBtn(themeName === 'dark')} onClick={() => setThemeName('dark')}>🌙 {t('darkTheme')}</button>
          <button style={styles.langBtn(themeName === 'light')} onClick={() => setThemeName('light')}>☀️ {t('lightTheme')}</button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>👤 {t('profile')}</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: theme.textMuted, fontSize: 13 }}>{t('name')}</label>
          <input style={styles.inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Satoshi Nakamoto" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: theme.textMuted, fontSize: 13 }}>{t('email')}</label>
          <input style={styles.inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
        </div>
        <button style={{ background: theme.accent, color: theme.name === 'light' ? '#fff' : theme.text, border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{t('save')}</button>
      </div>

      <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>💎 {t('planUpgrade')}</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { name: t('planFree'), price: t('planFreePrice'), features: t('freeFeatures'), current: true },
          { name: t('planPro'), price: t('planProPrice'), features: t('proFeatures'), highlight: true },
          { name: t('planPremium'), price: t('planPremiumPrice'), features: t('premiumFeatures') }
        ].map((plan, i) => (
          <div key={i} style={styles.planCard(plan.highlight)}>
            <h4 style={{ color: theme.text, fontSize: 18, marginBottom: 8 }}>{plan.name}</h4>
            <div style={{ fontSize: 28, fontWeight: 700, color: plan.highlight ? theme.accent : theme.text, marginBottom: 12 }}>{plan.price}</div>
            <div style={{ color: theme.textMuted, fontSize: 13, lineHeight: 2, textAlign: 'left', whiteSpace: 'pre-line', marginBottom: 16 }}>
              {plan.features.split('\n').map((f, j) => <div key={j}>✓ {f}</div>)}
            </div>
            <button style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: plan.current ? theme.border : theme.accent, color: plan.current ? theme.textMuted : (theme.name === 'light' ? '#fff' : theme.text)
            }}>
              {plan.current ? t('planCurrent') : t('planUpgrade')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
