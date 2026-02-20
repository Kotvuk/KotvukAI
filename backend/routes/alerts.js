const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { status } = req.query;
  if (status) {
    res.json(db.prepare('SELECT * FROM alerts WHERE status = ? ORDER BY created_at DESC').all(status));
  } else {
    res.json(db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all());
  }
});

router.post('/', (req, res) => {
  const { pair, condition, value, message } = req.body;
  if (!pair || !condition || !value) return res.status(400).json({ error: 'Missing fields' });
  const r = db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run(pair, condition, +value, message || '');
  res.json({ id: r.lastInsertRowid });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/triggered', (req, res) => {
  const { since } = req.query;
  let results;
  if (since) {
    results = db.prepare('SELECT * FROM alerts WHERE status = ? AND triggered_at > ? ORDER BY triggered_at DESC').all('triggered', since);
  } else {
    results = db.prepare('SELECT * FROM alerts WHERE status = ? ORDER BY triggered_at DESC LIMIT 10').all('triggered');
  }
  res.json(results);
});

module.exports = router;
