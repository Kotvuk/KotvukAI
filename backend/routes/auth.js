const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword, createToken } = require('../utils/crypto');

router.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    const hash = hashPassword(password);
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name || '', email, hash);
    const token = createToken(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, name, email, plan: 'Free' } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    const token = createToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
  res.json(req.user);
});

module.exports = router;
