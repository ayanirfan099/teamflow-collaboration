/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },
  // The workspace packages are consumed as compiled JavaScript, so they must not be transformed.
  transformIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
  maxWorkers: 1,
  // The Socket.IO server keeps a handle open after the last test, so the runner is stopped
  // explicitly instead of waiting for the event loop to drain.
  forceExit: true,
};
