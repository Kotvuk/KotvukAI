const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { checkAiLimit, getAiUsageKey, dailyAiUsage } = require('../middleware/rateLimit');
const { calcIndicators } = require('../services/indicators');

const GROQ_KEY = process.env.GROQ_API_KEY || '';

router.get('/usage', (req, res) => {
  const plan = req.user?.plan || 'Free';
  const limits = { Free: 5, Pro: 50, Premium: -1 };
  const limit = limits[plan];
  const key = getAiUsageKey(req.userId);
  const used = dailyAiUsage[key] || 0;
  res.json({ used, limit, remaining: limit === -1 ? 'unlimited' : Math.max(0, limit - used), plan });
});

router.post('/analyze', async (req, res) => {
  if (!checkAiLimit(req, res)) return;
  try {
    const { symbol, price, change24h, high, low, volume, fng, marketData } = req.body;

    const timeframes = ['5m', '15m', '1h', '4h', '1d', '1w'];
    const klinesData = {};
    const indicators = {};
    for (const tf of timeframes) {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol || 'BTCUSDT'}&interval=${tf}&limit=200`);
        const klines = await r.json();
        if (Array.isArray(klines)) {
          klinesData[tf] = klines;
          indicators[tf] = calcIndicators(klines);
        }
      } catch (e) { console.error(`Klines ${tf} error:`, e.message); }
    }

    let btcContext = '';
    if (symbol && symbol !== 'BTCUSDT') {
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        const btcData = await r.json();
        const btcChange = (+btcData.priceChangePercent).toFixed(2);
        const btcTrend = +btcChange > 0 ? 'bullish' : 'bearish';
        btcContext = `\n\n📊 BTC Correlation: BTC 24h trend: ${btcChange > 0 ? '+' : ''}${btcChange}% (${btcTrend} context)${+btcChange < -3 ? ' — be cautious with longs' : +btcChange > 3 ? ' — bullish momentum supports longs' : ''}`;
      } catch (e) {}
    }

    const pastSignals = db.prepare('SELECT * FROM signal_results ORDER BY created_at DESC LIMIT 10').all();
    let learningContext = '';
    if (pastSignals.length > 0) {
      learningContext = '\n\n🧠 SELF-LEARNING — Here are your past 10 signals and outcomes. Learn from mistakes:\n';
      for (const sig of pastSignals) {
        learningContext += `- ${sig.pair} ${sig.direction || '?'} @ $${sig.entry_price} → ${sig.result === 'tp_hit' ? '✅ TP Hit' : sig.result === 'sl_hit' ? '❌ SL Hit' : sig.result === 'timeout' ? '⏰ Timeout' : '⏳ Pending'}`;
        if (sig.ai_reflection) learningContext += ` | Reflection: ${sig.ai_reflection.slice(0, 100)}`;
        learningContext += '\n';
      }
      learningContext += '\nUse these outcomes to improve your accuracy. Avoid repeating past mistakes.\n';
    }

    let indicatorText = '';
    for (const tf of timeframes) {
      if (indicators[tf]) {
        const ind = indicators[tf];
        indicatorText += `\n[${tf.toUpperCase()}] RSI(14): ${ind.rsi14 ?? 'N/A'} | EMA9: ${ind.ema9 ?? 'N/A'} | EMA21: ${ind.ema21 ?? 'N/A'} | EMA50: ${ind.ema50 ?? 'N/A'} | EMA200: ${ind.ema200 ?? 'N/A'} | MACD: ${ind.macd?.macd ?? 'N/A'}`;
      }
    }

    const tfSignals = {};
    for (const tf of timeframes) {
      if (indicators[tf]) {
        const ind = indicators[tf];
        const bullish = (ind.rsi14 && ind.rsi14 > 50) && (ind.ema9 && ind.ema21 && ind.ema9 > ind.ema21);
        tfSignals[tf] = bullish ? 'bullish' : 'bearish';
      }
    }
    let tfAgreement = '';
    const allSame = Object.values(tfSignals).length > 1 && new Set(Object.values(tfSignals)).size === 1;
    if (Object.values(tfSignals).length > 1) {
      tfAgreement = allSame
        ? `\n\n⚡ All timeframes AGREE: ${Object.values(tfSignals)[0].toUpperCase()} — stronger signal`
        : `\n\n⚠️ Timeframes DISAGREE: ${Object.entries(tfSignals).map(([k, v]) => `${k}=${v}`).join(', ')} — be cautious`;
    }

    const prompt = `Проанализируй криптовалюту ${symbol || 'BTCUSDT'} по 6 таймфреймам.

Текущие данные:
- Цена: $${price}
- Изменение за 24ч: ${change24h}%
- Максимум 24ч: $${high}
- Минимум 24ч: $${low}
- Объём: ${volume}
- Индекс страха и жадности: ${fng || 'N/A'}
${marketData ? `- Дополнительные данные рынка: ${JSON.stringify(marketData)}` : ''}

📐 Рассчитанные технические индикаторы по 6 таймфреймам:${indicatorText}${tfAgreement}${btcContext}${learningContext}

Дай структурированный анализ:

## 📊 Общий Анализ
- **Общий тренд**: (Bullish/Bearish/Neutral) с учетом всех таймфреймов
- **Согласие таймфреймов**: X/6 TF показывают бычий сигнал
- **Общая уверенность**: X% (число от 0 до 100)
- **Оценка монеты**: X/10 (число от 1 до 10)

## 📈 Анализ по таймфреймам
### 5M: (тренд, RSI, EMA статус, MACD сигнал)
### 15M: (тренд, RSI, EMA статус, MACD сигнал) 
### 1H: (тренд, RSI, EMA статус, MACD сигнал)
### 4H: (тренд, RSI, EMA статус, MACD сигнал)
### 1D: (тренд, RSI, EMA статус, MACD сигнал)
### 1W: (тренд, RSI, EMA статус, MACD сигнал)

## 🎯 Торговый Сигнал
- **Направление**: LONG/SHORT/НЕЙТРАЛЬНО
- **Точка входа**: $X
- **Take Profit**: $X
- **Stop Loss**: $X
- **Соотношение риск/прибыль**: X:X

## 🔍 Анализ Рисков
- Основные риски позиции
- Уровень волатильности
- Рекомендуемый размер позиции

## 🔑 Ключевые Факторы
- Важные уровни поддержки/сопротивления  
- Триггеры для изменения мнения
- Макроэкономические факторы

Структурируй ответ точно по этим разделам с markdown форматированием.`;

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: 'Ты — профессиональный крипто-аналитик с системой самообучения. Отвечай подробно на русском языке. Используй markdown форматирование. ОБЯЗАТЕЛЬНО укажи числовую уверенность (0-100%) и оценку монеты (1-10).' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7, max_tokens: 2000
      })
    });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || (data?.error?.message ? `Ошибка API: ${data.error.message}` : 'Ошибка получения ответа от AI');

    let confidence = null;
    let coinScore = null;
    const confMatch = text.match(/[Уу]веренность[:\s]*(\d{1,3})\s*%/i) || text.match(/(\d{1,3})\s*%/);
    if (confMatch) confidence = Math.min(100, Math.max(0, +confMatch[1]));
    const scoreMatch = text.match(/[Оо]ценка\s*монеты[:\s]*(\d{1,2})\s*\/\s*10/i) || text.match(/(\d{1,2})\s*\/\s*10/);
    if (scoreMatch) coinScore = Math.min(10, Math.max(1, +scoreMatch[1]));

    let direction = null;
    const upper = text.toUpperCase();
    if (upper.includes('LONG') && !upper.includes('SHORT')) direction = 'LONG';
    else if (upper.includes('SHORT') && !upper.includes('LONG')) direction = 'SHORT';

    let entryPrice = +price;
    let tpPrice = null;
    let slPrice = null;
    const tpMatch = text.match(/(?:TP|Take\s*Profit)[:\s]*\$?([\d,.]+)/i);
    const slMatch = text.match(/(?:SL|Stop\s*Loss)[:\s]*\$?([\d,.]+)/i);
    if (tpMatch) tpPrice = +tpMatch[1].replace(',', '');
    if (slMatch) slPrice = +slMatch[1].replace(',', '');

    if (direction && entryPrice) {
      try {
        db.prepare(
          'INSERT INTO signal_results (pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score) VALUES (?,?,?,?,?,?,?,?)'
        ).run(symbol || 'BTCUSDT', direction, entryPrice, tpPrice, slPrice, text.slice(0, 500), confidence, coinScore);
        console.log(`📝 Signal saved: ${symbol} ${direction} @ $${entryPrice}`);
      } catch (e) { console.error('Save signal error:', e.message); }
    }

    res.json({ analysis: text, confidence, coinScore, direction, entryPrice, tpPrice, slPrice });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chat', async (req, res) => {
  if (!checkAiLimit(req, res)) return;
  try {
    const { message, history = [] } = req.body;
    const messages = [
      { role: 'system', content: 'Ты — AI помощник на платформе KotvukAI. Отвечай на вопросы о криптовалютах, трейдинге, техническом и фундаментальном анализе. Будь полезным и дружелюбным. Отвечай на том языке, на котором задан вопрос.' },
      ...history.filter(m => m.role && m.content).slice(-10),
      { role: 'user', content: message }
    ];
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: 'moonshotai/kimi-k2-instruct', messages, temperature: 0.7, max_tokens: 1500 })
    });
    const data = await r.json();
    res.json({ reply: data?.choices?.[0]?.message?.content || data?.error?.message || 'Ошибка' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
