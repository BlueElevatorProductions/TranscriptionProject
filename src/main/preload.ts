import { contextBridge, ipcRenderer } from 'electron';
import type { JuceEvent, EdlClip } from '../shared/types/transport';

console.log('🔧 PRELOAD SCRIPT LOADING...');
console.log('🔧 Process info:', {
  platform: process.platform,
  pid: process.pid,
  versions: process.versions
});

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
  onToggleTheme: (callback: () => void) => {
    ipcRenderer.on('toggle-theme', callback);
  },

  // Audio import and transcription
  importAudioDialog: () => ipcRenderer.invoke('import-audio-dialog'),
  startTranscription: (filePath: string, modelSize?: string) => 
    ipcRenderer.invoke('start-transcription', filePath, modelSize),
  getTranscriptionStatus: (jobId: string) => 
    ipcRenderer.invoke('get-transcription-status', jobId),
  getAllTranscriptions: () => ipcRenderer.invoke('get-all-transcriptions'),
  getTranscriptionUpdates: () => ipcRenderer.invoke('getTranscriptionUpdates'),
  cancelTranscription: (jobId: string) => 
    ipcRenderer.invoke('cancel-transcription', jobId),

  // Transcription event listeners
  onTranscriptionProgress: (callback: (job: any) => void) => {
    ipcRenderer.on('transcription-progress', (event, job) => {
      console.log('Preload: transcription-progress event received:', event);
      console.log('Preload: transcription-progress job data:', job);
      callback(job);
    });
  },
  onTranscriptionComplete: (callback: (job: any) => void) => {
    ipcRenderer.on('transcription-complete', (event, job) => callback(job));
  },
  onTranscriptionError: (callback: (job: any) => void) => {
    ipcRenderer.on('transcription-error', (event, job) => callback(job));
  },
  onDebugLog: (callback: (message: string) => void) => {
    ipcRenderer.on('debug-log', (event, message) => callback(message));
  },
  onAudioConversionProgress: (callback: (data: {percent: number; status: string}) => void) => {
    ipcRenderer.on('audio-conversion-progress', (event, data) => callback(data));
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

  // Project file management (legacy)
  saveProjectLegacy: (projectData: any, savePath: string, options?: any) => 
    ipcRenderer.invoke('save-project', projectData, savePath, options),
  loadProjectLegacy: (projectPath: string) => 
    ipcRenderer.invoke('load-project', projectPath),
  showSaveProjectDialog: (options?: any) => 
    ipcRenderer.invoke('show-save-project-dialog', options),
  showOpenProjectDialog: () => 
    ipcRenderer.invoke('show-open-project-dialog'),

  // API connection testing
  testCloudConnection: (provider: string) => 
    ipcRenderer.invoke('test-cloud-connection', provider),
  
  // File existence check
  checkFileExists: (filePath: string) =>
    ipcRenderer.invoke('checkFileExists', filePath),

  // Project file system (new .transcript format)
  openProjectDialog: () => ipcRenderer.invoke('openProjectDialog'),
  saveProjectDialog: (defaultName?: string) => 
    ipcRenderer.invoke('saveProjectDialog', defaultName),
  loadProject: (filePath: string) => 
    ipcRenderer.invoke('project:load', filePath),
  saveProject: (projectData: any, filePath: string) => 
    ipcRenderer.invoke('project:save', projectData, filePath),
  
  // Directory selection for new projects
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // Audio analysis and conversion (new enhanced import system)
  analyzeAudio: (filePath: string) => ipcRenderer.invoke('analyze-audio', filePath),
  getAudioRecommendation: (analysis: any) => ipcRenderer.invoke('get-audio-recommendation', analysis),
  getSmartProjectSettings: (analysis: any) => ipcRenderer.invoke('get-smart-project-settings', analysis),
  convertAudio: (inputPath: string, options: any) => ipcRenderer.invoke('convert-audio', inputPath, options),
  
  // User preferences management
  loadUserPreferences: () => ipcRenderer.invoke('load-user-preferences'),
  saveUserPreferences: (preferences: any) => ipcRenderer.invoke('save-user-preferences', preferences),
  resetUserPreferences: () => ipcRenderer.invoke('reset-user-preferences'),
  getTranscriptionService: (preferences: any) => ipcRenderer.invoke('get-transcription-service', preferences),
  // Open/close audio editor child window
  openAudioEditor: (audioPath: string) => ipcRenderer.invoke('open-audio-editor', audioPath),
  closeAudioEditor: () => ipcRenderer.invoke('close-audio-editor'),
  // Audio peaks (dev utility)
  getAudioPeaks: (filePath: string, samplesPerPixel?: number) => ipcRenderer.invoke('audio:peaks', filePath, samplesPerPixel),
});

