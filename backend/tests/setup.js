const path = require('path');
const fs = require('fs');

// Unique test DB per worker to avoid conflicts
const testDbPath = path.join(__dirname, '..', `test_${process.pid}_${Date.now()}.db`);

// Clean up if leftover
try { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); } catch (e) {}

// Set env BEFORE requiring any app modules
process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.GROQ_API_KEY = 'test-groq-key';

// Mock global fetch
const mockFetch = jest.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({}), ok: true })
);
global.fetch = mockFetch;

// Now require modules (they'll use the test DB)
const app = require('../app');
const db = require('../config/database');
const { hashPassword, createToken, verifyToken } = require('../utils/crypto');
const { calcEMA, calcRSI, calcMACD, calcIndicators } = require('../services/indicators');

// Helper: create a test user and get token
function createTestUser(overrides = {}) {
  const email = overrides.email || `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const name = overrides.name || 'Test User';
  const password = overrides.password || 'password123';
  const hash = hashPassword(password);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, plan, is_admin) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, hash, overrides.plan || 'Free', overrides.is_admin || 0);
  const token = createToken(result.lastInsertRowid);
  return { id: result.lastInsertRowid, email, name, password, token };
}

// Cleanup after all tests in this file
afterAll(() => {
  try { db.close(); } catch (e) {}
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(testDbPath + suffix); } catch (e) {}
  }
});

module.exports = {
  app, db, hashPassword, createToken, verifyToken,
  calcEMA, calcRSI, calcMACD, calcIndicators,
  mockFetch, createTestUser
};
