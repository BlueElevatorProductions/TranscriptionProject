// Minimal preload script to test loading
console.log('🔧 MINIMAL PRELOAD SCRIPT STARTING...');

try {
  console.log('🔧 Importing electron...');
  const { contextBridge, ipcRenderer } = require('electron');
  console.log('🔧 Electron imported successfully');
  
  console.log('🔧 Exposing electronAPI...');
  contextBridge.exposeInMainWorld('electronAPI', {
    // Simple test method
    test: () => 'electronAPI is working!',
    
    // Key project loading method
    loadProject: (filePath: string) => {
      console.log('🔧 loadProject called with:', filePath);
      return ipcRenderer.invoke('project:load', filePath);
    }
  });
  
  console.log('🔧 MINIMAL PRELOAD SCRIPT LOADED SUCCESSFULLY!');
} catch (error) {
  console.error('🔧 PRELOAD SCRIPT ERROR:', error);
}