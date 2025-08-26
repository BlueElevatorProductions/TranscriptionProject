import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { SimpleCloudTranscriptionService } from './services/SimpleCloudTranscriptionService';
import { ProjectFileManager } from './services/ProjectFileManager';
import { ProjectFileService } from './services/ProjectFileService';
import { ProjectPackageService } from './services/ProjectPackageService';
import AudioAnalyzer from './services/AudioAnalyzer';
import AudioConverter from './services/AudioConverter';
import UserPreferencesService from './services/UserPreferences';

// Load environment variables from .env file
dotenv.config();

const isDev = () => {
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
};

interface TranscriptionJob {
  id: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
  speakerNames?: { [key: string]: string };
  speakerMerges?: { [key: string]: string };
}

class App {
  private mainWindow: BrowserWindow | null = null;
  private transcriptionJobs: Map<string, TranscriptionJob> = new Map();
  private readonly encryptionKey: string;
  private readonly apiKeysPath: string;
  private readonly projectManager: ProjectFileManager;
  private readonly audioAnalyzer: AudioAnalyzer;
  private readonly audioConverter: AudioConverter;
  private readonly userPreferences: UserPreferencesService;

  constructor() {
    // Initialize encryption key (derived from machine-specific info)
    this.encryptionKey = this.generateEncryptionKey();
    
    // Set API keys storage path
    this.apiKeysPath = path.join(app.getPath('userData'), 'api-keys.enc');
    
    // Initialize project manager
    this.projectManager = new ProjectFileManager();
    
    // Initialize audio services
    this.audioAnalyzer = new AudioAnalyzer();
    this.audioConverter = new AudioConverter();
    this.userPreferences = new UserPreferencesService(this.encryptionKey);
    
    this.initialize();
  }

