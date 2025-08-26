import { test, expect } from '@playwright/test';

test.describe('CSS System Verification', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000/');
    
    // Wait for the main UI components to load
    await page.waitForSelector('.vibrancy-sidebar', { timeout: 15000 });
    await page.waitForTimeout(2000); // Give extra time for CSS to load
  });

  test('1. Core CSS Variables Defined', async ({ page }) => {
    console.log('\n=== TEST 1: Core CSS Variables ===');
    
    const cssVariables = await page.evaluate(() => {
      const root = document.documentElement;
      const computedStyles = getComputedStyle(root);
      
      const expectedVariables = [
        'bg', 'surface', 'text', 'accent', 'border',
        'sidebar-width', 'secondary-panel-width',
        'app-bg-opacity', 'sidebar-bg-opacity', 'panel-bg-opacity',
        'glass-blur-amount', 'backdrop-blur'
      ];
      
      const results: Record<string, string> = {};
      expectedVariables.forEach(variable => {
        results[variable] = computedStyles.getPropertyValue(`--${variable}`).trim();
      });
      
      return results;
    });
    
    console.log('Core CSS Variables:');
    Object.entries(cssVariables).forEach(([key, value]) => {
      console.log(`  --${key}: "${value}"`);
      expect(value).toBeTruthy(); // All variables should be defined
    });
    
    // Test specific variable values
    expect(cssVariables['bg']).toBe('220 15% 15%');
    expect(cssVariables['surface']).toBe('220 15% 20%');
    expect(cssVariables['accent']).toBe('45 100% 70%');
    expect(cssVariables['sidebar-width']).toBe('16rem');
    expect(cssVariables['secondary-panel-width']).toBe('320px');
  });

  test('2. Tailwind Classes Resolve Correctly', async ({ page }) => {
    console.log('\n=== TEST 2: Tailwind Classes ===');
    
    // Test that Tailwind classes using CSS variables work
    const tailwindTest = await page.evaluate(() => {
      // Create test elements with various Tailwind classes
      const testElements = [
        { class: 'bg-surface', property: 'backgroundColor', expected: 'surface' },
        { class: 'bg-accent', property: 'backgroundColor', expected: 'accent' },
        { class: 'text-text', property: 'color', expected: 'text' },
        { class: 'border-border', property: 'borderColor', expected: 'border' },
      ];
      
      const results = testElements.map(test => {
        const el = document.createElement('div');
        el.className = test.class;
        el.style.width = '10px';
        el.style.height = '10px';
        el.style.border = '1px solid';
        document.body.appendChild(el);
        
        const computed = getComputedStyle(el);
        const actualValue = computed[test.property as any];
        
        // Clean up
        el.remove();
        
        return {
          className: test.class,
          property: test.property,
          actualValue,
          expectedVariable: test.expected,
          works: actualValue !== 'rgba(0, 0, 0, 0)' && actualValue !== 'transparent' && actualValue !== ''
        };
      });
      
      return results;
    });
    
    console.log('Tailwind Class Resolution:');
    tailwindTest.forEach(test => {
      console.log(`  .${test.className} → ${test.actualValue} (${test.works ? 'WORKS' : 'FAILS'})`);
      expect(test.works).toBe(true);
    });
  });

  test('3. Glass Effects and Transparency', async ({ page }) => {
    console.log('\n=== TEST 3: Glass Effects ===');
    
    const glassEffects = await page.evaluate(() => {
      const sidebar = document.querySelector('.vibrancy-sidebar');
      const panels = document.querySelectorAll('.vibrancy-panel');
      
      if (!sidebar) return { error: 'No .vibrancy-sidebar found' };
      
      const sidebarStyles = getComputedStyle(sidebar);
      const panelStyles = panels.length > 0 ? getComputedStyle(panels[0]) : null;
      
      return {
        sidebar: {
          backgroundColor: sidebarStyles.backgroundColor,
          backdropFilter: sidebarStyles.backdropFilter,
          webkitBackdropFilter: sidebarStyles.webkitBackdropFilter,
          hasBackdrop: sidebarStyles.backdropFilter !== 'none' || sidebarStyles.webkitBackdropFilter !== 'none'
        },
        panel: panelStyles ? {
          backgroundColor: panelStyles.backgroundColor,
          backdropFilter: panelStyles.backdropFilter,
          webkitBackdropFilter: panelStyles.webkitBackdropFilter,
          hasBackdrop: panelStyles.backdropFilter !== 'none' || panelStyles.webkitBackdropFilter !== 'none'
        } : null,
        panelCount: panels.length
      };
    });
    
    console.log('Glass Effects:');
    console.log(`  Sidebar background: ${glassEffects.sidebar?.backgroundColor}`);
    console.log(`  Sidebar backdrop-filter: ${glassEffects.sidebar?.backdropFilter}`);
    console.log(`  Sidebar has backdrop: ${glassEffects.sidebar?.hasBackdrop}`);
    
    if (glassEffects.panel) {
      console.log(`  Panel background: ${glassEffects.panel.backgroundColor}`);
      console.log(`  Panel backdrop-filter: ${glassEffects.panel.backdropFilter}`);
      console.log(`  Panel has backdrop: ${glassEffects.panel.hasBackdrop}`);
    }
    
    // Verify glass effects are working
    expect(glassEffects.sidebar?.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(glassEffects.sidebar?.hasBackdrop).toBe(true);
  });

  test('4. Panel Width Variables', async ({ page }) => {
    console.log('\n=== TEST 4: Panel Widths ===');
    
    const panelSizes = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar-width, .vibrancy-sidebar');
      const secondaryPanels = document.querySelectorAll('.secondary-panel-width, .vibrancy-panel');
      
      const sidebarWidth = sidebar ? getComputedStyle(sidebar).width : null;
      const panelWidths = Array.from(secondaryPanels).map(panel => getComputedStyle(panel).width);
      
      return {
        sidebarWidth,
        panelWidths,
        hasSidebar: !!sidebar,
        panelCount: secondaryPanels.length
      };
    });
    
    console.log('Panel Sizes:');
    console.log(`  Sidebar width: ${panelSizes.sidebarWidth}`);
    console.log(`  Panel widths: ${panelSizes.panelWidths.join(', ')}`);
    console.log(`  Has sidebar: ${panelSizes.hasSidebar}`);
    console.log(`  Panel count: ${panelSizes.panelCount}`);
    
    // Verify sidebar uses the CSS variable (should be 256px = 16rem)
    expect(panelSizes.sidebarWidth).toBe('256px');
    expect(panelSizes.hasSidebar).toBe(true);
  });

  test('5. Live CSS Variable Changes', async ({ page }) => {
    console.log('\n=== TEST 5: Live Updates ===');
    
    // Test changing CSS variables dynamically
    const liveUpdateTest = await page.evaluate(() => {
      const root = document.documentElement;
      const sidebar = document.querySelector('.vibrancy-sidebar');
      
      if (!sidebar) return { error: 'No sidebar found' };
      
      // Get initial values
      const initialBg = getComputedStyle(sidebar).backgroundColor;
      const initialWidth = getComputedStyle(sidebar).width;
      
      // Change CSS variables
      root.style.setProperty('--sidebar-bg-opacity', '0.8');
      root.style.setProperty('--sidebar-width', '20rem');
      
      // Force recomputation
      sidebar.offsetHeight;
      
      // Get new values
      const newBg = getComputedStyle(sidebar).backgroundColor;
      const newWidth = getComputedStyle(sidebar).width;
      
      // Reset values
      root.style.setProperty('--sidebar-bg-opacity', '0.5');
      root.style.setProperty('--sidebar-width', '16rem');
      
      return {
        initialBg,
        newBg,
        initialWidth,
        newWidth: newWidth,
        expectedNewWidth: '320px', // 20rem = 320px
        bgChanged: initialBg !== newBg,
        widthChanged: initialWidth !== newWidth,
        widthCorrect: newWidth === '320px'
      };
    });
    
    console.log('Live Updates:');
    console.log(`  Initial background: ${liveUpdateTest.initialBg}`);
    console.log(`  New background: ${liveUpdateTest.newBg}`);
    console.log(`  Background changed: ${liveUpdateTest.bgChanged}`);
    console.log(`  Initial width: ${liveUpdateTest.initialWidth}`);
    console.log(`  New width: ${liveUpdateTest.newWidth}`);
    console.log(`  Width changed correctly: ${liveUpdateTest.widthCorrect}`);
    
    // Verify live updates work
    expect(liveUpdateTest.bgChanged).toBe(true);
    expect(liveUpdateTest.widthCorrect).toBe(true);
  });

  test('6. Transparency Presets', async ({ page }) => {
    console.log('\n=== TEST 6: Transparency Presets ===');
    
    const transparencyTest = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      
      const presets = [
        'transparency-full',
        'transparency-medium', 
        'transparency-subtle',
        'transparency-none'
      ];
      
      const results = presets.map(preset => {
        // Apply preset class
        body.className = `${body.className} ${preset}`;
        
        // Force recomputation
        body.offsetHeight;
        
        // Get CSS variable values
        const computedStyles = getComputedStyle(root);
        const result = {
          preset,
          appBgOpacity: computedStyles.getPropertyValue('--app-bg-opacity').trim(),
          sidebarBgOpacity: computedStyles.getPropertyValue('--sidebar-bg-opacity').trim(),
          glassBlurAmount: computedStyles.getPropertyValue('--glass-blur-amount').trim()
        };
        
        // Remove preset class
        body.className = body.className.replace(preset, '').trim();
        
        return result;
      });
      
      return results;
    });
    
    console.log('Transparency Presets:');
    transparencyTest.forEach(result => {
      console.log(`  ${result.preset}:`);
      console.log(`    App opacity: ${result.appBgOpacity}`);
      console.log(`    Sidebar opacity: ${result.sidebarBgOpacity}`);
      console.log(`    Blur amount: ${result.glassBlurAmount}`);
    });
    
    // Verify preset values
    const fullPreset = transparencyTest.find(r => r.preset === 'transparency-full');
    const nonePreset = transparencyTest.find(r => r.preset === 'transparency-none');
    
    expect(fullPreset?.appBgOpacity).toBe('0');
    expect(nonePreset?.appBgOpacity).toBe('1.0');
  });

  test('7. Visual Verification Screenshots', async ({ page }) => {
    console.log('\n=== TEST 7: Visual Verification ===');
    
    // Take comprehensive screenshots
    await page.screenshot({ 
      path: 'test-results/css-system-full-page.png',
      fullPage: true,
      animations: 'disabled'
    });
    
    // Focus on sidebar
    const sidebar = page.locator('.vibrancy-sidebar');
    if (await sidebar.count() > 0) {
      await sidebar.screenshot({
        path: 'test-results/css-system-sidebar.png'
      });
    }
    
    // Test different transparency levels with screenshots
    const transparencyModes = [
      { class: 'transparency-full', name: 'full' },
      { class: 'transparency-medium', name: 'medium' },
      { class: 'transparency-none', name: 'none' }
    ];
    
    for (const mode of transparencyModes) {
      await page.evaluate(({ className }) => {
        document.body.className = `${document.body.className} ${className}`;
      }, { className: mode.class });
      
      await page.waitForTimeout(500); // Wait for CSS to apply
      
      await page.screenshot({
        path: `test-results/css-system-${mode.name}-transparency.png`,
        fullPage: false
      });
      
      // Remove class
      await page.evaluate(({ className }) => {
        document.body.className = document.body.className.replace(className, '').trim();
      }, { className: mode.class });
    }
    
    console.log('Screenshots saved to test-results/');
    console.log('- css-system-full-page.png (Complete app)');
    console.log('- css-system-sidebar.png (Sidebar detail)');
    console.log('- css-system-*-transparency.png (Transparency modes)');
    
    expect(true).toBe(true); // Test completion marker
  });

  test('8. Complete System Summary', async ({ page }) => {
    console.log('\n=== CSS SYSTEM VERIFICATION SUMMARY ===');
    
    const systemStatus = await page.evaluate(() => {
      const root = document.documentElement;
      const computedStyles = getComputedStyle(root);
      
      // Check critical variables
      const criticalVars = ['bg', 'surface', 'accent', 'text', 'sidebar-width'];
      const allDefined = criticalVars.every(v => 
        computedStyles.getPropertyValue(`--${v}`).trim() !== ''
      );
      
      // Check if components exist
      const sidebar = document.querySelector('.vibrancy-sidebar');
      const panels = document.querySelectorAll('.vibrancy-panel');
      const surfaceElements = document.querySelectorAll('.bg-surface');
      
      return {
        variablesAllDefined: allDefined,
        hasSidebar: !!sidebar,
        panelCount: panels.length,
        surfaceElementCount: surfaceElements.length,
        cssVariableCount: criticalVars.length,
        
        // Test basic functionality
        glassEffectsWork: sidebar ? getComputedStyle(sidebar).backdropFilter !== 'none' : false,
        tailwindWorks: surfaceElements.length > 0 ? 
          getComputedStyle(surfaceElements[0]).backgroundColor !== 'rgba(0, 0, 0, 0)' : false
      };
    });
    
    console.log('\n✅ SYSTEM STATUS:');
    console.log(`   All core CSS variables defined: ${systemStatus.variablesAllDefined ? '✅' : '❌'}`);
    console.log(`   Sidebar component found: ${systemStatus.hasSidebar ? '✅' : '❌'}`);
    console.log(`   Glass effects working: ${systemStatus.glassEffectsWork ? '✅' : '❌'}`);
    console.log(`   Tailwind classes working: ${systemStatus.tailwindWorks ? '✅' : '❌'}`);
    console.log(`   Panel components: ${systemStatus.panelCount} found`);
    console.log(`   Surface elements: ${systemStatus.surfaceElementCount} found`);
    
    // Final assertions
    expect(systemStatus.variablesAllDefined).toBe(true);
    expect(systemStatus.hasSidebar).toBe(true);
    expect(systemStatus.glassEffectsWork).toBe(true);
    
    console.log('\n🎉 CSS SYSTEM VERIFICATION COMPLETE!');
    console.log('   The unified CSS variable system is working correctly.');
    console.log('   You can now safely customize colors and transparency by editing design-tokens.css');
  });
});