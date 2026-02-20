const db = require('../config/database');

async function checkTradeTPSL() {
  try {
    const openTrades = db.prepare('SELECT * FROM trades WHERE status = ?').all('open');
    if (openTrades.length === 0) return;
    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const prices = await r.json();
    const priceMap = {};
    prices.forEach(p => { priceMap[p.symbol] = +p.price; });

    for (const trade of openTrades) {
      const currentPrice = priceMap[trade.pair];
      if (!currentPrice) continue;
      let shouldClose = false;
      if (trade.direction === 'long') {
        if (trade.tp && currentPrice >= trade.tp) shouldClose = true;
        if (trade.sl && currentPrice <= trade.sl) shouldClose = true;
      } else {
        if (trade.tp && currentPrice <= trade.tp) shouldClose = true;
        if (trade.sl && currentPrice >= trade.sl) shouldClose = true;
      }
      if (shouldClose) {
        const pnl = trade.direction === 'long'
          ? (currentPrice - trade.entry_price) * trade.quantity
          : (trade.entry_price - currentPrice) * trade.quantity;
        db.prepare('UPDATE trades SET status = ?, close_price = ?, pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('closed', currentPrice, pnl, trade.id);
        console.log(`📊 Trade auto-closed: ${trade.pair} ${trade.direction} PnL: ${pnl.toFixed(2)}`);
      }
    }
  } catch (e) { console.error('Trade TP/SL check error:', e.message); }
}

module.exports = { checkTradeTPSL };
