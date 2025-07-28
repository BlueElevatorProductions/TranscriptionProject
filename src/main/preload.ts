import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Menu event listeners
  onMenuNewProject: (callback: () => void) => {
    ipcRenderer.on('menu-new-project', callback);
  },
  onMenuOpenProject: (callback: () => void) => {
    ipcRenderer.on('menu-open-project', callback);
  },
  onMenuSaveProject: (callback: () => void) => {
    ipcRenderer.on('menu-save-project', callback);
  },
  onMenuImportAudio: (callback: () => void) => {
    ipcRenderer.on('menu-import-audio', callback);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  onMenuNewProject: (callback: () => void) => void;
  onMenuOpenProject: (callback: () => void) => void;
  onMenuSaveProject: (callback: () => void) => void;
  onMenuImportAudio: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}