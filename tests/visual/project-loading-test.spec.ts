import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_FILE = '/Users/chrismcleod/Development/ClaudeAccess/Project Files/test.transcript';
const SCREENSHOT_DIR = '/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/screenshots';

test.describe('Project Loading Test', () => {
  
  async function takeScreenshot(page: Page, name: string) {
    const screenshotPath = path.join(SCREENSHOT_DIR, `project-${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  function setupConsoleCapture(page: Page) {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      
      // Log important messages immediately
      if (text.toLowerCase().includes('audio') || 
          text.toLowerCase().includes('flac') || 
          text.toLowerCase().includes('mp3') ||
          text.toLowerCase().includes('path') ||
          text.toLowerCase().includes('embedded') ||
          text.toLowerCase().includes('project') ||
          text.toLowerCase().includes('loading') ||
          text.toLowerCase().includes('failed') ||
          text.toLowerCase().includes('error')) {
        console.log(`🔍 LOG: ${text}`);
      }
    });
    return consoleLogs;
  }

  test('Manually load test.transcript and debug audio paths', async ({ page }) => {
    console.log('🧪 Testing direct project loading...');
    
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    
    // Check if project file exists
    if (!fs.existsSync(PROJECT_FILE)) {
      console.log(`❌ Project file not found: ${PROJECT_FILE}`);
      return;
    }
    
    const projectStats = fs.statSync(PROJECT_FILE);
    console.log(`📁 Project file: ${PROJECT_FILE} (${projectStats.size} bytes)`);
    
    // Setup console capture
    const consoleLogs = setupConsoleCapture(page);
    
    // Navigate to app
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '01-initial');
    
    // Manually add the project to recent projects via localStorage
    console.log('📝 Adding test.transcript to recent projects...');
    await page.evaluate((projectPath) => {
      const recentProject = {
        id: 'test-transcript',
        name: 'Test Transcript',
        filePath: projectPath,
        lastAccessed: new Date().toISOString(),
        fileSize: 9356288, // Approximate size
        audioFileName: 'Intro Episode V1.mp3',
        duration: 0,
        speakerCount: 2,
        segmentCount: 100
      };
      
      const recentProjects = [recentProject];
      localStorage.setItem('recentProjects', JSON.stringify(recentProjects));
      
      // Trigger the custom event to update UI
      window.dispatchEvent(new CustomEvent('recentProjectsUpdated', { 
        detail: recentProjects 
      }));
      
      console.log('Recent projects updated:', recentProjects);
    }, PROJECT_FILE);
    
    // Wait for UI to update
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '02-after-adding-recent');
    
    // Now look for the project in the UI
    const recentProjects = page.locator('[data-testid*="recent"], .recent-project, .project-item, .project-card');
    const recentCount = await recentProjects.count();
    console.log(`📊 Found ${recentCount} recent project elements after localStorage update`);
    
    if (recentCount > 0) {
      await takeScreenshot(page, '03-recent-projects-visible');
      
      // Try to click the first/any recent project
      console.log('🖱️  Clicking on recent project...');
      await recentProjects.first().click();
      
      // Wait for project loading
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '04-after-click');
    } else {
      // If still no recent projects visible, try to refresh the page
      console.log('🔄 No recent projects visible, refreshing page...');
      await page.reload();
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '05-after-reload');
      
      // Check again
      const recentAfterReload = await page.locator('[data-testid*="recent"], .recent-project, .project-item').count();
      console.log(`📊 Recent projects after reload: ${recentAfterReload}`);
    }
    
    // Check if we have a transcript view now
    const transcriptView = page.locator('.transcript, [data-testid*="transcript"], .editor, [data-testid*="editor"]');
    const hasTranscript = await transcriptView.isVisible().catch(() => false);
    console.log(`📝 Transcript view visible: ${hasTranscript}`);
    
    // Check for audio player
    const audioPlayer = page.locator('audio, .audio-player, [data-testid*="audio"]');
    const hasAudio = await audioPlayer.isVisible().catch(() => false);
    console.log(`🎵 Audio player visible: ${hasAudio}`);
    
    await takeScreenshot(page, '06-final-state');
    
    // Wait longer to capture any async loading
    await page.waitForTimeout(5000);
    await takeScreenshot(page, '07-after-wait');
    
    // Check filesystem for any newly created audio files
    console.log('\n📁 === FILESYSTEM CHECK ===');
    const tempDir = '/var/folders/vf/2cjjjk411ql3393h8qf_dwwh0000gn/T';
    
    // Check for new transcription_project directories
    const tempFiles = fs.readdirSync(tempDir);
    const projectDirs = tempFiles.filter(f => f.startsWith('transcription_project_'));
    const recentDirs = projectDirs.slice(-3); // Get 3 most recent
    
    console.log(`📁 Recent transcription directories (${recentDirs.length}):`);
    recentDirs.forEach(dir => {
      const fullPath = path.join(tempDir, dir);
      try {
        const contents = fs.readdirSync(fullPath);
        const dirStats = fs.statSync(fullPath);
        console.log(`📁 ${dir} (created: ${dirStats.birthtime.toISOString()}):`);
        contents.forEach(file => {
          const filePath = path.join(fullPath, file);
          const stats = fs.statSync(filePath);
          console.log(`   - ${file} (${stats.size} bytes, ${path.extname(file)})`);
        });
      } catch (err) {
        console.log(`   Error: ${err}`);
      }
    });
    
    // Output console logs with focus on audio/project loading
    console.log('\n📋 === RELEVANT CONSOLE LOGS ===');
    const relevantLogs = consoleLogs.filter(log => 
      log.toLowerCase().includes('audio') ||
      log.toLowerCase().includes('project') ||
      log.toLowerCase().includes('loading') ||
      log.toLowerCase().includes('error') ||
      log.toLowerCase().includes('path') ||
      log.toLowerCase().includes('flac') ||
      log.toLowerCase().includes('mp3')
    );
    
    relevantLogs.forEach((log, i) => console.log(`${i + 1}. ${log}`));
    
    if (relevantLogs.length === 0) {
      console.log('No relevant logs found. All logs:');
      consoleLogs.slice(-10).forEach((log, i) => console.log(`${i + 1}. ${log}`));
    }
    
    // Summary
    console.log('\n🎯 === SUMMARY ===');
    console.log(`Project file exists: ${fs.existsSync(PROJECT_FILE)} (${projectStats.size} bytes)`);
    console.log(`Recent projects found: ${recentCount}`);
    console.log(`Transcript view visible: ${hasTranscript}`);
    console.log(`Audio player visible: ${hasAudio}`);
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Audio-related logs: ${relevantLogs.length}`);
    
    // Return test results
    return {
      projectLoaded: hasTranscript,
      audioVisible: hasAudio,
      errorCount: consoleLogs.filter(l => l.includes('[error]')).length,
      logCount: consoleLogs.length
    };
  });
});