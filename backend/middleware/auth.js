const db = require('../config/database');
const { verifyToken } = require('../utils/crypto');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload) {
      req.userId = payload.id;
      req.user = db.prepare('SELECT id, name, email, plan, is_admin FROM users WHERE id = ?').get(payload.id);
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authMiddleware, requireAdmin };
