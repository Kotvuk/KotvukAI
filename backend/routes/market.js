const express = require('express');
const router = express.Router();

router.get('/klines', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', interval = '1h', limit = 500 } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ticker24h', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await r.json();
    const pairs = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'];
    res.json(data.filter(t => pairs.includes(t.symbol)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/price', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/prices', async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) return res.json([]);
    const list = symbols.split(',');
    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const data = await r.json();
    res.json(data.filter(t => list.includes(t.symbol)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ticker24h/single', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/fng', async (req, res) => {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1');
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/exchangeInfo', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    const data = await r.json();
    const usdtPairs = data.symbols
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .map(s => s.symbol);
    res.json(usdtPairs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/heatmap', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await r.json();
    const usdt = data.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a, b) => (+b.quoteVolume) - (+a.quoteVolume))
      .slice(0, 30);
    res.json(usdt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/screener', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await r.json();
    const usdt = data.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a, b) => (+b.quoteVolume) - (+a.quoteVolume));
    res.json(usdt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Level 2 data
router.get('/level2', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', limit = 1000 } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${Math.min(+limit, 5000)}`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/level2/spread', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=5`);
    const data = await r.json();
    const bestBid = data.bids?.[0] ? +data.bids[0][0] : 0;
    const bestAsk = data.asks?.[0] ? +data.asks[0][0] : 0;
    const spread = bestAsk - bestBid;
    const spreadPct = bestBid > 0 ? (spread / bestBid * 100) : 0;
    res.json({ symbol, bestBid, bestAsk, spread: +spread.toFixed(8), spreadPct: +spreadPct.toFixed(6) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