console.log('🔧 PRELOAD SCRIPT LOADED SUCCESSFULLY!');
console.log('🔧 electronAPI exposed to renderer process');
console.log('🔧 Available methods:', Object.keys({
  loadProject: true,
  loadProjectLegacy: true,
  // ... other methods
}));

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
  getTranscriptionUpdates: () => Promise<any[]>;
  onTranscriptionProgress: (callback: (job: any) => void) => void;
  onTranscriptionComplete: (callback: (job: any) => void) => void;
  onTranscriptionError: (callback: (job: any) => void) => void;
  removeAllListeners: (channel: string) => void;
  readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
  saveApiKeys: (apiKeys: { [service: string]: string }) => Promise<{success: boolean; error?: string}>;
  getApiKeys: () => Promise<{ [service: string]: string }>;
  saveProjectLegacy: (projectData: any, savePath: string, options?: any) => Promise<{success: boolean; path?: string; error?: string}>;
  loadProjectLegacy: (projectPath: string) => Promise<{success: boolean; project?: any; error?: string}>;
  showSaveProjectDialog: (options?: any) => Promise<{success: boolean; canceled?: boolean; filePath?: string; error?: string}>;
  showOpenProjectDialog: () => Promise<{success: boolean; canceled?: boolean; filePaths?: string[]; error?: string}>;
  testCloudConnection: (provider: string) => Promise<{success: boolean; connected?: boolean; error?: string}>;
  
  // Project file system (new .transcript format)
  openProjectDialog: () => Promise<{canceled: boolean; filePaths?: string[]}>;
  saveProjectDialog: (defaultName?: string) => Promise<{canceled: boolean; filePath?: string}>;
  loadProject: (filePath: string) => Promise<any>;
  saveProject: (projectData: any, filePath: string) => Promise<{success: boolean}>;
  
  // Audio analysis and conversion (new enhanced import system)
  analyzeAudio: (filePath: string) => Promise<any>;
  getAudioRecommendation: (analysis: any) => Promise<any>;
  getSmartProjectSettings: (analysis: any) => Promise<any>;
  convertAudio: (inputPath: string, options: any) => Promise<any>;
  
  // User preferences management
  loadUserPreferences: () => Promise<any>;
  saveUserPreferences: (preferences: any) => Promise<{success: boolean}>;
  resetUserPreferences: () => Promise<any>;
  getTranscriptionService: (preferences: any) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    juceTransport: {
      load: (id: string, path: string) => Promise<{ success: boolean; error?: string }>;
      updateEdl: (id: string, clips: EdlClip[]) => Promise<{ success: boolean; error?: string }>;
      play: (id: string) => Promise<{ success: boolean; error?: string }>;
      pause: (id: string) => Promise<{ success: boolean; error?: string }>;
      stop: (id: string) => Promise<{ success: boolean; error?: string }>;
      seek: (id: string, timeSec: number) => Promise<{ success: boolean; error?: string }>;
      setRate: (id: string, rate: number) => Promise<{ success: boolean; error?: string }>;
      setVolume: (id: string, value: number) => Promise<{ success: boolean; error?: string }>;
      queryState: (id: string) => Promise<{ success: boolean; error?: string }>;
      dispose: () => Promise<{ success: boolean; error?: string }>;
      onEvent: (cb: (evt: JuceEvent) => void) => void;
      offEvent: (cb: (evt: JuceEvent) => void) => void;
      removeAllListeners: () => void;
    };
  }
}

// JUCE transport API exposed separately for clarity
const juceEventListeners = new Set<(evt: JuceEvent) => void>();
ipcRenderer.on('juce:event', (_event, evt: JuceEvent) => {
  for (const cb of juceEventListeners) {
    try { cb(evt); } catch {}
  }
});

contextBridge.exposeInMainWorld('juceTransport', {
  load: (id: string, path: string) => ipcRenderer.invoke('juce:load', id, path),
  updateEdl: (id: string, clips: EdlClip[]) => ipcRenderer.invoke('juce:updateEdl', id, clips),
  play: (id: string) => ipcRenderer.invoke('juce:play', id),
  pause: (id: string) => ipcRenderer.invoke('juce:pause', id),
  stop: (id: string) => ipcRenderer.invoke('juce:stop', id),
  seek: (id: string, timeSec: number) => ipcRenderer.invoke('juce:seek', id, timeSec),
  setRate: (id: string, rate: number) => ipcRenderer.invoke('juce:setRate', id, rate),
  setVolume: (id: string, value: number) => ipcRenderer.invoke('juce:setVolume', id, value),
  queryState: (id: string) => ipcRenderer.invoke('juce:queryState', id),
  dispose: () => ipcRenderer.invoke('juce:dispose'),
  onEvent: (cb: (evt: JuceEvent) => void) => { juceEventListeners.add(cb); },
  offEvent: (cb: (evt: JuceEvent) => void) => { juceEventListeners.delete(cb); },
  removeAllListeners: () => { juceEventListeners.clear(); },
});
