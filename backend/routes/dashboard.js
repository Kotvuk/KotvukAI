const express = require('express');
const router = express.Router();
const db = require('../config/database');

const GROQ_KEY = process.env.GROQ_API_KEY || '';

router.get('/', async (req, res) => {
  try {
    const closed = db.prepare('SELECT * FROM trades WHERE status = ?').all('closed');
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const allSignals = db.prepare('SELECT * FROM signal_results WHERE result != ?').all('pending');
    const tpHit = allSignals.filter(s => s.result === 'tp_hit').length;
    const signalAccuracy = allSignals.length > 0 ? (tpHit / allSignals.length * 100) : 0;
    const today = new Date().toISOString().slice(0, 10);
    const todaySignals = db.prepare("SELECT * FROM signal_results WHERE date(created_at) = ? AND result = 'tp_hit' ORDER BY accuracy_score DESC LIMIT 1").all(today);
    const bestSignal = todaySignals[0] || null;

    let topMover = null;
    try {
      const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const data = await r.json();
      const pairs = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT'];
      const filtered = data.filter(t => pairs.includes(t.symbol));
      if (filtered.length) {
        filtered.sort((a, b) => Math.abs(+b.priceChangePercent) - Math.abs(+a.priceChangePercent));
        topMover = { symbol: filtered[0].symbol, change: +filtered[0].priceChangePercent };
      }
    } catch (e) {}

    let fngValue = null;
    try {
      const r = await fetch('https://api.alternative.me/fng/?limit=1');
      const d = await r.json();
      fngValue = d.data?.[0]?.value || null;
    } catch (e) {}

    res.json({ totalPnl, signalAccuracy, totalSignals: allSignals.length, bestSignal, topMover, fngValue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/recommendation', async (req, res) => {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: 'Ты крипто-аналитик. Дай ОДНО короткое предложение — рекомендация дня для трейдера. Максимум 15 слов. На русском.' },
          { role: 'user', content: `Дата: ${new Date().toISOString().slice(0, 10)}. Дай рекомендацию дня.` }
        ],
        temperature: 0.8, max_tokens: 100
      })
    });
    const data = await r.json();
    res.json({ recommendation: data?.choices?.[0]?.message?.content || 'Торгуйте осторожно' });
  } catch (e) { res.json({ recommendation: 'Следите за рынком' }); }
});

module.exports = router;
