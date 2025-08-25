import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

/**
 * Main App Transparency Test - Targets the actual application window
 * This test specifically focuses on the main app, not DevTools
 */

test.describe('Main App Window Transparency Tests', () => {
  let electronApp: any;
  let mainWindow: any;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../build/main/main/main.js')],
      timeout: 60000
    });
    
    // Wait a bit for all windows to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all windows
    const windows = electronApp.windows();
    console.log(`Found ${windows.length} windows`);
    
    // Find the main app window (not DevTools)
    for (const window of windows) {
      const title = await window.title();
      const url = window.url();
      console.log(`Window: "${title}" - URL: ${url}`);
      
      // Skip DevTools window
      if (!title.includes('DevTools') && !url.includes('devtools')) {
        mainWindow = window;
        console.log(`Selected main window: "${title}"`);
        break;
      }
    }
    
    if (!mainWindow) {
      // Fallback to first window if we can't identify the main one
      mainWindow = windows[0];
      console.log('Using first window as fallback');
    }
    
    // Wait for app to fully load
    await mainWindow.waitForLoadState('networkidle');
    await mainWindow.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should capture the actual main app window', async () => {
    const title = await mainWindow.title();
    const url = mainWindow.url();
    
    console.log('=== MAIN APP WINDOW INFO ===');
    console.log('Title:', title);
    console.log('URL:', url);
    
    // Take screenshot of the main app
    await expect(mainWindow).toHaveScreenshot('main-app-current-state.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should test maximum transparency on main app', async () => {
    // Apply maximum transparency
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 0 !important;
          --opacity-glass-medium: 0.01 !important;
          --opacity-glass-light: 0.005 !important;
          --backdrop-blur: blur(0px) !important;
        }
        
        body {
          background: transparent !important;
        }
        
        /* Make all possible backgrounds transparent */
        *, *::before, *::after {
          background-color: transparent !important;
        }
        
        /* Except for text areas and inputs where we need some visibility */
        input, textarea, button {
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('main-app-maximum-transparency.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should test solid opacity for comparison', async () => {
    // Apply solid backgrounds
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 1 !important;
          --opacity-glass-medium: 0.95 !important;
          --opacity-glass-light: 0.9 !important;
        }
        
        body {
          background: hsl(240 10% 4%) !important;
        }
        
        /* Ensure sidebar and panels are visible */
        aside, [class*="sidebar"] {
          background: hsl(210 12% 18%) !important;
        }
        
        main, [class*="main"] {
          background: hsl(240 10% 6%) !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('main-app-solid-backgrounds.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should test window vibrancy effect with pattern', async () => {
    // Reset to transparent and add a test pattern to see if window vibrancy works
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 0 !important;
          --opacity-glass-medium: 0.1 !important;
          --opacity-glass-light: 0.05 !important;
        }
        
        body {
          background: transparent !important;
        }
        
        /* Add test pattern that should show through transparent window */
        html::before {
          content: 'TRANSPARENCY TEST';
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 48px;
          font-weight: bold;
          color: rgba(255, 0, 0, 0.3);
          z-index: -1;
          pointer-events: none;
        }
        
        html::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -2;
          background: 
            repeating-linear-gradient(
              45deg,
              rgba(255, 100, 100, 0.1) 0px,
              rgba(255, 100, 100, 0.1) 50px,
              rgba(100, 255, 100, 0.1) 50px,
              rgba(100, 255, 100, 0.1) 100px
            );
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('main-app-vibrancy-test.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should capture component details', async () => {
    // Reset to default first
    await mainWindow.reload();
    await mainWindow.waitForLoadState('networkidle');
    await mainWindow.waitForTimeout(2000);
    
    // Get detailed structure info
    const pageInfo = await mainWindow.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      
      return {
        bodyClasses: body.className,
        bodyStyle: body.getAttribute('style'),
        htmlClasses: html.className,
        backgroundElements: Array.from(document.querySelectorAll('[class*="bg-"], [style*="background"]')).map(el => ({
          tagName: el.tagName,
          classes: el.className,
          style: el.getAttribute('style')
        })),
        rootComputedStyle: {
          backgroundColor: window.getComputedStyle(body).backgroundColor,
          opacity: window.getComputedStyle(body).opacity
        }
      };
    });
    
    console.log('=== MAIN APP STRUCTURE ===');
    console.log('Page Info:', JSON.stringify(pageInfo, null, 2));
    
    await expect(mainWindow).toHaveScreenshot('main-app-structure-analysis.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should verify design token changes work', async () => {
    // Test if design token changes are applied
    await mainWindow.addStyleTag({
      content: `
        :root {
          --text: 255 0 0 !important; /* Bright red text */
          --sidebar: 120 100% 50% !important; /* Bright green sidebar */
          --sidebar-hsl: 120 100% 50% !important;
        }
        
        /* Force changes to be visible */
        * {
          color: hsl(255 100% 50%) !important;
        }
        
        aside, [class*="sidebar"] {
          background: hsl(120 100% 50% / 0.8) !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('main-app-design-token-test.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});