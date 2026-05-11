module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  verbose: true,
  // Force Jest to exit after tests complete (prevents hanging from Socket.IO servers)
  forceExit: true,
  // Wait for async operations to complete before forcing exit
  detectOpenHandles: true,
  // Test timeout (increased for integration tests with real-time components)
  testTimeout: 10000,
  // Cleanup between tests
  clearMocks: true,
  // Restore mocks after each test
  restoreMocks: true,
  // Maximum concurrency for parallel tests
  maxWorkers: '50%',
  // Global teardown for cleaning up any lingering connections
  globalTeardown: '<rootDir>/jest.global-teardown.js',
  // Global setup for preparing test environment
  globalSetup: '<rootDir>/jest.global-setup.js',
};