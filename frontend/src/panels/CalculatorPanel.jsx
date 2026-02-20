import React, { useState, useMemo, useEffect } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  inputStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  resultCard: (color) => ({ background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16, borderLeft: `3px solid ${color}`, textAlign: 'center' }),
});

export default function CalculatorPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  
  // State with localStorage persistence
  const [deposit, setDeposit] = useState(() => {
    try { return JSON.parse(localStorage.getItem('calc_deposit')) || 10000; } catch { return 10000; }
  });
  const [riskPct, setRiskPct] = useState(() => {
    try { return JSON.parse(localStorage.getItem('calc_risk')) || 2; } catch { return 2; }
  });
  const [entryPrice, setEntryPrice] = useState(() => {
    try { return JSON.parse(localStorage.getItem('calc_entry')) || 95000; } catch { return 95000; }
  });
  const [stopLoss, setStopLoss] = useState(() => {
    try { return JSON.parse(localStorage.getItem('calc_sl')) || 93000; } catch { return 93000; }
  });
  const [takeProfit, setTakeProfit] = useState(() => {
    try { return JSON.parse(localStorage.getItem('calc_tp')) || 100000; } catch { return 100000; }
  });
  const [leverage, setLeverage] = useState(() => {
    try { return JSON.parse(localStorage.getItem('calc_leverage')) || 1; } catch { return 1; }
  });

  const styles = getStyles(theme);

  // Save to localStorage
  useEffect(() => { localStorage.setItem('calc_deposit', JSON.stringify(deposit)); }, [deposit]);
  useEffect(() => { localStorage.setItem('calc_risk', JSON.stringify(riskPct)); }, [riskPct]);
  useEffect(() => { localStorage.setItem('calc_entry', JSON.stringify(entryPrice)); }, [entryPrice]);
  useEffect(() => { localStorage.setItem('calc_sl', JSON.stringify(stopLoss)); }, [stopLoss]);
  useEffect(() => { localStorage.setItem('calc_tp', JSON.stringify(takeProfit)); }, [takeProfit]);
  useEffect(() => { localStorage.setItem('calc_leverage', JSON.stringify(leverage)); }, [leverage]);

  const calc = useMemo(() => {
    const riskAmount = deposit * (riskPct / 100);
    const slDistance = Math.abs(entryPrice - stopLoss);
    const tpDistance = Math.abs(takeProfit - entryPrice);
    if (slDistance === 0 || entryPrice === 0) return null;

    const coins = riskAmount / slDistance;
    const positionSize = coins * entryPrice;
    const positionWithLeverage = positionSize; // position stays same, margin changes
    const margin = positionSize / leverage;
    const maxLoss = riskAmount;
    const potentialProfit = coins * tpDistance;
    const riskReward = tpDistance / slDistance;
    const commission = positionSize * 0.001; // 0.1% taker
    const liquidationPrice = entryPrice > stopLoss
      ? entryPrice * (1 - 1 / leverage * 0.95) // long
      : entryPrice * (1 + 1 / leverage * 0.95); // short
    const riskLevel = riskPct <= 1 ? 'low' : riskPct <= 3 ? 'medium' : riskPct <= 5 ? 'high' : 'veryHigh';

    return { positionSize, coins, maxLoss, potentialProfit, riskReward, liquidationPrice, commission, riskLevel, margin };
  }, [deposit, riskPct, entryPrice, stopLoss, takeProfit, leverage]);

  const riskColors = { low: '#22c55e', medium: '#eab308', high: '#f97316', veryHigh: '#ef4444' };

  return (
    <div>
      <h2 style={{ color: theme.text, fontSize: 20, marginBottom: 16 }}>🧮 {t('calculatorTitle')}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Inputs */}
        <div style={styles.card}>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { label: t('deposit') + ' ($)', value: deposit, set: setDeposit },
              { label: t('riskPercent'), value: riskPct, set: setRiskPct, step: 0.5 },
              { label: t('entryPrice') + ' ($)', value: entryPrice, set: setEntryPrice },
              { label: t('stopLoss') + ' ($)', value: stopLoss, set: setStopLoss },
              { label: t('takeProfit') + ' ($)', value: takeProfit, set: setTakeProfit },
              { label: t('leverage') + ' x', value: leverage, set: setLeverage, min: 1, max: 125 },
            ].map((f, i) => (
              <div key={i}>
                <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input style={styles.inputStyle} type="number" value={f.value} onChange={e => f.set(+e.target.value)} step={f.step || 'any'} min={f.min} max={f.max} />
              </div>
            ))}
          </div>

          {/* Risk Scale */}
          {calc && (
            <div style={{ marginTop: 20 }}>
              <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8, display: 'block' }}>{t('riskScale')}</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {['low', 'medium', 'high', 'veryHigh'].map(level => (
                  <div key={level} style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: calc.riskLevel === level ? riskColors[level] : theme.border,
                    transition: 'all 0.3s'
                  }} />
                ))}
              </div>
              <div style={{ textAlign: 'center', color: riskColors[calc.riskLevel], fontWeight: 600, fontSize: 14 }}>
                {t(calc.riskLevel)}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {calc ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={styles.resultCard(theme.accent)}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('positionSize')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent }}>${calc.positionSize.toFixed(2)}</div>
              </div>
              <div style={styles.resultCard('#8b5cf6')}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('coins')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}>{calc.coins.toFixed(6)}</div>
              </div>
              <div style={styles.resultCard(theme.red)}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('maxLoss')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.red }}>-${calc.maxLoss.toFixed(2)}</div>
              </div>
              <div style={styles.resultCard(theme.green)}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('potentialProfit')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.green }}>+${calc.potentialProfit.toFixed(2)}</div>
              </div>
              <div style={styles.resultCard(theme.yellow)}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('riskReward')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.yellow }}>1:{calc.riskReward.toFixed(2)}</div>
              </div>
              <div style={styles.resultCard('#f97316')}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('liquidationPrice')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f97316' }}>${calc.liquidationPrice.toFixed(2)}</div>
              </div>
              <div style={{ ...styles.resultCard(theme.textMuted), gridColumn: 'span 2' }}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('commission')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.textMuted }}>${calc.commission.toFixed(2)}</div>
              </div>
            </div>
          ) : (
            <div style={{ ...styles.card, textAlign: 'center', color: theme.textSecondary, padding: 40 }}>
              {t('loading')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
