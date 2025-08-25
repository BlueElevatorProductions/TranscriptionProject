/**
 * Jest configuration for TranscriptionProject
 * Supports TypeScript, React, and Electron testing
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  
  // Module paths
  roots: ['<rootDir>/src'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Module name mapping for CSS and assets
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/renderer/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^electron$': '<rootDir>/src/__mocks__/electron.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': 'jest-transform-stub',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/renderer/**/*.{ts,tsx}',
    '!src/renderer/**/*.d.ts',
    '!src/renderer/**/__tests__/**',
    '!src/renderer/**/index.ts',
  ],
  
  // Test environment options
  testEnvironmentOptions: {
    jsdom: {
      url: 'http://localhost',
    },
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/',
  ],
  
};