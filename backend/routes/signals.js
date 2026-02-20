const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateReflection } = require('../services/signalChecker');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM signals ORDER BY created_at DESC LIMIT 20').all());
});

router.post('/', (req, res) => {
  const { pair, type, entry, tp, sl, reason, accuracy } = req.body;
  const r = db.prepare('INSERT INTO signals (pair,type,entry,tp,sl,reason,accuracy) VALUES (?,?,?,?,?,?,?)').run(pair, type, entry, tp, sl, reason, accuracy);
  res.json({ id: r.lastInsertRowid });
});

router.get('/history', (req, res) => {
  res.json(db.prepare('SELECT * FROM signal_results ORDER BY created_at DESC LIMIT 50').all());
});

router.get('/stats', (req, res) => {
  const all = db.prepare('SELECT * FROM signal_results WHERE result != ?').all('pending');
  const total = all.length;
  const tpHit = all.filter(s => s.result === 'tp_hit').length;
  const slHit = all.filter(s => s.result === 'sl_hit').length;
  const timeout = all.filter(s => s.result === 'timeout').length;
  const accuracy = total > 0 ? (tpHit / total * 100) : 0;
  const avgScore = total > 0 ? (all.reduce((s, r) => s + (r.accuracy_score || 0), 0) / total) : 0;
  const pending = db.prepare('SELECT COUNT(*) as cnt FROM signal_results WHERE result = ?').get('pending').cnt;
  res.json({ total, tpHit, slHit, timeout, accuracy, avgScore, pending });
});

router.post('/track', (req, res) => {
  const { pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score } = req.body;
  if (!pair || !entry_price) return res.status(400).json({ error: 'Missing fields' });
  const r = db.prepare(
    'INSERT INTO signal_results (pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score) VALUES (?,?,?,?,?,?,?,?)'
  ).run(pair, direction || null, +entry_price, tp_price ? +tp_price : null, sl_price ? +sl_price : null, ai_analysis || null, confidence ? +confidence : null, coin_score ? +coin_score : null);
  res.json({ id: r.lastInsertRowid });
});

router.post('/:id/resolve', (req, res) => {
  const { result, actual_price } = req.body;
  const sig = db.prepare('SELECT * FROM signal_results WHERE id = ?').get(req.params.id);
  if (!sig) return res.status(404).json({ error: 'Signal not found' });
  const validResults = ['tp_hit', 'sl_hit', 'timeout'];
  if (!validResults.includes(result)) return res.status(400).json({ error: 'Invalid result' });
  
  let score = 0;
  if (result === 'tp_hit') score = 100;
  else if (result === 'timeout') score = 50;

  db.prepare('UPDATE signal_results SET result = ?, actual_price = ?, accuracy_score = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(result, actual_price ? +actual_price : null, score, sig.id);
  
  generateReflection(sig.id).catch(e => console.error('Reflection error:', e.message));
  
  res.json({ ok: true });
});

module.exports = router;
