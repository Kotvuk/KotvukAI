const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword, createToken } = require('../utils/crypto');
const { requireAdmin } = require('../middleware/auth');

router.post('/setup', async (req, res) => {
  try {
    const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
    if (adminExists.count > 0) return res.status(400).json({ error: 'Admin already exists' });
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'User with this email already exists' });
    const hash = hashPassword(password);
    const result = db.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)').run(name || '', email, hash);
    const token = createToken(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, name, email, plan: 'Free', is_admin: 1 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users', requireAdmin, (req, res) => {
  try {
    res.json(db.prepare('SELECT id, name, email, plan, is_admin, created_at FROM users ORDER BY created_at DESC').all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/users/:id/plan', requireAdmin, (req, res) => {
  try {
    const { plan } = req.body;
    if (!['Free', 'Pro', 'Premium'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/users/:id/admin', requireAdmin, (req, res) => {
  try {
    const { is_admin } = req.body;
    if (is_admin !== 0 && is_admin !== 1) return res.status(400).json({ error: 'is_admin must be 0 or 1' });
    if (req.user.id === parseInt(req.params.id) && is_admin === 0) return res.status(400).json({ error: 'Cannot remove admin status from yourself' });
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  try {
    if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'Cannot delete your own account' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const freeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE plan = ?').get('Free').count;
    const proUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE plan = ?').get('Pro').count;
    const premiumUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE plan = ?').get('Premium').count;
    const totalTrades = db.prepare('SELECT COUNT(*) as count FROM trades').get().count;
    const totalSignals = db.prepare('SELECT COUNT(*) as count FROM signal_results').get().count;
    const resolvedSignals = db.prepare('SELECT * FROM signal_results WHERE result != ?').all('pending');
    const tpHit = resolvedSignals.filter(s => s.result === 'tp_hit').length;
    const signalAccuracy = resolvedSignals.length > 0 ? (tpHit / resolvedSignals.length * 100) : 0;
    res.json({ totalUsers, usersByPlan: { Free: freeUsers, Pro: proUsers, Premium: premiumUsers }, totalTrades, totalSignals, signalAccuracy: parseFloat(signalAccuracy.toFixed(2)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/signals', requireAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const signals = db.prepare('SELECT * FROM signal_results ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM signal_results').get().count;
    res.json({ signals, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/plans/:plan', requireAdmin, (req, res) => {
  try {
    const planName = req.params.plan;
    if (!['Free', 'Pro', 'Premium'].includes(planName)) return res.status(400).json({ error: 'Invalid plan name' });
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(`plan_${planName}`, JSON.stringify(req.body));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
