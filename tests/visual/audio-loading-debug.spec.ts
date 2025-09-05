import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Audio Loading Debug', () => {
  test('should load audio from existing project and debug path resolution', async ({ page }) => {
    console.log('🧪 Starting audio loading debug test');
    
    // Start the Electron app
    await page.goto('http://localhost:3000');
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="home-view"]', { timeout: 30000 });
    
    console.log('✅ App loaded successfully');
    
    // Look for recent projects or create a test project
    const openProjectButton = page.locator('button:has-text("Open Project")');
    if (await openProjectButton.isVisible()) {
      console.log('📁 Attempting to open existing project');
      await openProjectButton.click();
      
      // Wait for file dialog and select a project file
      // This will require manual interaction or we need to mock the dialog
    } else {
      console.log('❌ No open project button found, checking for recent projects');
      
      // Check if there are recent projects displayed
      const recentProjects = page.locator('[data-testid="recent-project-item"]');
      const recentProjectCount = await recentProjects.count();
      
      if (recentProjectCount > 0) {
        console.log(`📂 Found ${recentProjectCount} recent projects, opening first one`);
        await recentProjects.first().click();
        
        // Wait for project to load
        await page.waitForTimeout(3000);
        
        // Check console logs for audio loading attempts
        const consoleLogs: string[] = [];
        page.on('console', msg => {
          const logMessage = `${msg.type()}: ${msg.text()}`;
          consoleLogs.push(logMessage);
          console.log(`🖥️  ${logMessage}`);
        });
        
        // Wait a bit more to capture logs
        await page.waitForTimeout(2000);
        
        // Check for audio-related elements
        const audioElements = await page.locator('audio').count();
        console.log(`🎵 Found ${audioElements} audio elements on page`);
        
        // Check for error messages
        const errorElements = await page.locator('[class*="error"], .error, [data-testid*="error"]').count();
        console.log(`⚠️  Found ${errorElements} error elements on page`);
        
        // Look for audio player controls
        const audioControls = await page.locator('[data-testid*="audio"], button[title*="play"], button[title*="pause"]').count();
        console.log(`🎛️  Found ${audioControls} audio control elements`);
        
        // Check project state by inspecting the page
        const projectInfo = await page.evaluate(() => {
          // Try to access project context or state
          return {
            url: window.location.href,
            title: document.title,
            hasAudioElements: document.querySelectorAll('audio').length,
            hasErrorMessages: document.querySelectorAll('.error, [class*="error"]').length,
            projectDataInStorage: localStorage.getItem('currentProject') || 'none',
          };
        });
        
        console.log('📊 Project Info:', projectInfo);
        
        // Log console messages that contain audio-related keywords
        const audioLogs = consoleLogs.filter(log => 
          log.toLowerCase().includes('audio') || 
          log.toLowerCase().includes('flac') || 
          log.toLowerCase().includes('mp3') ||
          log.toLowerCase().includes('conversion') ||
          log.toLowerCase().includes('path')
        );
        
        console.log('🎵 Audio-related console logs:');
        audioLogs.forEach(log => console.log(`   ${log}`));
        
        // Try to trigger audio loading manually
        console.log('🔄 Attempting to trigger audio loading...');
        
        // Look for play button or audio trigger
        const playButton = page.locator('button[title*="play"], [data-testid*="play"], .play-button');
        if (await playButton.first().isVisible()) {
          console.log('▶️  Found play button, clicking...');
          await playButton.first().click();
          await page.waitForTimeout(2000);
        }
        
        // Check for any new console messages after play attempt
        await page.waitForTimeout(1000);
        
      } else {
        console.log('❌ No recent projects found');
        // We might need to create a test project or provide instructions
        throw new Error('No projects available for testing. Please ensure there are recent projects or create a test project.');
      }
    }
    
    // Final console log capture
    console.log('🏁 Test completed. Check logs above for audio loading issues.');
    
    // The test should help us understand:
    // 1. What paths are being generated
    // 2. Where files are being looked for vs where they exist
    // 3. What the project data structure looks like
    // 4. What console errors are occurring
  });
  
  test('should examine filesystem for audio conversion artifacts', async ({ page }) => {
    console.log('📂 Examining filesystem for audio conversion artifacts');
    
    // Check various temp directories for audio files
    const tempDirs = [
      '/tmp',
      '/var/folders/vf/2cjjjk411ql3393h8qf_dwwh0000gn/T',
      '/var/folders/vf/2cjjjk411ql3393h8qf_dwwh0000gn/T/audio_conversion'
    ];
    
    for (const dir of tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(file => 
            file.includes('audio') || 
            file.endsWith('.flac') || 
            file.endsWith('.mp3') || 
            file.endsWith('.wav') ||
            file.includes('Intro Episode') ||
            file.includes('transcription')
          );
          
          if (files.length > 0) {
            console.log(`📁 ${dir}:`);
            files.forEach(file => {
              const filePath = path.join(dir, file);
              try {
                const stats = fs.statSync(filePath);
                console.log(`   📄 ${file} (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
              } catch (err) {
                console.log(`   📄 ${file} (error reading stats: ${err})`);
              }
            });
          } else {
            console.log(`📁 ${dir}: No audio files found`);
          }
        } else {
          console.log(`📁 ${dir}: Directory does not exist`);
        }
      } catch (error) {
        console.log(`❌ Error reading ${dir}: ${error}`);
      }
    }
    
    // Also check for transcription project directories
    try {
      const tempDir = '/var/folders/vf/2cjjjk411ql3393h8qf_dwwh0000gn/T';
      if (fs.existsSync(tempDir)) {
        const transcriptionDirs = fs.readdirSync(tempDir).filter(name => 
          name.includes('transcription_project')
        );
        
        console.log(`📁 Found ${transcriptionDirs.length} transcription project directories:`);
        transcriptionDirs.forEach(dir => {
          const fullPath = path.join(tempDir, dir);
          try {
            const files = fs.readdirSync(fullPath);
            console.log(`   📁 ${dir}:`);
            files.forEach(file => console.log(`      📄 ${file}`));
          } catch (err) {
            console.log(`   📁 ${dir}: Error reading contents`);
          }
        });
      }
    } catch (error) {
      console.log(`❌ Error examining transcription directories: ${error}`);
    }
  });
  
  test('should create test project with audio and debug loading process', async ({ page }) => {
    console.log('🧪 Creating test project to debug audio loading process');
    
    // Go to app
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="home-view"]', { timeout: 30000 });
    
    // Capture all console messages
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const logMessage = `${msg.type()}: ${msg.text()}`;
      consoleLogs.push(logMessage);
      if (logMessage.includes('audio') || logMessage.includes('Audio') || 
          logMessage.includes('FLAC') || logMessage.includes('flac') ||
          logMessage.includes('MP3') || logMessage.includes('mp3') ||
          logMessage.includes('path') || logMessage.includes('Path') ||
          logMessage.includes('conversion') || logMessage.includes('Conversion')) {
        console.log(`🎵 AUDIO LOG: ${logMessage}`);
      }
    });
    
    // Look for import or create project button
    const importButton = page.locator('button:has-text("Import"), button:has-text("Create"), button:has-text("New Project")');
    
    if (await importButton.first().isVisible()) {
      console.log('📥 Found import/create button, attempting to start project creation');
      await importButton.first().click();
      
      // Wait for any dialog or file picker
      await page.waitForTimeout(3000);
      
      // Look for audio file input or drag-drop area
      const audioInput = page.locator('input[type="file"], [data-testid*="audio"], .drop-zone, .file-upload');
      const audioInputCount = await audioInput.count();
      console.log(`📁 Found ${audioInputCount} audio input elements`);
      
      if (audioInputCount > 0) {
        console.log('📁 Audio input found - this would be where we test file upload');
        // In a real test, we'd upload a test audio file here
        // For now, we'll just log what we found
      }
    }
    
    // Wait to capture any initialization logs
    await page.waitForTimeout(5000);
    
    // Log all relevant console messages
    console.log('📋 All console messages captured:');
    consoleLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log}`);
    });
  });
});