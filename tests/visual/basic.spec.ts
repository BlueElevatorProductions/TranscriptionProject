import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

/**
 * Basic test to verify Electron app can launch
 */
test('should launch Electron app', async () => {
  // Launch Electron app
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../build/main/main/main.js')],
    timeout: 60000
  });
  
  // Get the first BrowserWindow
  const page = await electronApp.firstWindow();
  
  // Wait for app to load
  await page.waitForLoadState('networkidle');
  
  // Verify app launched successfully
  expect(await page.title()).toBeTruthy();
  
  // Take a basic screenshot
  await expect(page).toHaveScreenshot('app-launched.png');
  
  // Close the app
  await electronApp.close();
});