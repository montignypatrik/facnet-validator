import { beforeAll, afterAll, afterEach } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_test';
});

// Clean up after each test
afterEach(() => {
  // Reset mocks if any
});

// Global test teardown
afterAll(() => {
  // Cleanup resources
});
