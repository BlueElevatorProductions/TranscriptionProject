/**
 * Playwright test to visualize and verify dropdown rendering
 * This test helps us see exactly what's being rendered and identify issues
 */

import { test, expect } from '@playwright/test';

// Since this is an Electron app, we'll use the electron test configuration
test.describe('Dropdown Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app - adjust this URL based on how the app is served in tests
    await page.goto('http://localhost:3000');
    
    // Wait for the app to load
    await page.waitForSelector('.transcript-editor-content', { timeout: 10000 });
  });

  test('should visualize current dropdown state', async ({ page }) => {
    console.log('=== STARTING DROPDOWN VERIFICATION TEST ===');
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/01-initial-state.png', fullPage: true });
    console.log('✓ Initial screenshot taken');

    // Look for clip containers
    const clipContainers = page.locator('.lexical-clip-container');
    const clipCount = await clipContainers.count();
    console.log(`Found ${clipCount} clip containers`);
    
    if (clipCount === 0) {
      console.log('❌ No clip containers found. App might not have loaded properly or no clips exist.');
      
      // Check if we're in the right mode
      const isEditMode = await page.locator('.edit-mode').count();
      console.log(`Edit mode elements: ${isEditMode}`);
      
      // Look for any buttons that might switch to edit mode
      const editButtons = await page.locator('button:has-text("Edit")').count();
      console.log(`Edit buttons found: ${editButtons}`);
      
      if (editButtons > 0) {
        console.log('Trying to click edit button...');
        await page.locator('button:has-text("Edit")').first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/02-after-edit-click.png', fullPage: true });
      }
      
      return;
    }

    // Examine each clip container
    for (let i = 0; i < Math.min(clipCount, 3); i++) {
      const container = clipContainers.nth(i);
      
      console.log(`\n--- EXAMINING CLIP ${i + 1} ---`);
      
      // Check for clip header dropdown
      const headerContainer = container.locator('.clip-header-container');
      const hasHeader = await headerContainer.count() > 0;
      console.log(`Clip ${i + 1} has header container: ${hasHeader}`);
      
      if (hasHeader) {
        const headerDropdown = headerContainer.locator('.clip-settings-dropdown, .relative');
        const hasDropdown = await headerDropdown.count() > 0;
        console.log(`Header has dropdown: ${hasDropdown}`);
        
        if (hasDropdown) {
          const button = headerDropdown.locator('button');
          const buttonText = await button.textContent();
          console.log(`Dropdown button text: "${buttonText}"`);
          
          const hasArrow = await button.locator('svg').count() > 0;
          console.log(`Dropdown has arrow icon: ${hasArrow}`);
        }
      }
      
      // Check for speaker nodes
      const speakerNodes = container.locator('.lexical-speaker-node');
      const speakerCount = await speakerNodes.count();
      console.log(`Clip ${i + 1} has ${speakerCount} speaker nodes`);
      
      if (speakerCount > 0) {
        const speakerText = await speakerNodes.first().textContent();
        console.log(`Speaker text: "${speakerText}"`);
        
        // Check if speaker node has click handler
        const isClickable = await speakerNodes.first().evaluate(el => {
          return window.getComputedStyle(el).cursor === 'pointer';
        });
        console.log(`Speaker node is clickable: ${isClickable}`);
      }
      
      // Take screenshot of this clip
      await container.screenshot({ path: `test-results/03-clip-${i + 1}.png` });
    }

    // Try clicking on first speaker to see what happens
    const firstSpeaker = page.locator('.lexical-speaker-node').first();
    const hasSpeaker = await firstSpeaker.count() > 0;
    
    if (hasSpeaker) {
      console.log('\n--- TESTING SPEAKER CLICK ---');
      
      // Take before-click screenshot
      await page.screenshot({ path: 'test-results/04-before-speaker-click.png', fullPage: true });
      
      await firstSpeaker.click();
      await page.waitForTimeout(500); // Wait for any dropdowns to appear
      
      // Take after-click screenshot
      await page.screenshot({ path: 'test-results/05-after-speaker-click.png', fullPage: true });
      
      // Check what dropdowns are visible
      const dropdowns = await page.locator('.absolute:visible, [role="menu"]:visible, .dropdown:visible').count();
      console.log(`Visible dropdowns after click: ${dropdowns}`);
      
      // Look for specific dropdown content
      const speakerOptions = await page.locator('button:has-text("SPEAKER_"), button:has-text("Speaker ")').count();
      console.log(`Speaker options visible: ${speakerOptions}`);
      
      const mergeOptions = await page.locator('button:has-text("Merge")').count();
      console.log(`Merge options visible: ${mergeOptions}`);
      
      const deleteOptions = await page.locator('button:has-text("Delete")').count();
      console.log(`Delete options visible: ${deleteOptions}`);
      
      const customOptions = await page.locator('button:has-text("Custom name")').count();
      console.log(`Custom name options visible: ${customOptions}`);
      
      // If no dropdowns appeared, try looking for clip header dropdowns
      const headerDropdowns = await page.locator('.clip-header-container button').count();
      if (headerDropdowns > 0) {
        console.log('\n--- TESTING HEADER DROPDOWN ---');
        const headerButton = page.locator('.clip-header-container button').first();
        
        await page.screenshot({ path: 'test-results/06-before-header-click.png', fullPage: true });
        await headerButton.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/07-after-header-click.png', fullPage: true });
        
        const afterHeaderDropdowns = await page.locator('.absolute:visible').count();
        console.log(`Dropdowns visible after header click: ${afterHeaderDropdowns}`);
      }
    }

    console.log('\n=== DROPDOWN VERIFICATION COMPLETE ===');
    console.log('Check test-results/ directory for screenshots');
  });

  test('should verify dropdown functionality', async ({ page }) => {
    // Wait for clips to load
    await page.waitForSelector('.lexical-clip-container', { timeout: 10000 });
    
    const clipContainers = page.locator('.lexical-clip-container');
    const clipCount = await clipContainers.count();
    
    if (clipCount === 0) {
      console.log('No clips found for functionality test');
      return;
    }

    // Test that we can open dropdowns and see correct options
    const firstContainer = clipContainers.first();
    
    // Look for dropdown trigger (either in header or speaker node)
    const possibleTriggers = [
      firstContainer.locator('.clip-header-container button'),
      firstContainer.locator('.lexical-speaker-node[style*="cursor"]'),
      firstContainer.locator('button:has-text("SPEAKER_")'),
    ];
    
    for (const trigger of possibleTriggers) {
      const count = await trigger.count();
      if (count > 0) {
        console.log('Found dropdown trigger, testing...');
        
        await trigger.click();
        await page.waitForTimeout(300);
        
        // Check for expected menu items
        const expectedItems = [
          'Merge with Above',
          'Merge with Below', 
          'Delete',
        ];
        
        for (const item of expectedItems) {
          const hasItem = await page.locator(`button:has-text("${item}")`).count() > 0;
          expect(hasItem).toBeTruthy();
          console.log(`✓ Found menu item: ${item}`);
        }
        
        // Should NOT have custom name option
        const hasCustomName = await page.locator('button:has-text("Custom name")').count() > 0;
        expect(hasCustomName).toBeFalsy();
        console.log('✓ Custom name option correctly absent');
        
        break;
      }
    }
  });
});