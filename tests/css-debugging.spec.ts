import { test, expect } from '@playwright/test';

test.describe('CSS Variable System Debugging', () => {
  
  test('CSS Variable Values and Tailwind Integration', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000/');
    
    // Wait for app to load
    await page.waitForSelector('.vibrancy-sidebar', { timeout: 10000 });
    
    console.log('\n=== CSS VARIABLE DEBUGGING TEST ===');
    
    // 1. Check if design-tokens.css is loaded
    const designTokensLoaded = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.some(sheet => {
        try {
          return sheet.href?.includes('design-tokens.css') || 
                 Array.from(sheet.cssRules || []).some(rule => 
                   rule.cssText?.includes('--surface') || rule.cssText?.includes('design-tokens')
                 );
        } catch {
          return false;
        }
      });
    });
    
    console.log(`1. Design tokens CSS loaded: ${designTokensLoaded}`);
    
    // 2. Check CSS variable values in :root
    const cssVariables = await page.evaluate(() => {
      const root = document.documentElement;
      const computedStyles = getComputedStyle(root);
      
      return {
        bg: computedStyles.getPropertyValue('--bg').trim(),
        surface: computedStyles.getPropertyValue('--surface').trim(),
        text: computedStyles.getPropertyValue('--text').trim(),
        accent: computedStyles.getPropertyValue('--accent').trim(),
        sidebarBg: computedStyles.getPropertyValue('--sidebar-bg').trim(),
        sidebarBgBlur: computedStyles.getPropertyValue('--sidebar-bg-blur').trim()
      };
    });
    
    console.log('2. CSS Variable Values:');
    Object.entries(cssVariables).forEach(([key, value]) => {
      console.log(`   --${key}: "${value}"`);
    });
    
    // 3. Test if bg-surface buttons exist and get their computed styles
    const surfaceButtons = await page.locator('.bg-surface').all();
    console.log(`3. Found ${surfaceButtons.length} elements with .bg-surface class`);
    
    if (surfaceButtons.length > 0) {
      const firstButton = surfaceButtons[0];
      const buttonStyles = await firstButton.evaluate(el => {
        const computed = getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          classes: el.className,
          computedSurface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
        };
      });
      
      console.log('   First .bg-surface button styles:', buttonStyles);
    }
    
    // 4. Test direct CSS variable usage
    const directVariableTest = await page.evaluate(() => {
      // Create test element
      const testEl = document.createElement('div');
      testEl.style.backgroundColor = 'hsl(var(--surface))';
      testEl.style.width = '50px';
      testEl.style.height = '50px';
      testEl.style.position = 'fixed';
      testEl.style.top = '10px';
      testEl.style.right = '10px';
      testEl.style.zIndex = '9999';
      testEl.id = 'css-variable-test';
      
      document.body.appendChild(testEl);
      
      const computed = getComputedStyle(testEl);
      const result = {
        backgroundColor: computed.backgroundColor,
        surfaceVar: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
      };
      
      // Clean up
      testEl.remove();
      return result;
    });
    
    console.log('4. Direct CSS variable test:', directVariableTest);
    
    // 5. Test different HSL syntax variations
    const hslSyntaxTests = await page.evaluate(() => {
      const root = document.documentElement;
      const tests = [
        { name: 'Space syntax', value: '0 100% 50%' },
        { name: 'Comma syntax', value: '0, 100%, 50%' },
        { name: 'deg syntax', value: '0deg 100% 50%' },
        { name: 'deg comma syntax', value: '0deg, 100%, 50%' }
      ];
      
      const results = tests.map(test => {
        const testEl = document.createElement('div');
        testEl.style.setProperty('--test-color', test.value);
        testEl.style.backgroundColor = 'hsl(var(--test-color))';
        document.body.appendChild(testEl);
        
        const computed = getComputedStyle(testEl);
        const bgColor = computed.backgroundColor;
        
        testEl.remove();
        
        return {
          syntax: test.name,
          value: test.value,
          result: bgColor,
          works: bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent'
        };
      });
      
      return results;
    });
    
    console.log('5. HSL Syntax Tests:');
    hslSyntaxTests.forEach(test => {
      console.log(`   ${test.syntax}: "${test.value}" → ${test.result} (${test.works ? 'WORKS' : 'FAILS'})`);
    });
    
    // 6. Check Tailwind compiled CSS
    const tailwindClasses = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let foundRules = [];
      
      sheets.forEach(sheet => {
        try {
          Array.from(sheet.cssRules || []).forEach(rule => {
            if (rule.selectorText?.includes('.bg-surface')) {
              foundRules.push({
                selector: rule.selectorText,
                style: rule.style.cssText || rule.cssText
              });
            }
          });
        } catch (e) {
          // Skip CORS-protected stylesheets
        }
      });
      
      return foundRules;
    });
    
    console.log('6. Tailwind .bg-surface rules found:');
    tailwindClasses.forEach(rule => {
      console.log(`   ${rule.selector}: ${rule.style}`);
    });
    
    // 7. Take screenshots for visual verification
    await page.screenshot({ 
      path: 'test-results/css-debug-full-page.png',
      fullPage: true 
    });
    
    // Focus on sidebar for detailed view
    await page.locator('.vibrancy-sidebar').screenshot({
      path: 'test-results/css-debug-sidebar.png'
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Design tokens loaded: ${designTokensLoaded}`);
    console.log(`Surface variable value: "${cssVariables.surface}"`);
    console.log(`Working HSL syntax: ${hslSyntaxTests.find(t => t.works)?.syntax || 'NONE'}`);
    console.log(`Tailwind rules found: ${tailwindClasses.length}`);
    
    // Assert that we have the basic setup working
    expect(designTokensLoaded).toBe(true);
    expect(cssVariables.surface).toBeTruthy();
    expect(surfaceButtons.length).toBeGreaterThan(0);
  });
  
  test('Fix and Verify CSS Variables', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForSelector('.vibrancy-sidebar', { timeout: 10000 });
    
    // Get the working HSL syntax from previous test
    const workingSyntax = await page.evaluate(() => {
      const testEl = document.createElement('div');
      
      // Test comma syntax (most common)
      testEl.style.setProperty('--test-red', '0, 100%, 50%');
      testEl.style.backgroundColor = 'hsl(var(--test-red))';
      document.body.appendChild(testEl);
      
      const computed = getComputedStyle(testEl);
      const works = computed.backgroundColor === 'rgb(255, 0, 0)';
      
      testEl.remove();
      return works ? '0, 100%, 50%' : null;
    });
    
    if (workingSyntax) {
      console.log(`\nWorking HSL syntax: "${workingSyntax}"`);
      console.log('Apply this format to your CSS variables in design-tokens.css');
    } else {
      console.log('\nNeed to investigate browser compatibility issues');
    }
  });
});