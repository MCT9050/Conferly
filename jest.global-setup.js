/**
 * Jest Global Setup
 * Runs once before all tests - prepares test environment
 */

module.exports = async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-ci';
  process.env.PORT = '0'; // Use random port for tests

  // Increase heap size for test suite
  if (global.gc) {
    global.gc();
  }

  console.log('🔧 Jest global setup complete');
};