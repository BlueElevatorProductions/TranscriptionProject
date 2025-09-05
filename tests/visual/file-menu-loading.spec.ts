import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_FILE = '/Users/chrismcleod/Development/ClaudeAccess/Project Files/test.transcript';
const SCREENSHOT_DIR = '/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/screenshots';

test.describe('File Menu Project Loading', () => {
  
  async function takeScreenshot(page: Page, name: string) {
    const screenshotPath = path.join(SCREENSHOT_DIR, `file-${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot: ${screenshotPath}`);
    return screenshotPath;
  }

  function setupConsoleCapture(page: Page) {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      
      // Log critical messages immediately
      if (text.toLowerCase().includes('audio') || 
          text.toLowerCase().includes('flac') || 
          text.toLowerCase().includes('mp3') ||
          text.toLowerCase().includes('path') ||
          text.toLowerCase().includes('embedded') ||
          text.toLowerCase().includes('project') ||
          text.toLowerCase().includes('loading') ||
          text.toLowerCase().includes('failed') ||
          text.toLowerCase().includes('error') ||
          text.toLowerCase().includes('extracted')) {
        console.log(`🔍 ${text}`);
      }
    });
    return consoleLogs;
  }

  test('Load project via File menu and debug audio path resolution', async ({ page }) => {
    console.log('🧪 Testing File menu project loading...');
    
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    
    // Verify project file exists
    if (!fs.existsSync(PROJECT_FILE)) {
      console.log(`❌ Project file not found: ${PROJECT_FILE}`);
      return;
    }
    
    const projectStats = fs.statSync(PROJECT_FILE);
    console.log(`📁 Project file: ${PROJECT_FILE} (${(projectStats.size/1024/1024).toFixed(2)} MB)`);
    
    // Setup console capture
    const consoleLogs = setupConsoleCapture(page);
    
    // Navigate to app
    console.log('🌐 Loading app...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '01-app-loaded');
    
    // Click on File menu
    console.log('📂 Clicking File menu...');
    const fileMenu = page.locator('text=File, button:has-text("File"), [role="button"]:has-text("File")').first();
    
    if (await fileMenu.isVisible()) {
      await fileMenu.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '02-file-menu-opened');
      
      // Look for Open or Load Project option
      console.log('🔍 Looking for Open/Load project option...');
      const openOptions = await page.locator('text=Open, text=Load, text=Import, button:has-text("Open"), button:has-text("Load"), button:has-text("Import")').all();
      
      console.log(`Found ${openOptions.length} potential open options`);
      
      for (let i = 0; i < openOptions.length; i++) {
        const option = openOptions[i];
        const text = await option.textContent();
        console.log(`  ${i + 1}. "${text}"`);
      }
      
      if (openOptions.length > 0) {
        // Try clicking the first open option
        console.log('🖱️  Clicking first open option...');
        await openOptions[0].click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, '03-after-open-click');
        
        // This would typically open a file dialog
        // In a real scenario, we'd need to handle the native file dialog
        console.log('📁 File dialog should have opened (requires manual interaction in real use)');
      }
    } else {
      console.log('❌ File menu not found or not clickable');
    }
    
    // Try alternative methods to trigger project loading
    console.log('⚡ Trying alternative approaches...');
    
    // Method 1: Keyboard shortcut
    console.log('⌨️  Trying Cmd+O...');
    await page.keyboard.press('Meta+o');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '04-after-cmd-o');
    
    // Method 2: Check if there's a recent projects area or import area
    console.log('🔍 Looking for import/recent areas...');
    const importAreas = await page.locator('[data-testid*="import"], [data-testid*="recent"], .import, .recent, text="Import", text="Recent"').all();
    console.log(`Found ${importAreas.length} import/recent areas`);
    
    // Method 3: Try to directly trigger project loading via JavaScript
    console.log('🔧 Attempting direct project loading via IPC...');
    const loadResult = await page.evaluate(async (projectPath) => {
      try {
        // Check if electronAPI is available
        if (!(window as any).electronAPI?.loadProject) {
          return { error: 'electronAPI.loadProject not available' };
        }
        
        console.log('Attempting to load project via electronAPI:', projectPath);
        const result = await (window as any).electronAPI.loadProject(projectPath);
        console.log('Load project result:', result);
        return { success: true, result };
      } catch (error) {
        console.log('Load project error:', error);
        return { error: error.toString() };
      }
    }, PROJECT_FILE);
    
    console.log('📊 Direct loading result:', loadResult);
    
    // Wait for any async operations
    await page.waitForTimeout(5000);
    await takeScreenshot(page, '05-after-direct-load');
    
    // Check current state
    console.log('🔍 Checking app state...');
    
    // Check if audio/transcript loaded
    const audioElements = await page.locator('audio, [data-testid*="audio"], .audio').count();
    const transcriptElements = await page.locator('[data-testid*="transcript"], .transcript, .editor').count();
    const errorElements = await page.locator('.error, [class*="error"], [role="alert"]').count();
    
    console.log(`🎵 Audio elements: ${audioElements}`);
    console.log(`📝 Transcript elements: ${transcriptElements}`);
    console.log(`❌ Error elements: ${errorElements}`);
    
    // Check for specific messages
    const noAudioMessage = await page.locator('text=No audio file available, text=Import an audio file').isVisible().catch(() => false);
    const noTranscriptMessage = await page.locator('text=No transcript available').isVisible().catch(() => false);
    
    console.log(`📄 "No audio file available": ${noAudioMessage}`);
    console.log(`📄 "No transcript available": ${noTranscriptMessage}`);
    
    // Final screenshot
    await takeScreenshot(page, '06-final-state');
    
    // Analyze console logs
    console.log('\n📋 === AUDIO/PROJECT LOGS ===');
    const relevantLogs = consoleLogs.filter(log => 
      log.toLowerCase().includes('audio') ||
      log.toLowerCase().includes('project') ||
      log.toLowerCase().includes('load') ||
      log.toLowerCase().includes('error') ||
      log.toLowerCase().includes('path') ||
      log.toLowerCase().includes('flac') ||
      log.toLowerCase().includes('mp3') ||
      log.toLowerCase().includes('embedded')
    );
    
    if (relevantLogs.length > 0) {
      relevantLogs.forEach((log, i) => console.log(`${i + 1}. ${log}`));
    } else {
      console.log('No relevant logs found');
    }
    
    // Check filesystem for new extractions
    console.log('\n📁 === FILESYSTEM CHECK ===');
    const tempDir = '/var/folders/vf/2cjjjk411ql3393h8qf_dwwh0000gn/T';
    const tempFiles = fs.readdirSync(tempDir);
    const newProjectDirs = tempFiles.filter(f => f.startsWith('transcription_project_')).slice(-2);
    
    console.log(`📁 Latest project directories (${newProjectDirs.length}):`);
    newProjectDirs.forEach(dir => {
      const fullPath = path.join(tempDir, dir);
      const stats = fs.statSync(fullPath);
      console.log(`📁 ${dir} (created: ${stats.birthtime.toISOString()})`);
      
      try {
        const contents = fs.readdirSync(fullPath);
        contents.forEach(file => {
          const fileStats = fs.statSync(path.join(fullPath, file));
          const ext = path.extname(file);
          console.log(`   - ${file} (${fileStats.size} bytes, ${ext})`);
        });
      } catch (err) {
        console.log(`   Error reading contents: ${err}`);
      }
    });
    
    // Summary
    console.log('\n🎯 === SUMMARY ===');
    console.log(`Project file size: ${(projectStats.size/1024/1024).toFixed(2)} MB`);
    console.log(`Console logs: ${consoleLogs.length} total, ${relevantLogs.length} relevant`);
    console.log(`App state: ${noAudioMessage ? 'No audio' : 'Audio may be loaded'}`);
    console.log(`Direct load result: ${loadResult.success ? 'Success' : loadResult.error}`);
    
    // Look for specific errors
    const audioErrors = consoleLogs.filter(log => log.includes('Audio file does not exist'));
    if (audioErrors.length > 0) {
      console.log('\n❌ === AUDIO FILE ERRORS ===');
      audioErrors.forEach(error => console.log(`🚨 ${error}`));
    }
    
    return {
      projectExists: fs.existsSync(PROJECT_FILE),
      directLoadWorked: loadResult.success || false,
      audioElementsFound: audioElements > 0,
      errorCount: audioErrors.length,
      relevantLogCount: relevantLogs.length
    };
  });
});