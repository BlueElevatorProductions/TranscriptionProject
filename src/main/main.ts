import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

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
}

class App {
  private mainWindow: BrowserWindow | null = null;
  private transcriptionJobs: Map<string, TranscriptionJob> = new Map();

  constructor() {
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
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false, // Don't show until ready-to-show
    });

    // Load the app
    if (isDev()) {
      this.mainWindow.loadURL('http://localhost:5173');
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

      // Validate model size
      const validModelSizes = ['tiny', 'base', 'small', 'medium', 'large'];
      if (!validModelSizes.includes(modelSize)) {
        return { success: false, error: `Invalid model size: ${modelSize}` };
      }

      const jobId = Date.now().toString();
      const fileName = path.basename(filePath);
      
      const job: TranscriptionJob = {
        id: jobId,
        filePath,
        fileName,
        status: 'pending',
        progress: 0
      };

      this.transcriptionJobs.set(jobId, job);

      // Start transcription process
      this.runTranscription(jobId, filePath, modelSize);

      return { success: true, jobId };
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
  }

  private async runTranscription(jobId: string, filePath: string, modelSize: string): Promise<void> {
    const job = this.transcriptionJobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      job.progress = 10;
      this.mainWindow?.webContents.send('transcription-progress', job);

      const whisperServicePath = path.join(__dirname, '../../../whisper_service.py');
      
      console.log('Main process __dirname:', __dirname);
      console.log('Whisper service path:', whisperServicePath);
      console.log('File exists:', fs.existsSync(whisperServicePath));
      
      const pythonProcess = spawn('python3', [whisperServicePath, 'transcribe', filePath, modelSize]);
      
      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        job.progress = Math.min(job.progress + 10, 90);
        this.mainWindow?.webContents.send('transcription-progress', job);
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
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
            } else {
              job.status = 'error';
              job.error = result.message || 'Transcription failed with unknown error';
            }
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            job.status = 'error';
            job.error = 'Failed to parse transcription result. Raw output: ' + output.substring(0, 300);
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
        }

        this.mainWindow?.webContents.send('transcription-complete', job);
      });

    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.mainWindow?.webContents.send('transcription-complete', job);
    }
  }
}

// Initialize the app
new App();