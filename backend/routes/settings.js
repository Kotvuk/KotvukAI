const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM settings').all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
