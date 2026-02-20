module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!node_modules/**',
    '!coverage/**',
    '!jest.config.js',
    '!tests/**'
  ],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 15000,
};
