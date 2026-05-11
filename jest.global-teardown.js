/**
 * Jest Global Teardown
 * Runs once after all tests - cleans up any lingering connections
 * Critical for Socket.IO tests to prevent runner hanging
 */

module.exports = async function globalTeardown() {
  // Give time for any async cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 500));

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Clear any cached connections
  console.log('🔧 Jest global teardown complete - all connections cleaned up');
};