import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

/**
 * Visual tests for app transparency and glass effects
 * This test suite captures screenshots to verify:
 * 1. Window transparency is working
 * 2. Glass effects are visible
 * 3. CSS changes reflect properly
 */

test.describe('App Transparency Visual Tests', () => {
  let electronApp: any;
  let page: any;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../build/main/main/main.js')],
      // Enable transparency testing
      env: {
        ...process.env,
        NODE_ENV: 'test'
      },
      // Increase timeout for app launch
      timeout: 60000
    });
    
    // Get the first BrowserWindow
    page = await electronApp.firstWindow();
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give vibrancy effects time to render
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should capture app with default transparency settings', async () => {
    // Take a full screenshot
    await expect(page).toHaveScreenshot('app-default-transparency.png', {
      fullPage: true,
      animations: 'disabled' // Disable animations for consistent screenshots
    });
  });

  test('should show glass sidebar effects', async () => {
    // Focus on sidebar area
    const sidebar = page.locator('aside.vibrancy-sidebar').first();
    await expect(sidebar).toBeVisible();
    
    // Screenshot just the sidebar
    await expect(sidebar).toHaveScreenshot('sidebar-glass-effect.png');
  });

  test('should capture app with very transparent settings', async () => {
    // Inject CSS to make everything very transparent for testing
    await page.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 0 !important;
          --opacity-glass-medium: 0.02 !important;
          --opacity-glass-light: 0.01 !important;
        }
      `
    });
    
    // Wait for changes to apply
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('app-super-transparent.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should capture app with opaque settings', async () => {
    // Inject CSS to make everything opaque for comparison
    await page.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 1 !important;
          --opacity-glass-medium: 0.9 !important;
          --opacity-glass-light: 0.85 !important;
        }
        body {
          background: hsl(240 10% 4%) !important;
        }
      `
    });
    
    // Wait for changes to apply
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('app-opaque-mode.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should verify glass panel transparency', async () => {
    // Try to open a secondary panel (if available)
    const settingsButton = page.locator('button:has-text("Settings"), button:has-text("Fonts"), button[aria-label*="settings"]').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      
      // Screenshot the panel
      const panel = page.locator('.vibrancy-panel').first();
      if (await panel.isVisible()) {
        await expect(panel).toHaveScreenshot('secondary-panel-glass.png');
      }
    }
  });

  test('should test color theme changes', async () => {
    // Test different sidebar colors to verify design token changes work
    const colors = [
      '240 60% 50%', // Blue
      '120 60% 50%', // Green  
      '0 60% 50%',   // Red
      '280 60% 50%'  // Purple
    ];
    
    for (const [index, color] of colors.entries()) {
      await page.addStyleTag({
        content: `
          :root {
            --sidebar: ${color} !important;
            --sidebar-hsl: ${color} !important;
          }
        `
      });
      
      await page.waitForTimeout(500);
      
      const sidebar = page.locator('aside').first();
      await expect(sidebar).toHaveScreenshot(`sidebar-color-${index + 1}.png`);
    }
  });
});

test.describe('CSS Hot Reload Testing', () => {
  let electronApp: any;
  let page: any;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../build/main/main/main.js')],
      timeout: 60000
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should detect design token changes', async () => {
    // This test helps verify that CSS changes are being applied
    // Take baseline screenshot
    await expect(page).toHaveScreenshot('baseline-before-changes.png', {
      fullPage: true,
      animations: 'disabled'
    });
    
    // Make a dramatic change that should be very visible
    await page.addStyleTag({
      content: `
        :root {
          --text: 255 0 0 !important; /* Bright red text */
          --sidebar-hsl: 120 100% 50% !important; /* Bright green sidebar */
        }
      `
    });
    
    await page.waitForTimeout(1000);
    
    // Take after screenshot
    await expect(page).toHaveScreenshot('after-dramatic-changes.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});