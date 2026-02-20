const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM watchlist ORDER BY added_at DESC').all());
});

router.post('/', (req, res) => {
  const { pair } = req.body;
  if (!pair) return res.status(400).json({ error: 'pair required' });
  try {
    const r = db.prepare('INSERT OR IGNORE INTO watchlist (pair) VALUES (?)').run(pair);
    res.json({ id: r.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
