import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

/**
 * Replicable Transparency Tests
 * Only modifies CSS variables that exist in design-tokens.css
 * Every screenshot can be recreated by copying these exact values to your design-tokens.css file
 */

test.describe('Replicable Transparency - design-tokens.css Variables Only', () => {
  let electronApp: any;
  let mainWindow: any;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../build/main/main/main.js')],
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get main app window (not DevTools)
    const windows = electronApp.windows();
    for (const window of windows) {
      const title = await window.title();
      if (!title.includes('DevTools')) {
        mainWindow = window;
        break;
      }
    }
    
    await mainWindow.waitForLoadState('networkidle');
    await mainWindow.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('📸 Current design-tokens.css settings', async () => {
    console.log('=== CURRENT SETTINGS FROM design-tokens.css ===');
    console.log('--app-bg-opacity: 0.5 (50% transparent)');
    console.log('--opacity-glass-medium: 0.1 (10% glass)');  
    console.log('--opacity-glass-light: 0.04 (4% glass)');
    console.log('--backdrop-blur: blur(100px)');
    
    await expect(mainWindow).toHaveScreenshot('design-tokens-current-settings.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('📸 Fully transparent mode - REPLICABLE', async () => {
    const settings = {
      '--app-bg-opacity': '0',
      '--opacity-glass-medium': '0.05',
      '--opacity-glass-light': '0.02'
    };
    
    console.log('=== TO REPLICATE IN design-tokens.css ===');
    Object.entries(settings).forEach(([key, value]) => {
      console.log(`${key}: ${value};`);
    });
    
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: ${settings['--app-bg-opacity']} !important;
          --opacity-glass-medium: ${settings['--opacity-glass-medium']} !important;
          --opacity-glass-light: ${settings['--opacity-glass-light']} !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('replicable-fully-transparent.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('📸 Semi-transparent mode - REPLICABLE', async () => {
    const settings = {
      '--app-bg-opacity': '0.3',
      '--opacity-glass-medium': '0.2',
      '--opacity-glass-light': '0.1'
    };
    
    console.log('=== TO REPLICATE IN design-tokens.css ===');
    Object.entries(settings).forEach(([key, value]) => {
      console.log(`${key}: ${value};`);
    });
    
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: ${settings['--app-bg-opacity']} !important;
          --opacity-glass-medium: ${settings['--opacity-glass-medium']} !important;
          --opacity-glass-light: ${settings['--opacity-glass-light']} !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('replicable-semi-transparent.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('📸 Opaque mode - REPLICABLE', async () => {
    const settings = {
      '--app-bg-opacity': '1',
      '--opacity-glass-medium': '0.9',
      '--opacity-glass-light': '0.85'
    };
    
    console.log('=== TO REPLICATE IN design-tokens.css ===');
    Object.entries(settings).forEach(([key, value]) => {
      console.log(`${key}: ${value};`);
    });
    
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: ${settings['--app-bg-opacity']} !important;
          --opacity-glass-medium: ${settings['--opacity-glass-medium']} !important;
          --opacity-glass-light: ${settings['--opacity-glass-light']} !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('replicable-opaque.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('📸 Heavy blur effect - REPLICABLE', async () => {
    const settings = {
      '--app-bg-opacity': '0.1',
      '--opacity-glass-medium': '0.3',
      '--opacity-glass-light': '0.2',
      '--backdrop-blur': 'blur(50px)'
    };
    
    console.log('=== TO REPLICATE IN design-tokens.css ===');
    Object.entries(settings).forEach(([key, value]) => {
      console.log(`${key}: ${value};`);
    });
    
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: ${settings['--app-bg-opacity']} !important;
          --opacity-glass-medium: ${settings['--opacity-glass-medium']} !important;
          --opacity-glass-light: ${settings['--opacity-glass-light']} !important;
          --backdrop-blur: ${settings['--backdrop-blur']} !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('replicable-heavy-blur.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('📸 No blur effect - REPLICABLE', async () => {
    const settings = {
      '--app-bg-opacity': '0.2',
      '--opacity-glass-medium': '0.4',
      '--opacity-glass-light': '0.3',
      '--backdrop-blur': 'blur(0px)'
    };
    
    console.log('=== TO REPLICATE IN design-tokens.css ===');
    Object.entries(settings).forEach(([key, value]) => {
      console.log(`${key}: ${value};`);
    });
    
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: ${settings['--app-bg-opacity']} !important;
          --opacity-glass-medium: ${settings['--opacity-glass-medium']} !important;
          --opacity-glass-light: ${settings['--opacity-glass-light']} !important;
          --backdrop-blur: ${settings['--backdrop-blur']} !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('replicable-no-blur.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('📸 Subtle transparency - REPLICABLE', async () => {
    const settings = {
      '--app-bg-opacity': '0.8',
      '--opacity-glass-medium': '0.6',
      '--opacity-glass-light': '0.4',
      '--backdrop-blur': 'blur(20px)'
    };
    
    console.log('=== TO REPLICATE IN design-tokens.css ===');
    Object.entries(settings).forEach(([key, value]) => {
      console.log(`${key}: ${value};`);
    });
    
    await mainWindow.addStyleTag({
      content: `
        :root {
          --app-bg-opacity: ${settings['--app-bg-opacity']} !important;
          --opacity-glass-medium: ${settings['--opacity-glass-medium']} !important;
          --opacity-glass-light: ${settings['--opacity-glass-light']} !important;
          --backdrop-blur: ${settings['--backdrop-blur']} !important;
        }
      `
    });
    
    await mainWindow.waitForTimeout(1500);
    
    await expect(mainWindow).toHaveScreenshot('replicable-subtle-transparency.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('📸 Test color variations - REPLICABLE', async () => {
    const colorTests = [
      { name: 'blue-theme', sidebar: '240 60% 50%', sidebarHsl: '240 20% 15%' },
      { name: 'green-theme', sidebar: '120 60% 50%', sidebarHsl: '120 20% 15%' },
      { name: 'purple-theme', sidebar: '280 60% 50%', sidebarHsl: '280 20% 15%' }
    ];

    for (const colorTest of colorTests) {
      console.log(`=== TO REPLICATE ${colorTest.name.toUpperCase()} IN design-tokens.css ===`);
      console.log(`--sidebar: ${colorTest.sidebar};`);
      console.log(`--sidebar-hsl: ${colorTest.sidebarHsl};`);
      console.log(`--app-bg-opacity: 0.4;`);
      console.log(`--opacity-glass-medium: 0.3;`);
      
      await mainWindow.addStyleTag({
        content: `
          :root {
            --sidebar: ${colorTest.sidebar} !important;
            --sidebar-hsl: ${colorTest.sidebarHsl} !important;
            --app-bg-opacity: 0.4 !important;
            --opacity-glass-medium: 0.3 !important;
          }
        `
      });
      
      await mainWindow.waitForTimeout(1000);
      
      await expect(mainWindow).toHaveScreenshot(`replicable-${colorTest.name}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });
});