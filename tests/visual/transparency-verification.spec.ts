import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

/**
 * Comprehensive transparency verification tests
 * Captures actual app screenshots to visually confirm transparency is working
 */

test.describe('Transparency Verification - Actual App Screenshots', () => {
  let electronApp: any;
  let page: any;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../build/main/main/main.js')],
      timeout: 60000
    });
    
    // Get the first BrowserWindow
    page = await electronApp.firstWindow();
    
    // Wait for app to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give vibrancy effects time to render
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should capture full app with current transparency settings', async () => {
    // Take a full screenshot of the entire app
    await expect(page).toHaveScreenshot('full-app-current-transparency.png', {
      fullPage: true,
      animations: 'disabled',
      clip: undefined // Capture everything
    });

    // Also capture the window title and basic info
    const title = await page.title();
    console.log('App title:', title);
  });

  test('should test extreme transparency to verify it works', async () => {
    // Set everything to maximum transparency
    await page.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 0 !important;
          --opacity-glass-medium: 0.01 !important;
          --opacity-glass-light: 0.005 !important;
          --backdrop-blur: blur(0px) !important;
        }
        
        /* Make any remaining backgrounds transparent */
        body, html, #root, [class*="bg-"], [style*="background"] {
          background: transparent !important;
          background-color: transparent !important;
        }
        
        /* Target specific components that might have backgrounds */
        .bg-background, .bg-card, .bg-surface, .bg-primary, .bg-secondary {
          background: transparent !important;
        }
      `
    });
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('app-maximum-transparency.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should test full opacity to compare difference', async () => {
    // Set everything to full opacity for comparison
    await page.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 1 !important;
          --opacity-glass-medium: 0.95 !important;
          --opacity-glass-light: 0.9 !important;
          --backdrop-blur: blur(0px) !important;
        }
        
        /* Add solid backgrounds */
        body {
          background: hsl(240 10% 4%) !important;
        }
        
        /* Make glass effects solid */
        .vibrancy-sidebar {
          background-color: hsl(210 12% 18%) !important;
          backdrop-filter: none !important;
        }
        
        .vibrancy-panel {
          background-color: hsl(220 15% 15%) !important;
          backdrop-filter: none !important;
        }
      `
    });
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('app-full-opacity.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should capture individual components for detailed analysis', async () => {
    // Reset to default state first
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to find and capture the sidebar
    const possibleSidebarSelectors = [
      'aside',
      '[class*="sidebar"]',
      '[class*="Sidebar"]', 
      'nav',
      '.w-64',
      '[role="navigation"]'
    ];

    let sidebarFound = false;
    for (const selector of possibleSidebarSelectors) {
      const sidebar = page.locator(selector).first();
      if (await sidebar.isVisible()) {
        await expect(sidebar).toHaveScreenshot(`sidebar-component-${selector.replace(/[^\w]/g, '-')}.png`);
        sidebarFound = true;
        console.log(`Found sidebar with selector: ${selector}`);
        break;
      }
    }

    if (!sidebarFound) {
      console.log('No sidebar found with any selector');
    }

    // Try to capture the main content area
    const possibleMainSelectors = [
      'main',
      '[class*="main"]',
      '[class*="content"]',
      '.flex-1',
      '[role="main"]'
    ];

    for (const selector of possibleMainSelectors) {
      const mainArea = page.locator(selector).first();
      if (await mainArea.isVisible()) {
        await expect(mainArea).toHaveScreenshot(`main-content-${selector.replace(/[^\w]/g, '-')}.png`);
        console.log(`Found main area with selector: ${selector}`);
        break;
      }
    }
  });

  test('should test color changes to verify design tokens work', async () => {
    // Test dramatic color changes to see if they're applied
    const testColors = [
      { name: 'bright-red', sidebar: '0 100% 50%', bg: '0 50% 20%' },
      { name: 'bright-green', sidebar: '120 100% 50%', bg: '120 50% 20%' },
      { name: 'bright-blue', sidebar: '240 100% 50%', bg: '240 50% 20%' },
    ];

    for (const color of testColors) {
      await page.addStyleTag({
        content: `
          :root {
            --sidebar: ${color.sidebar} !important;
            --sidebar-hsl: ${color.sidebar} !important;
            --bg: ${color.bg} / 0.3 !important;
            --text: 0 0% 100% !important;
          }
          
          /* Force visible changes */
          aside, [class*="sidebar"] {
            background-color: hsl(${color.sidebar} / 0.7) !important;
          }
        `
      });
      
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot(`color-test-${color.name}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('should capture transparency with desktop pattern behind', async () => {
    // This test helps verify if window-level transparency is working
    // by making the app content very transparent
    await page.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: 0 !important;
          --opacity-glass-medium: 0.05 !important;
          --opacity-glass-light: 0.02 !important;
        }
        
        body {
          background: transparent !important;
        }
        
        /* Add a test pattern to see if it shows through */
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1000;
          background: 
            repeating-linear-gradient(
              45deg,
              rgba(255, 0, 0, 0.1) 0px,
              rgba(255, 0, 0, 0.1) 20px,
              rgba(0, 255, 0, 0.1) 20px,
              rgba(0, 255, 0, 0.1) 40px,
              rgba(0, 0, 255, 0.1) 40px,
              rgba(0, 0, 255, 0.1) 60px
            );
        }
      `
    });
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('transparency-with-test-pattern.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should inspect DOM structure for debugging', async () => {
    // Get information about the app structure
    const bodyClasses = await page.locator('body').getAttribute('class');
    const rootClasses = await page.locator('html').getAttribute('class');
    const title = await page.title();
    
    console.log('=== APP STRUCTURE DEBUG INFO ===');
    console.log('Page title:', title);
    console.log('Body classes:', bodyClasses);
    console.log('Root classes:', rootClasses);
    
    // Find all elements with background-related classes
    const elementsWithBg = await page.$$eval('[class*="bg-"], [style*="background"]', (elements) => {
      return elements.map((el, index) => ({
        index,
        tagName: el.tagName,
        className: el.className,
        style: el.getAttribute('style'),
        computedBg: window.getComputedStyle(el).backgroundColor
      }));
    });
    
    console.log('Elements with backgrounds:', elementsWithBg);
    
    // Take a screenshot for this debug info
    await expect(page).toHaveScreenshot('debug-structure-analysis.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});