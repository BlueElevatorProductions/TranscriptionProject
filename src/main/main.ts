import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { SimpleCloudTranscriptionService } from './services/SimpleCloudTranscriptionService';
import { ProjectFileManager } from './services/ProjectFileManager';
import { ProjectFileService } from './services/ProjectFileService';

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

  constructor() {
    // Initialize encryption key (derived from machine-specific info)
    this.encryptionKey = this.generateEncryptionKey();
    
    // Set API keys storage path
    this.apiKeysPath = path.join(app.getPath('userData'), 'api-keys.enc');
    
    // Initialize project manager
    this.projectManager = new ProjectFileManager();
    
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
      if (process.platform !== 'darwin') {
        app.quit();
      }
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
      titleBarStyle: 'default',
      movable: true, // Explicitly enable window movement
      resizable: true, // Ensure resizing is enabled
      show: false, // Don't show until ready-to-show
    });

    // Load the app
    if (isDev()) {
      this.mainWindow.loadURL('http://localhost:5174');
      // Open DevTools in development
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

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

    // Audio file handling
    ipcMain.handle('read-audio-file', async (event, filePath: string) => {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error('Audio file does not exist');
        }
        
        const audioBuffer = await fs.promises.readFile(filePath);
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

    // Project file management
    ipcMain.handle('save-project', async (event, projectData, savePath, options) => {
      try {
        console.log('Saving project:', { savePath, hasAudioFile: !!projectData.audioFile });
        return await this.projectManager.saveProject(projectData, savePath, options);
      } catch (error) {
        console.error('Save project failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to save project' 
        };
      }
    });

    ipcMain.handle('load-project', async (event, projectPath) => {
      try {
        console.log('Loading project:', projectPath);
        return await this.projectManager.loadProject(projectPath);
      } catch (error) {
        console.error('Load project failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to load project' 
        };
      }
    });

    // Show save dialog for projects
    ipcMain.handle('show-save-project-dialog', async (event, options = {}) => {
      try {
        if (!this.mainWindow) {
          return { success: false, error: 'Main window not available' };
        }
        
        const result = await dialog.showSaveDialog(this.mainWindow, {
          title: 'Save Transcription Project',
          defaultPath: options.defaultName || 'Untitled.transcription',
          filters: [
            { name: 'Transcription Projects', extensions: ['transcription'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['createDirectory']
        });

        return { 
          success: true, 
          canceled: result.canceled, 
          filePath: result.filePath 
        };
      } catch (error) {
        console.error('Save dialog error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Dialog error' 
        };
      }
    });

    // Show open dialog for projects
    ipcMain.handle('show-open-project-dialog', async (event) => {
      try {
        if (!this.mainWindow) {
          return { success: false, error: 'Main window not available' };
        }
        
        const result = await dialog.showOpenDialog(this.mainWindow, {
          title: 'Open Transcription Project',
          filters: [
            { name: 'Transcription Projects', extensions: ['transcription'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });

        return { 
          success: true, 
          canceled: result.canceled, 
          filePaths: result.filePaths 
        };
      } catch (error) {
        console.error('Open dialog error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Dialog error' 
        };
      }
    });

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

    // Convenience handlers for project file dialogs
    ipcMain.handle('openProjectDialog', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        title: 'Import Transcription Project',
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

    ipcMain.handle('loadProject', async (event, filePath) => {
      try {
        const projectData = await ProjectFileService.loadProject(filePath);
        return projectData;
      } catch (error) {
        console.error('Failed to load project:', error);
        throw error;
      }
    });

    ipcMain.handle('saveProject', async (event, projectData, filePath) => {
      try {
        await ProjectFileService.saveProject(projectData, filePath);
        return { success: true };
      } catch (error) {
        console.error('Failed to save project:', error);
        throw error;
      }
    });
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

    try {
      console.log('Cloud transcription starting for job:', jobId);
      
      // Get API keys
      const encryptedKeys = fs.existsSync(this.apiKeysPath) 
        ? await fs.promises.readFile(this.apiKeysPath, 'utf8')
        : '{}';
      const apiKeys = encryptedKeys === '{}' ? {} : this.decryptApiKeys(encryptedKeys);

      const provider = modelSize.split('-')[1]; // Extract provider from 'cloud-openai'
      console.log('Provider:', provider);
      console.log('API keys available:', Object.keys(apiKeys));
      console.log('OpenAI key exists:', !!apiKeys.openai);
      console.log('OpenAI key length:', apiKeys.openai?.length || 0);
      this.mainWindow?.webContents.send('debug-log', `Main: API keys loaded: ${Object.keys(apiKeys).join(', ')}`);
      
      if (!apiKeys[provider]) {
        throw new Error(`API key for ${provider} not configured`);
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
      switch (provider) {
        case 'openai':
          console.log('Using OpenAI transcription');
          result = await cloudService.transcribeWithOpenAI(filePath, progressCallback);
          break;
        case 'assemblyai':
          console.log('Using AssemblyAI transcription');
          result = await cloudService.transcribeWithAssemblyAI(filePath, progressCallback);
          break;
        case 'revai':
          console.log('Using Rev.ai transcription (simulated)');
          // For now, use simulation for Rev.ai since we don't have the full implementation
          result = await this.simulateCloudTranscription(filePath, provider, apiKeys[provider]);
          break;
        default:
          throw new Error(`Unknown cloud provider: ${provider}`);
      }

      console.log('Cloud transcription completed:', {
        hasResult: !!result,
        segmentCount: result?.segments?.length || 0,
        firstSegmentText: result?.segments?.[0]?.text || 'No text'
      });

      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      console.log('DEBUG: Sending completion event (cloud):', job);
      this.mainWindow?.webContents.send('transcription-complete', this.serializeJob(job));

    } catch (error) {
      console.error('Cloud transcription failed:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Cloud transcription failed';
      this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
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