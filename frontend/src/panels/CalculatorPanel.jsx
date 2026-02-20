import React, { useState, useMemo } from 'react';
import { useLang } from '../LangContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const inputStyle = { width: '100%', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' };
const resultCard = (color) => ({ ...card, borderLeft: `3px solid ${color}`, textAlign: 'center' });

export default function CalculatorPanel() {
  const { t } = useLang();
  const [deposit, setDeposit] = useState(10000);
  const [riskPct, setRiskPct] = useState(2);
  const [entryPrice, setEntryPrice] = useState(95000);
  const [stopLoss, setStopLoss] = useState(93000);
  const [takeProfit, setTakeProfit] = useState(100000);
  const [leverage, setLeverage] = useState(1);

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
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 16 }}>🧮 {t('calculatorTitle')}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Inputs */}
        <div style={card}>
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
                <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input style={inputStyle} type="number" value={f.value} onChange={e => f.set(+e.target.value)} step={f.step || 'any'} min={f.min} max={f.max} />
              </div>
            ))}
          </div>

          {/* Risk Scale */}
          {calc && (
            <div style={{ marginTop: 20 }}>
              <label style={{ color: '#888', fontSize: 12, marginBottom: 8, display: 'block' }}>{t('riskScale')}</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {['low', 'medium', 'high', 'veryHigh'].map(level => (
                  <div key={level} style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: calc.riskLevel === level ? riskColors[level] : 'rgba(255,255,255,0.06)',
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
              <div style={resultCard('#3b82f6')}>
                <div style={{ fontSize: 12, color: '#888' }}>{t('positionSize')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}>${calc.positionSize.toFixed(2)}</div>
              </div>
              <div style={resultCard('#8b5cf6')}>
                <div style={{ fontSize: 12, color: '#888' }}>{t('coins')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}>{calc.coins.toFixed(6)}</div>
              </div>
              <div style={resultCard('#ef4444')}>
                <div style={{ fontSize: 12, color: '#888' }}>{t('maxLoss')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>-${calc.maxLoss.toFixed(2)}</div>
              </div>
              <div style={resultCard('#22c55e')}>
                <div style={{ fontSize: 12, color: '#888' }}>{t('potentialProfit')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>+${calc.potentialProfit.toFixed(2)}</div>
              </div>
              <div style={resultCard('#eab308')}>
                <div style={{ fontSize: 12, color: '#888' }}>{t('riskReward')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#eab308' }}>1:{calc.riskReward.toFixed(2)}</div>
              </div>
              <div style={resultCard('#f97316')}>
                <div style={{ fontSize: 12, color: '#888' }}>{t('liquidationPrice')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f97316' }}>${calc.liquidationPrice.toFixed(2)}</div>
              </div>
              <div style={{ ...resultCard('#666'), gridColumn: 'span 2' }}>
                <div style={{ fontSize: 12, color: '#888' }}>{t('commission')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#888' }}>${calc.commission.toFixed(2)}</div>
              </div>
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', color: '#555', padding: 40 }}>
              {t('loading')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
