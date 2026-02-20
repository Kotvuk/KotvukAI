const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'kotvukai-secret-key-change-me';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createToken(userId) {
  const payload = { id: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return data + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  if (sig !== expected) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64').toString());
  if (payload.exp < Date.now()) return null;
  return payload;
}

module.exports = { hashPassword, createToken, verifyToken };
