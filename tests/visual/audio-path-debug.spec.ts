import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_FILE = '/Users/chrismcleod/Development/ClaudeAccess/Project Files/test.transcript';
const SCREENSHOT_DIR = '/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/screenshots';

test.describe('Audio Path Resolution Debug', () => {
  // Helper to take and save screenshots
  async function takeScreenshot(page: Page, name: string) {
    const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  // Helper to capture console logs
  function setupConsoleCapture(page: Page) {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      
      // Log audio-related messages immediately
      if (text.toLowerCase().includes('audio') || 
          text.toLowerCase().includes('flac') || 
          text.toLowerCase().includes('mp3') ||
          text.toLowerCase().includes('path') ||
          text.toLowerCase().includes('embeddedpath') ||
          text.toLowerCase().includes('resolvedpath') ||
          text.toLowerCase().includes('conversion') ||
          text.toLowerCase().includes('extracted') ||
          text.toLowerCase().includes('loading') ||
          text.toLowerCase().includes('failed')) {
        console.log(`🎵 AUDIO LOG: ${text}`);
      }
    });
    return consoleLogs;
  }

  test('Load test.transcript and debug audio path resolution', async ({ page }) => {
    console.log('🧪 Starting audio path debug test');
    console.log(`📁 Testing with project file: ${PROJECT_FILE}`);
    
    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    
    // Setup console capture
    const consoleLogs = setupConsoleCapture(page);
    
    // Navigate to the app
    console.log('🌐 Navigating to app...');
    await page.goto('http://localhost:3000');
    
    // Wait for app to load and take initial screenshot
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '01-initial-load');
    
    // Look for home view or main interface
    const homeView = page.locator('[data-testid="home-view"], .home-view, #home, main');
    if (await homeView.isVisible()) {
      console.log('✅ App loaded, home view visible');
      await takeScreenshot(page, '02-home-view');
    }
    
    // Try to open the project file
    console.log('📂 Attempting to open project file...');
    
    // Method 1: Look for Open button
    const openButton = page.locator('button:has-text("Open"), button:has-text("Open Project"), [aria-label*="open" i]');
    if (await openButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('🔘 Found Open button, clicking...');
      await openButton.first().click();
      await takeScreenshot(page, '03-after-open-click');
      
      // File dialog handling would go here in a real test
      console.log('⚠️  File dialog opened - manual intervention needed or use file input');
    }
    
    // Method 2: Look for recent projects that might include our test file
    console.log('🔍 Looking for recent projects...');
    const recentProjects = page.locator('[data-testid*="recent" i], .recent-project, .project-item');
    const recentCount = await recentProjects.count();
    console.log(`📊 Found ${recentCount} recent project elements`);
    
    if (recentCount > 0) {
      await takeScreenshot(page, '04-recent-projects');
      
      // Look specifically for test.transcript
      const testProject = recentProjects.filter({ hasText: 'test' });
      if (await testProject.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✅ Found test project in recent list!');
        await testProject.first().click();
        console.log('🖱️  Clicked test project');
        
        // Wait for project to load
        await page.waitForTimeout(5000);
        await takeScreenshot(page, '05-project-loading');
      }
    }
    
    // Method 3: Try keyboard shortcut for open
    console.log('⌨️  Trying keyboard shortcut Cmd+O...');
    await page.keyboard.press('Meta+o');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '06-after-keyboard-shortcut');
    
    // Wait and capture any errors
    await page.waitForTimeout(5000);
    
    // Check for error messages
    console.log('🔍 Checking for error messages...');
    const errorElements = await page.locator('.error, [class*="error"], [role="alert"], .alert').all();
    for (const error of errorElements) {
      const errorText = await error.textContent();
      console.log(`❌ Error found: ${errorText}`);
    }
    await takeScreenshot(page, '07-error-check');
    
    // Check for audio elements
    console.log('🔍 Checking for audio elements...');
    const audioElements = await page.locator('audio, video, [data-testid*="audio"], .audio-player').all();
    console.log(`🎵 Found ${audioElements.length} audio-related elements`);
    
    // Inspect project data if available
    console.log('📊 Attempting to inspect project data...');
    const projectData = await page.evaluate(() => {
      // Try to access project context from window or React DevTools
      const data: any = {};
      
      // Check localStorage
      data.localStorage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('project') || key.includes('audio') || key.includes('recent'))) {
          data.localStorage[key] = localStorage.getItem(key);
        }
      }
      
      // Check window for any project data
      if ((window as any).projectData) {
        data.windowProject = (window as any).projectData;
      }
      
      // Check for audio paths in DOM
      const audioSrcs = Array.from(document.querySelectorAll('audio')).map(a => a.src);
      if (audioSrcs.length > 0) {
        data.audioSources = audioSrcs;
      }
      
      // Check for any data attributes with paths
      const elementsWithPaths = Array.from(document.querySelectorAll('[data-audio-path], [data-path], [data-src]'));
      if (elementsWithPaths.length > 0) {
        data.dataAttributes = elementsWithPaths.map(el => ({
          tag: el.tagName,
          attributes: Array.from(el.attributes).reduce((acc, attr) => {
            if (attr.name.includes('path') || attr.name.includes('src') || attr.name.includes('audio')) {
              acc[attr.name] = attr.value;
            }
            return acc;
          }, {} as any)
        }));
      }
      
      return data;
    });
    
    console.log('📊 Project data from page:', JSON.stringify(projectData, null, 2));
    
    // Take final screenshot
    await takeScreenshot(page, '08-final-state');
    
    // Output all console logs
    console.log('\n📋 === ALL CONSOLE LOGS ===');
    consoleLogs.forEach((log, i) => {
      console.log(`${i + 1}. ${log}`);
    });
    
    // Analyze filesystem
    console.log('\n📁 === FILESYSTEM ANALYSIS ===');
    
    // Check temp directories for audio files
    const tempDir = '/var/folders/vf/2cjjjk411ql3393h8qf_dwwh0000gn/T';
    
    // Check audio_conversion directory
    const audioConversionDir = path.join(tempDir, 'audio_conversion');
    if (fs.existsSync(audioConversionDir)) {
      const files = fs.readdirSync(audioConversionDir);
      console.log(`📁 audio_conversion directory: ${files.length} files`);
      files.forEach(f => console.log(`   - ${f}`));
    } else {
      console.log('📁 audio_conversion directory: NOT FOUND');
    }
    
    // Check transcription_project directories
    const tempFiles = fs.readdirSync(tempDir);
    const projectDirs = tempFiles.filter(f => f.startsWith('transcription_project_'));
    console.log(`📁 Found ${projectDirs.length} transcription_project directories`);
    
    projectDirs.slice(-5).forEach(dir => {
      const fullPath = path.join(tempDir, dir);
      try {
        const contents = fs.readdirSync(fullPath);
        console.log(`📁 ${dir}:`);
        contents.forEach(file => {
          const filePath = path.join(fullPath, file);
          const stats = fs.statSync(filePath);
          console.log(`   - ${file} (${stats.size} bytes)`);
        });
      } catch (err) {
        console.log(`   Error reading: ${err}`);
      }
    });
    
    // Summary
    console.log('\n🎯 === SUMMARY ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log(`Console logs captured: ${consoleLogs.length}`);
    console.log(`Audio-related logs: ${consoleLogs.filter(l => l.toLowerCase().includes('audio')).length}`);
    console.log(`Error logs: ${consoleLogs.filter(l => l.includes('[error]')).length}`);
    
    // Check for specific audio path issues
    const flacLogs = consoleLogs.filter(l => l.toLowerCase().includes('.flac'));
    const mp3Logs = consoleLogs.filter(l => l.toLowerCase().includes('.mp3'));
    console.log(`FLAC references: ${flacLogs.length}`);
    console.log(`MP3 references: ${mp3Logs.length}`);
    
    if (flacLogs.length > 0) {
      console.log('\n⚠️  FLAC references found when MP3 expected:');
      flacLogs.forEach(log => console.log(`   ${log}`));
    }
    
    // Final analysis
    console.log('\n🔍 === FINAL ANALYSIS ===');
    if (consoleLogs.some(l => l.includes('Audio file does not exist'))) {
      console.log('❌ Audio file not found error detected');
      const errorLog = consoleLogs.find(l => l.includes('Audio file does not exist'));
      console.log(`   Error: ${errorLog}`);
      
      // Extract the path from error
      const pathMatch = errorLog?.match(/Audio file does not exist: (.+)/);
      if (pathMatch) {
        const errorPath = pathMatch[1];
        console.log(`   Expected path: ${errorPath}`);
        console.log(`   Path exists: ${fs.existsSync(errorPath)}`);
        
        // Check what extension is being looked for vs what exists
        if (errorPath.includes('.flac')) {
          const mp3Path = errorPath.replace('.flac', '.mp3');
          console.log(`   MP3 alternative: ${mp3Path}`);
          console.log(`   MP3 exists: ${fs.existsSync(mp3Path)}`);
        }
      }
    }
    
    // Return status for external verification
    return {
      success: !consoleLogs.some(l => l.includes('Audio file does not exist')),
      audioFound: audioElements.length > 0,
      screenshotsCount: 8,
      consoleLogs: consoleLogs.length
    };
  });
});