  private initialize(): void {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupMenu();
      this.setupIPC();

      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      // Clean up temp files and resources
      this.audioConverter.cleanup().catch(console.error);
      
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    app.on('before-quit', () => {
      // Clean up resources before app quits
      this.audioConverter.cleanup().catch(console.error);
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });
    });
  }

  private createMainWindow(): void {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: 'hiddenInset', // Hidden title bar but still draggable - perfect for transparent windows
      transparent: true, // Enable window transparency
      vibrancy: 'sidebar', // macOS vibrancy effect - try 'sidebar', 'window', 'content' for different effects
      backgroundColor: '#00000000', // Fully transparent background
      movable: true, // Explicitly enable window movement
      resizable: true, // Ensure resizing is enabled
      show: false, // Don't show until ready-to-show
    });

    // Load the app
    if (isDev()) {
      this.mainWindow.loadURL('http://localhost:3000');
      
      // Check environment variable to control DevTools
      const devToolsEnabled = process.env.DEVTOOLS_ENABLED === 'true';
      if (devToolsEnabled) {
        console.log('🧪 Opening DevTools (DEVTOOLS_ENABLED=true)');
        this.mainWindow.webContents.openDevTools();
      } else {
        console.log('✨ DevTools disabled (DEVTOOLS_ENABLED=false or not set)');
      }
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    
    // Add event listeners for error handling
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Electron: Page failed to load:', errorCode, errorDescription);
    });

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Project',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-project');
            },
          },
          {
            label: 'Open Project',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              this.mainWindow?.webContents.send('menu-open-project');
            },
          },
          {
            label: 'Save Project',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow?.webContents.send('menu-save-project');
            },
          },
          { type: 'separator' },
          {
            label: 'Import Audio',
            accelerator: 'CmdOrCtrl+I',
            click: () => {
              this.mainWindow?.webContents.send('menu-import-audio');
            },
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIPC(): void {
    // Handle IPC messages from renderer
    ipcMain.handle('app-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('get-platform', () => {
      return process.platform;
    });

    // Audio file import dialog
    ipcMain.handle('import-audio-dialog', async () => {
      try {
        if (!this.mainWindow) {
          return { success: false, error: 'Main window not available' };
        }
        
        const result = await dialog.showOpenDialog(this.mainWindow, {
          title: 'Import Audio File',
          properties: ['openFile'],
          filters: [
            {
              name: 'Audio Files',
              extensions: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'wma', 'aac']
            },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          return {
            success: true,
            filePath: result.filePaths[0],
            fileName: path.basename(result.filePaths[0])
          };
        }

        return { success: false };
      } catch (error) {
        console.error('Dialog error:', error);
        return { 
          success: false, 
          error: `Dialog error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    });

    // Start transcription
    ipcMain.handle('start-transcription', async (event, filePath: string, modelSize: string = 'base') => {
      console.log('Starting transcription:', { filePath, modelSize });
      
      // Send debug info to renderer
      this.mainWindow?.webContents.send('debug-log', `Main: Starting transcription with model ${modelSize}`);
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Audio file does not exist' };
      }

      // Validate file extension
      const supportedExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.wma', '.aac'];
      const fileExtension = path.extname(filePath).toLowerCase();
      if (!supportedExtensions.includes(fileExtension)) {
        return { 
          success: false, 
          error: `Unsupported file format: ${fileExtension}. Supported formats: ${supportedExtensions.join(', ')}` 
        };
      }

      // Check file size (limit to 500MB)
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      if (fileSizeInMB > 500) {
        return { 
          success: false, 
          error: `File too large: ${fileSizeInMB.toFixed(1)}MB. Maximum size is 500MB.` 
        };
      }

      // Validate model size (including cloud models)
      const validLocalModels = ['tiny', 'base', 'small', 'medium', 'large'];
      const validCloudModels = ['cloud-openai', 'cloud-assemblyai', 'cloud-revai'];
      const allValidModels = [...validLocalModels, ...validCloudModels];
      
      if (!allValidModels.includes(modelSize)) {
        return { success: false, error: `Invalid model size: ${modelSize}` };
      }

      const jobId = Date.now().toString();
      const fileName = path.basename(filePath);
      
      // Check if it's a cloud model
      if (modelSize.startsWith('cloud-')) {
        console.log('Processing cloud transcription...');
        this.mainWindow?.webContents.send('debug-log', `Main: Processing cloud transcription`);
        const provider = modelSize.split('-')[1];
        console.log('Provider:', provider);
        this.mainWindow?.webContents.send('debug-log', `Main: Provider is ${provider}`);
        
        const job: TranscriptionJob = {
          id: jobId,
          filePath,
          fileName,
          status: 'pending',
          progress: 0
        };

        this.transcriptionJobs.set(jobId, job);
        this.mainWindow?.webContents.send('debug-log', `Main: Created cloud job with ID ${jobId}`);

        // Start cloud transcription process
        try {
          this.runCloudTranscription(jobId, filePath, modelSize);
          this.mainWindow?.webContents.send('debug-log', `Main: Called runCloudTranscription`);
        } catch (error) {
          this.mainWindow?.webContents.send('debug-log', `Main: Error calling runCloudTranscription: ${error}`);
        }

        return { success: true, jobId };
      } else {
        console.log('Processing local transcription...');
        
        const job: TranscriptionJob = {
          id: jobId,
          filePath,
          fileName,
          status: 'pending',
          progress: 0
        };

        this.transcriptionJobs.set(jobId, job);

        // Start local transcription process
        this.runTranscription(jobId, filePath, modelSize);

        return { success: true, jobId };
      }
    });

    // Get transcription status
    ipcMain.handle('get-transcription-status', (event, jobId: string) => {
      const job = this.transcriptionJobs.get(jobId);
      return job || null;
    });

    // Get all transcription jobs
    ipcMain.handle('get-all-transcriptions', () => {
      return Array.from(this.transcriptionJobs.values());
    });

    // Get transcription updates for polling
    ipcMain.handle('getTranscriptionUpdates', () => {
      return Array.from(this.transcriptionJobs.values());
    });

    // Cancel transcription
    ipcMain.handle('cancel-transcription', async (event, jobId: string) => {
      try {
        console.log('=== CANCEL TRANSCRIPTION REQUESTED ===');
        console.log('Cancel requested for job ID:', jobId);
        
        const job = this.transcriptionJobs.get(jobId);
        if (!job) {
          console.error('Cancel failed: Job not found:', jobId);
          return { success: false, error: 'Job not found' };
        }

        console.log('Found job to cancel:', { id: job.id, status: job.status, progress: job.progress });

        // Update job status
        job.status = 'error';
        job.error = 'Cancelled by user';
        job.progress = 0;

        console.log('Updated job status to cancelled');

        // Send cancellation event to renderer
        this.mainWindow?.webContents.send('transcription-error', {
          ...this.serializeJob(job),
          errorData: {
            message: 'Transcription cancelled by user',
            code: 'USER_CANCELLED',
            operation: 'transcription'
          }
        });

        console.log('Sent cancellation event to renderer');
        console.log('=== CANCEL TRANSCRIPTION COMPLETED ===');

        return { success: true };
      } catch (error) {
        console.error('Error cancelling transcription:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to cancel transcription' 
        };
      }
    });

    // Audio file handling
    ipcMain.handle('read-audio-file', async (event, filePath: string) => {
      try {
        console.log('IPC: read-audio-file requested for:', filePath);
        
        if (!fs.existsSync(filePath)) {
          console.error('Audio file does not exist at path:', filePath);
          throw new Error(`Audio file does not exist: ${filePath}`);
        }
        
        const stats = await fs.promises.stat(filePath);
        console.log('Audio file found, size:', stats.size, 'bytes');
        
        const audioBuffer = await fs.promises.readFile(filePath);
        console.log('Audio file read successfully, buffer size:', audioBuffer.length);
        return audioBuffer.buffer;
      } catch (error) {
        console.error('Error reading audio file:', error);
        throw error;
      }
    });

    // API key management
    ipcMain.handle('save-api-keys', async (event, apiKeys: { [service: string]: string }) => {
      try {
        const encryptedKeys = this.encryptApiKeys(apiKeys);
        await fs.promises.writeFile(this.apiKeysPath, encryptedKeys);
        return { success: true };
      } catch (error) {
        console.error('Error saving API keys:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to save API keys' 
        };
      }
    });

    ipcMain.handle('get-api-keys', async (event) => {
      try {
        console.log('DEBUG: get-api-keys called');
        console.log('DEBUG: API keys path:', this.apiKeysPath);
        
        if (!fs.existsSync(this.apiKeysPath)) {
          console.log('DEBUG: API keys file does not exist');
          return {}; // Return empty object if no keys file exists
        }
        
        console.log('DEBUG: Reading encrypted API keys file...');
        const encryptedData = await fs.promises.readFile(this.apiKeysPath, 'utf8');
        console.log('DEBUG: Encrypted data length:', encryptedData.length);
        
        const decryptedKeys = this.decryptApiKeys(encryptedData);
        console.log('DEBUG: Decrypted keys count:', Object.keys(decryptedKeys).length);
        return decryptedKeys;
      } catch (error) {
        console.error('Error getting API keys:', error);
        return {}; // Return empty object on error
      }
    });

    // REMOVED - Legacy project handlers causing conflicts

    // Test cloud API connections
    ipcMain.handle('test-cloud-connection', async (event, provider) => {
      try {
        console.log('Testing cloud connection for provider:', provider);
        
        // Get API keys
        const encryptedKeys = fs.existsSync(this.apiKeysPath) 
          ? await fs.promises.readFile(this.apiKeysPath, 'utf8')
          : '{}';
        const apiKeys = encryptedKeys === '{}' ? {} : this.decryptApiKeys(encryptedKeys);

        if (!apiKeys[provider]) {
          return { success: false, error: `API key for ${provider} not configured` };
        }

        const cloudService = new SimpleCloudTranscriptionService(apiKeys);
        
        let result = false;
        switch (provider) {
          case 'openai':
            result = await cloudService.testOpenAIConnection();
            break;
          case 'assemblyai':
            result = await cloudService.testAssemblyAIConnection();
            break;
          default:
            return { success: false, error: `Unknown provider: ${provider}` };
        }
        
        return { success: result, connected: result };
      } catch (error) {
        console.error('Cloud connection test failed:', error);
        return { 
          success: false, 
          connected: false,
          error: error instanceof Error ? error.message : 'Connection test failed' 
        };
      }
    });

    // Project file system handlers
    ipcMain.handle('dialog:openFile', async (event, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, options);
      return result;
    });

    ipcMain.handle('dialog:saveFile', async (event, options) => {
      const result = await dialog.showSaveDialog(this.mainWindow!, options);
      return result;
    });

    ipcMain.handle('select-directory', async (event) => {
      try {
        if (!this.mainWindow) {
          return { success: false, error: 'Main window not available' };
        }

        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ['openDirectory', 'createDirectory'],
          title: 'Select Project Location'
        });

        if (result.canceled) {
          return { success: false, cancelled: true };
        }

        if (result.filePaths && result.filePaths.length > 0) {
          return { 
            success: true, 
            filePath: result.filePaths[0],
            cancelled: false 
          };
        }

        return { success: false, error: 'No directory selected' };
      } catch (error) {
        console.error('Error in select-directory:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to select directory' 
        };
      }
    });

    ipcMain.handle('project:save', async (event, projectData, filePath) => {
      try {
        await ProjectFileService.saveProject(projectData, filePath);
        return { success: true };
      } catch (error) {
        console.error('Failed to save project:', error);
        throw error;
      }
    });

    ipcMain.handle('project:load', async (event, filePath) => {
      try {
        const projectData = await ProjectFileService.loadProject(filePath);
        return projectData;
      } catch (error) {
        console.error('Failed to load project:', error);
        throw error;
      }
    });

    // Check if a file exists
    ipcMain.handle('checkFileExists', async (event, filePath) => {
      try {
        return fs.existsSync(filePath);
      } catch (error) {
        console.error('Error checking file existence:', error);
        return false;
      }
    });
    
    // Convenience handlers for project file dialogs
    ipcMain.handle('openProjectDialog', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        title: 'Open Transcription Project',
        filters: [
          { name: 'Transcription Projects', extensions: ['transcript'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      return result;
    });

    ipcMain.handle('saveProjectDialog', async (event, defaultName) => {
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        title: 'Save Transcription Project',
        defaultPath: defaultName || 'Untitled.transcript',
        filters: [
          { name: 'Transcription Projects', extensions: ['transcript'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      return result;
    });

    // Audio analysis handlers
    ipcMain.handle('analyze-audio', async (event, filePath: string) => {
      try {
        console.log('Analyzing audio file:', filePath);
        const analysis = await this.audioAnalyzer.analyze(filePath);
        console.log('Audio analysis complete:', analysis);
        return analysis;
      } catch (error) {
        console.error('Audio analysis failed:', error);
        throw new Error(`Failed to analyze audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('get-audio-recommendation', async (event, analysis: any) => {
      try {
        const recommendation = this.audioAnalyzer.generateRecommendation(analysis);
        console.log('Generated recommendation:', recommendation);
        return recommendation;
      } catch (error) {
        console.error('Failed to generate recommendation:', error);
        throw new Error(`Failed to generate recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('get-smart-project-settings', async (event, analysis: any) => {
      try {
        const settings = this.audioAnalyzer.determineProjectSettings(analysis);
        console.log('Generated smart settings:', settings);
        return settings;
      } catch (error) {
        console.error('Failed to generate smart settings:', error);
        throw new Error(`Failed to generate settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('convert-audio', async (event, inputPath: string, options: any) => {
      try {
        console.log('Converting audio:', inputPath, options);
        
        // Progress callback to send updates to renderer
        const onProgress = (percent: number, status: string) => {
          this.mainWindow?.webContents.send('audio-conversion-progress', {
            percent,
            status
          });
        };

        let result;
        if (options.action === 'convert-to-flac') {
          result = await this.audioConverter.convertToFLAC(inputPath, {
            targetSampleRate: options.targetSampleRate,
            targetBitDepth: options.targetBitDepth,
            onProgress
          });
        } else if (options.action === 'resample') {
          result = await this.audioConverter.resampleAudio(
            inputPath,
            options.targetSampleRate,
            options.targetBitDepth,
            'flac',
            { onProgress }
          );
        } else {
          // Keep original
          result = await this.audioConverter.copyOriginal(inputPath);
        }

        console.log('Audio conversion complete:', result);
        return result;
      } catch (error) {
        console.error('Audio conversion failed:', error);
        throw new Error(`Failed to convert audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // User preferences management
    ipcMain.handle('load-user-preferences', async (event) => {
      try {
        const preferences = await this.userPreferences.loadPreferences();
        console.log('Loaded user preferences:', preferences);
        return preferences;
      } catch (error) {
        console.error('Failed to load user preferences:', error);
        throw new Error(`Failed to load preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('save-user-preferences', async (event, preferences: any) => {
      try {
        await this.userPreferences.savePreferences(preferences);
        console.log('Saved user preferences:', preferences);
        return { success: true };
      } catch (error) {
        console.error('Failed to save user preferences:', error);
        throw new Error(`Failed to save preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('reset-user-preferences', async (event) => {
      try {
        const defaultPreferences = await this.userPreferences.resetToDefaults();
        console.log('Reset user preferences to defaults:', defaultPreferences);
        return defaultPreferences;
      } catch (error) {
        console.error('Failed to reset user preferences:', error);
        throw new Error(`Failed to reset preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('get-transcription-service', async (event, preferences: any) => {
      try {
        const service = this.userPreferences.getTranscriptionService(preferences);
        console.log('Generated transcription service:', service);
        return service;
      } catch (error) {
        console.error('Failed to get transcription service:', error);
        throw new Error(`Failed to get transcription service: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // REMOVED - Duplicate handlers, using clean project:save and project:load instead
  }

  private serializeJob(job: TranscriptionJob): any {
    // Create a clean serializable version of the job
    const serialized = {
      id: job.id,
      filePath: job.filePath,
      fileName: job.fileName,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      speakerNames: job.speakerNames,
      speakerMerges: job.speakerMerges
    };
    
    console.log('DEBUG: Serializing job:', job);
    console.log('DEBUG: Serialized result:', serialized);
    console.log('DEBUG: Serialized JSON:', JSON.stringify(serialized));
    
    return serialized;
  }

  private generateEncryptionKey(): string {
    // Generate a machine-specific key (this is a simple approach)
    // In production, you might want to use more sophisticated key derivation
    const machineId = process.platform + app.getVersion() + app.getPath('exe');
    return crypto.createHash('sha256').update(machineId).digest('hex'); // Full 64 character hex = 32 bytes
  }

  private encryptApiKeys(apiKeys: { [service: string]: string }): string {
    try {
      const text = JSON.stringify(apiKeys);
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex').subarray(0, 32); // Ensure exactly 32 bytes
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error('Failed to encrypt API keys');
    }
  }

  private decryptApiKeys(encryptedData: string): { [service: string]: string } {
    try {
      const algorithm = 'aes-256-cbc';
      const parts = encryptedData.split(':');
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const key = Buffer.from(this.encryptionKey, 'hex').subarray(0, 32); // Ensure exactly 32 bytes
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      
      console.log('DEBUG: Decrypting API keys...');
      console.log('DEBUG: Encryption key:', this.encryptionKey.substring(0, 10) + '...');
      console.log('DEBUG: Machine ID components:', {
        platform: process.platform,
        version: app.getVersion(),
        exePath: app.getPath('exe')
      });
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const result = JSON.parse(decrypted);
      console.log('DEBUG: Successfully decrypted keys:', Object.keys(result));
      return result;
    } catch (error) {
      console.error('Decryption error:', error);
      console.error('DEBUG: Failed to decrypt. Machine ID components:', {
        platform: process.platform,
        version: app.getVersion(),
        exePath: app.getPath('exe')
      });
      return {}; // Return empty object if decryption fails
    }
  }

  private async runCloudTranscription(jobId: string, filePath: string, modelSize: string): Promise<void> {
    console.log('DEBUG: runCloudTranscription called with jobId:', jobId);
    this.mainWindow?.webContents.send('debug-log', `Main: runCloudTranscription called with jobId ${jobId}`);
    console.log('DEBUG: Available job IDs:', Array.from(this.transcriptionJobs.keys()));
    this.mainWindow?.webContents.send('debug-log', `Main: Available job IDs: ${Array.from(this.transcriptionJobs.keys()).join(', ')}`);
    const job = this.transcriptionJobs.get(jobId);
    console.log('DEBUG: Found job:', job);
    this.mainWindow?.webContents.send('debug-log', `Main: Found job: ${job ? 'YES' : 'NO'}`);
    if (!job) {
      console.error('ERROR: Job not found for ID:', jobId);
      this.mainWindow?.webContents.send('debug-log', `Main: ERROR - Job not found for ID ${jobId}`);
      return;
    }

    // Extract provider before try block so it's available in catch
    const provider = modelSize.split('-')[1]; // Extract provider from 'cloud-openai'

    try {
      console.log('Cloud transcription starting for job:', jobId);
      
      // Get API keys
      const encryptedKeys = fs.existsSync(this.apiKeysPath) 
        ? await fs.promises.readFile(this.apiKeysPath, 'utf8')
        : '{}';
      const apiKeys = encryptedKeys === '{}' ? {} : this.decryptApiKeys(encryptedKeys);
      console.log('Provider:', provider);
      console.log('API keys available:', Object.keys(apiKeys));
      console.log('OpenAI key exists:', !!apiKeys.openai);
      console.log('OpenAI key length:', apiKeys.openai?.length || 0);
      this.mainWindow?.webContents.send('debug-log', `Main: API keys loaded: ${Object.keys(apiKeys).join(', ')}`);
      
      if (!apiKeys[provider]) {
        const error = new Error(`API key for ${provider} not configured`);
        (error as any).code = 'INVALID_API_KEY';
        throw error;
      }

      job.progress = 20;
      console.log('DEBUG: Sending progress event (cloud 20%):', job);
      
      // Create a clean serializable object
      const progressData = {
        id: job.id,
        filePath: job.filePath,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        error: job.error
      };
      
      console.log('DEBUG: Serializable progress data:', JSON.stringify(progressData));
      this.mainWindow?.webContents.send('debug-log', `Main: Sending progress event with job id ${job.id}`);
      
      // Test with a simple object first
      const testData = { test: 'hello', id: job.id };
      console.log('DEBUG: Sending test data:', testData);
      this.mainWindow?.webContents.send('debug-log', `Main: Test data: ${JSON.stringify(testData)}`);
      
      // Try sending the serialized job
      const serializedJob = this.serializeJob(job);
      this.mainWindow?.webContents.send('debug-log', `Main: Serialized job: ${JSON.stringify(serializedJob)}`);
      this.mainWindow?.webContents.send('transcription-progress', serializedJob);

      // Create cloud transcription service instance
      const cloudService = new SimpleCloudTranscriptionService(apiKeys);
      
      const progressCallback = (progress: { progress: number; status: string }) => {
        console.log('Progress update:', progress);
        job.progress = progress.progress;
        const progressEvent = {
          ...job,
          progress: progress.progress,
          status: progress.status
        };
        console.log('DEBUG: Sending progress event (cloud callback):', progressEvent);
        this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));
      };

      let result;
      console.log('=== CALLING TRANSCRIPTION SERVICE ===');
      this.mainWindow?.webContents.send('debug-log', `Main: Calling ${provider} transcription service`);
      
      switch (provider) {
        case 'openai':
          console.log('Using OpenAI transcription with file:', filePath);
          this.mainWindow?.webContents.send('debug-log', `Main: Starting OpenAI transcription`);
          try {
            result = await cloudService.transcribeWithOpenAI(filePath, progressCallback);
            console.log('OpenAI transcription call completed. Result:', {
              hasResult: !!result,
              resultType: typeof result,
              keys: result ? Object.keys(result) : []
            });
            this.mainWindow?.webContents.send('debug-log', `Main: OpenAI call completed successfully`);
          } catch (openaiError) {
            console.error('OpenAI transcription failed:', openaiError);
            this.mainWindow?.webContents.send('debug-log', `Main: OpenAI failed: ${openaiError}`);
            throw openaiError;
          }
          break;
        case 'assemblyai':
          console.log('Using AssemblyAI transcription');
          this.mainWindow?.webContents.send('debug-log', `Main: Starting AssemblyAI transcription`);
          result = await cloudService.transcribeWithAssemblyAI(filePath, progressCallback);
          break;
        case 'revai':
          console.log('Using Rev.ai transcription (simulated)');
          this.mainWindow?.webContents.send('debug-log', `Main: Starting Rev.ai simulation`);
          // For now, use simulation for Rev.ai since we don't have the full implementation
          result = await this.simulateCloudTranscription(filePath, provider, apiKeys[provider]);
          break;
        default:
          throw new Error(`Unknown cloud provider: ${provider}`);
      }

      console.log('=== TRANSCRIPTION SERVICE COMPLETED ===');
      console.log('Cloud transcription completed:', {
        hasResult: !!result,
        resultType: typeof result,
        segmentCount: result?.segments?.length || 0,
        firstSegmentText: result?.segments?.[0]?.text || 'No text',
        resultKeys: result ? Object.keys(result) : []
      });
      this.mainWindow?.webContents.send('debug-log', `Main: Transcription completed with ${result?.segments?.length || 0} segments`);

      if (!result) {
        throw new Error('Transcription service returned empty result');
      }

      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      console.log('=== SENDING COMPLETION EVENT ===');
      console.log('DEBUG: Sending completion event (cloud). Job status:', job.status, 'Progress:', job.progress);
      this.mainWindow?.webContents.send('debug-log', `Main: Sending completion event to renderer`);
      this.mainWindow?.webContents.send('transcription-complete', this.serializeJob(job));
      console.log('=== COMPLETION EVENT SENT ===');

    } catch (error: any) {
      console.error('Cloud transcription failed:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      job.status = 'error';
      job.progress = 0;
      
      // Structure the error for frontend processing
      const errorData = {
        message: error instanceof Error ? error.message : 'Cloud transcription failed',
        code: error.code || 'TRANSCRIPTION_FAILED',
        operation: 'transcription',
        provider: provider,
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
      
      job.error = errorData.message;
      
      // Send structured error to frontend for proper handling
      this.mainWindow?.webContents.send('transcription-error', {
        ...this.serializeJob(job),
        errorData
      });
    }
  }

  private async simulateCloudTranscription(filePath: string, provider: string, apiKey: string): Promise<any> {
    // This is a placeholder for cloud transcription
    // In a real implementation, this would call the actual cloud APIs
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 'success',
          segments: [
            {
              id: 0,
              start: 0.0,
              end: 5.0,
              text: `This is a simulated transcription from ${provider} using cloud API.`,
              words: [
                { start: 0.0, end: 0.5, word: "This", score: 0.99 },
                { start: 0.5, end: 0.7, word: "is", score: 0.98 },
                { start: 0.7, end: 0.9, word: "a", score: 0.97 },
                { start: 0.9, end: 1.5, word: "simulated", score: 0.96 },
                { start: 1.5, end: 2.2, word: "transcription", score: 0.95 }
              ],
              speaker: 'SPEAKER_00'
            }
          ],
          language: 'en',
          word_segments: []
        });
      }, 3000); // Simulate 3 second cloud processing time
    });
  }

  private async runTranscription(jobId: string, filePath: string, modelSize: string): Promise<void> {
    console.log('DEBUG: runTranscription called with:', { jobId, filePath, modelSize });
    const job = this.transcriptionJobs.get(jobId);
    if (!job) {
      console.log('ERROR: Job not found for ID:', jobId);
      return;
    }

    try {
      console.log('DEBUG: Starting transcription process for job:', job);
      job.status = 'processing';
      job.progress = 10;
      this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));

      // Check if this is a cloud transcription
      if (modelSize.startsWith('cloud-')) {
        await this.runCloudTranscription(jobId, filePath, modelSize);
        return;
      }

      // Handle local transcription
      const whisperServicePath = path.join(__dirname, '../../../whisper_service.py');
      
      console.log('Main process __dirname:', __dirname);
      console.log('Whisper service path:', whisperServicePath);
      console.log('File exists:', fs.existsSync(whisperServicePath));
      
      console.log('DEBUG: Spawning Python process with args:', [whisperServicePath, 'transcribe', filePath, modelSize, 'en']);
      const pythonProcess = spawn('python3', [whisperServicePath, 'transcribe', filePath, modelSize, 'en'], {
        env: process.env,
      });
      console.log('DEBUG: Python process spawned with PID:', pythonProcess.pid);
      
      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        job.progress = Math.min(job.progress + 10, 90);
        this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));
      });

      pythonProcess.stderr.on('data', (data) => {
        const stderrData = data.toString();
        errorOutput += stderrData;
        
        // Parse progress updates from stderr (format: PROGRESS:XX)
        const progressMatch = stderrData.match(/PROGRESS:(\d+)/);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1]);
          job.progress = progress;
          this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));
          console.log(`Transcription progress: ${progress}%`);
        }
      });

      pythonProcess.on('close', (code) => {
        console.log('Python process closed with code:', code);
        console.log('Raw output:', output);
        console.log('Raw error output:', errorOutput);
        
        if (code === 0) {
          try {
            // Try to extract JSON from the output (may have extra logging)
            let jsonResult = output.trim();
            
            // If output starts with non-JSON content, try to find the JSON part
            const jsonStart = jsonResult.indexOf('{');
            const jsonEnd = jsonResult.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              jsonResult = jsonResult.substring(jsonStart, jsonEnd + 1);
            }
            
            const result = JSON.parse(jsonResult);
            
            if (result.status === 'success') {
              job.status = 'completed';
              job.progress = 100;
              job.result = result;
              this.mainWindow?.webContents.send('transcription-complete', this.serializeJob(job));
            } else {
              job.status = 'error';
              job.error = result.message || 'Transcription failed with unknown error';
              this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
            }
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            job.status = 'error';
            job.error = 'Failed to parse transcription result. Raw output: ' + output.substring(0, 300);
            this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
          }
        } else {
          job.status = 'error';
          let errorMessage = 'Transcription process failed';
          
          const combinedError = errorOutput + output; // Sometimes errors go to stdout
          
          if (combinedError.includes('ModuleNotFoundError')) {
            errorMessage = 'WhisperX is not properly installed. Please run: pip3 install whisperx';
          } else if (combinedError.includes('FileNotFoundError')) {
            errorMessage = 'Audio file not found or cannot be accessed';
          } else if (combinedError.includes('OutOfMemoryError') || combinedError.includes('CUDA out of memory')) {
            errorMessage = 'Out of memory. Try using a smaller model size or a shorter audio file';
          } else if (combinedError.includes('UnsupportedFormat')) {
            errorMessage = 'Unsupported audio format. Please convert to WAV, MP3, or another supported format';
          } else if (combinedError) {
            errorMessage = combinedError.substring(0, 300);
          }
          
          job.error = errorMessage;
          this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
        }
      });

    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
    }
  }
}

// Initialize the app
new App();