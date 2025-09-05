import { test, expect } from '@playwright/test';

const PROJECT_FILE = '/Users/chrismcleod/Development/ClaudeAccess/Project Files/test.transcript';

test('Direct IPC project loading test', async ({ page }) => {
  console.log('🧪 Testing direct IPC project loading...');
  
  // Setup console logging
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`📋 ${text}`);
  });
  
  // Navigate to app
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  // Test direct project loading
  const result = await page.evaluate(async (projectPath) => {
    console.log('🔧 Attempting direct project load...');
    
    try {
      // Check if electronAPI exists
      if (!(window as any).electronAPI) {
        return { error: 'electronAPI not available' };
      }
      
      console.log('electronAPI available, checking methods...');
      const api = (window as any).electronAPI;
      console.log('Available methods:', Object.keys(api));
      
      // Try different method names
      if (api.loadProject) {
        console.log('Using loadProject method...');
        const result = await api.loadProject(projectPath);
        return { method: 'loadProject', result };
      }
      
      if (api.openProject) {
        console.log('Using openProject method...');
        const result = await api.openProject(projectPath);
        return { method: 'openProject', result };
      }
      
      if (api.loadProjectFile) {
        console.log('Using loadProjectFile method...');
        const result = await api.loadProjectFile(projectPath);
        return { method: 'loadProjectFile', result };
      }
      
      return { error: 'No suitable project loading method found', availableMethods: Object.keys(api) };
      
    } catch (error) {
      console.log('❌ Error:', error);
      return { error: error.toString() };
    }
  }, PROJECT_FILE);
  
  console.log('🎯 Direct IPC result:', JSON.stringify(result, null, 2));
  
  // Wait for any project loading effects
  await page.waitForTimeout(5000);
  
  // Check the page state after loading attempt
  const finalState = await page.evaluate(() => {
    const state: any = {};
    
    // Check for project data in various places
    if ((window as any).projectState) {
      state.windowProjectState = (window as any).projectState;
    }
    
    // Check localStorage
    state.localStorage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('project')) {
        state.localStorage[key] = localStorage.getItem(key);
      }
    }
    
    // Check DOM for audio elements
    state.audioElementCount = document.querySelectorAll('audio').length;
    
    // Check for specific text content
    state.hasNoAudioMessage = document.body.textContent?.includes('No audio file available') || false;
    state.hasNoTranscriptMessage = document.body.textContent?.includes('No transcript available') || false;
    
    return state;
  });
  
  console.log('🎯 Final page state:', JSON.stringify(finalState, null, 2));
  
  // Filter and display relevant logs
  const relevantLogs = logs.filter(log => 
    log.toLowerCase().includes('project') ||
    log.toLowerCase().includes('audio') ||
    log.toLowerCase().includes('load') ||
    log.toLowerCase().includes('error')
  );
  
  console.log('\n📋 === RELEVANT LOGS ===');
  relevantLogs.forEach((log, i) => console.log(`${i + 1}. ${log}`));
  
  return {
    ipcResult: result,
    finalState,
    relevantLogCount: relevantLogs.length,
    totalLogCount: logs.length
  };
});