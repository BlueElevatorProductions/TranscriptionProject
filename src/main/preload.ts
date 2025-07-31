import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loading...');

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

  // Audio import and transcription
  importAudioDialog: () => ipcRenderer.invoke('import-audio-dialog'),
  startTranscription: (filePath: string, modelSize?: string) => 
    ipcRenderer.invoke('start-transcription', filePath, modelSize),
  getTranscriptionStatus: (jobId: string) => 
    ipcRenderer.invoke('get-transcription-status', jobId),
  getAllTranscriptions: () => ipcRenderer.invoke('get-all-transcriptions'),

  // Transcription event listeners
  onTranscriptionProgress: (callback: (job: any) => void) => {
    ipcRenderer.on('transcription-progress', (event, job) => callback(job));
  },
  onTranscriptionComplete: (callback: (job: any) => void) => {
    ipcRenderer.on('transcription-complete', (event, job) => callback(job));
  },
  onTranscriptionError: (callback: (job: any) => void) => {
    ipcRenderer.on('transcription-error', (event, job) => callback(job));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Audio file handling
  readAudioFile: (filePath: string) => ipcRenderer.invoke('read-audio-file', filePath),

  // API key management
  saveApiKeys: (apiKeys: { [service: string]: string }) => 
    ipcRenderer.invoke('save-api-keys', apiKeys),
  getApiKeys: () => ipcRenderer.invoke('get-api-keys'),

  // Project file management
  saveProject: (projectData: any, savePath: string, options?: any) => 
    ipcRenderer.invoke('save-project', projectData, savePath, options),
  loadProject: (projectPath: string) => 
    ipcRenderer.invoke('load-project', projectPath),
  showSaveProjectDialog: (options?: any) => 
    ipcRenderer.invoke('show-save-project-dialog', options),
  showOpenProjectDialog: () => 
    ipcRenderer.invoke('show-open-project-dialog'),

  // API connection testing
  testCloudConnection: (provider: string) => 
    ipcRenderer.invoke('test-cloud-connection', provider),
});

console.log('Preload script loaded successfully, electronAPI exposed');

// Type definitions for the exposed API
export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  onMenuNewProject: (callback: () => void) => void;
  onMenuOpenProject: (callback: () => void) => void;
  onMenuSaveProject: (callback: () => void) => void;
  onMenuImportAudio: (callback: () => void) => void;
  importAudioDialog: () => Promise<{success: boolean; filePath?: string; fileName?: string}>;
  startTranscription: (filePath: string, modelSize?: string) => Promise<{success: boolean; jobId?: string; error?: string}>;
  getTranscriptionStatus: (jobId: string) => Promise<any>;
  getAllTranscriptions: () => Promise<any[]>;
  onTranscriptionProgress: (callback: (job: any) => void) => void;
  onTranscriptionComplete: (callback: (job: any) => void) => void;
  onTranscriptionError: (callback: (job: any) => void) => void;
  removeAllListeners: (channel: string) => void;
  readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
  saveApiKeys: (apiKeys: { [service: string]: string }) => Promise<{success: boolean; error?: string}>;
  getApiKeys: () => Promise<{ [service: string]: string }>;
  saveProject: (projectData: any, savePath: string, options?: any) => Promise<{success: boolean; path?: string; error?: string}>;
  loadProject: (projectPath: string) => Promise<{success: boolean; project?: any; error?: string}>;
  showSaveProjectDialog: (options?: any) => Promise<{success: boolean; canceled?: boolean; filePath?: string; error?: string}>;
  showOpenProjectDialog: () => Promise<{success: boolean; canceled?: boolean; filePaths?: string[]; error?: string}>;
  testCloudConnection: (provider: string) => Promise<{success: boolean; connected?: boolean; error?: string}>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}