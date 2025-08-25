import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration for Electron App Visual Testing
 * Focuses on transparency and CSS change detection
 */
export default defineConfig({
  testDir: './tests/visual',
  
  // Global test timeout
  timeout: 90 * 1000,
  expect: {
    // Visual comparison tolerance
    threshold: 0.2,
    toHaveScreenshot: { threshold: 0.2, mode: 'pixel' },
  },
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Global setup and teardown
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshots on failure
    screenshot: 'only-on-failure',
    
    // Record video on retry
    video: 'retain-on-failure',
  },
  
  projects: [
    {
      name: 'electron-visual-tests',
      use: {
        ...devices['Desktop Chrome'],
        // Custom viewport for Electron app
        viewport: { width: 1200, height: 800 },
      },
    },
  ],
  
  // Output directory for test artifacts
  outputDir: 'test-results/',
  
  // Global setup file (if needed)
  // globalSetup: require.resolve('./tests/global-setup'),
});