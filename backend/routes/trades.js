const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { status } = req.query;
  if (status) {
    res.json(db.prepare('SELECT * FROM trades WHERE status = ? ORDER BY opened_at DESC').all(status));
  } else {
    res.json(db.prepare('SELECT * FROM trades ORDER BY opened_at DESC').all());
  }
});

router.post('/', (req, res) => {
  const { pair, direction, quantity, entry_price, tp, sl } = req.body;
  if (!pair || !direction || !quantity || !entry_price) return res.status(400).json({ error: 'Missing fields' });
  const r = db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl) VALUES (?,?,?,?,?,?)').run(pair, direction, quantity, entry_price, tp || null, sl || null);
  res.json({ id: r.lastInsertRowid });
});

router.post('/:id/close', async (req, res) => {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ? AND status = ?').get(req.params.id, 'open');
  if (!trade) return res.status(404).json({ error: 'Trade not found or already closed' });
  let closePrice = req.body.close_price;
  if (!closePrice) {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${trade.pair}`);
      const d = await r.json();
      closePrice = +d.price;
    } catch { return res.status(500).json({ error: 'Cannot fetch price' }); }
  }
  const pnl = trade.direction === 'long'
    ? (closePrice - trade.entry_price) * trade.quantity
    : (trade.entry_price - closePrice) * trade.quantity;
  db.prepare('UPDATE trades SET status = ?, close_price = ?, pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('closed', closePrice, pnl, trade.id);
  res.json({ id: trade.id, pnl, close_price: closePrice });
});

router.get('/stats', (req, res) => {
  const closed = db.prepare('SELECT * FROM trades WHERE status = ?').all('closed');
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins = closed.filter(t => (t.pnl || 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length * 100) : 0;
  const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;
  const best = closed.length > 0 ? Math.max(...closed.map(t => t.pnl || 0)) : 0;
  const worst = closed.length > 0 ? Math.min(...closed.map(t => t.pnl || 0)) : 0;
  res.json({ totalPnl, winRate, avgPnl, best, worst, total: closed.length });
});

// Risk calculator
router.post('/calculator/risk', (req, res) => {
  try {
    const { balance, riskPercent, entryPrice, stopLoss, takeProfit, leverage = 1 } = req.body;
    if (!balance || !riskPercent || !entryPrice || !stopLoss) {
      return res.status(400).json({ error: 'balance, riskPercent, entryPrice, stopLoss required' });
    }

    const riskAmount = balance * (riskPercent / 100);
    const direction = entryPrice > stopLoss ? 'long' : 'short';
    const slDistance = Math.abs(entryPrice - stopLoss);
    const slPercent = (slDistance / entryPrice) * 100;

    // Position size (in base asset units)
    const positionSize = riskAmount / slDistance;
    const positionValue = positionSize * entryPrice;
    const requiredMargin = positionValue / leverage;

    // Liquidation price (simplified)
    let liquidationPrice;
    if (direction === 'long') {
      liquidationPrice = entryPrice * (1 - 1 / leverage);
    } else {
      liquidationPrice = entryPrice * (1 + 1 / leverage);
    }

    // R/R ratio
    let rrRatio = null;
    let tpDistance = null;
    if (takeProfit) {
      tpDistance = Math.abs(takeProfit - entryPrice);
      rrRatio = +(tpDistance / slDistance).toFixed(2);
    }

    // Potential profit
    const potentialLoss = riskAmount;
    const potentialProfit = tpDistance ? positionSize * tpDistance : null;

    res.json({
      direction,
      positionSize: +positionSize.toFixed(6),
      positionValue: +positionValue.toFixed(2),
      requiredMargin: +requiredMargin.toFixed(2),
      riskAmount: +riskAmount.toFixed(2),
      slPercent: +slPercent.toFixed(2),
      liquidationPrice: +liquidationPrice.toFixed(2),
      rrRatio,
      potentialLoss: +potentialLoss.toFixed(2),
      potentialProfit: potentialProfit ? +potentialProfit.toFixed(2) : null,
      leverage
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
