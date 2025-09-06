import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { app } from 'electron';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';

interface AudioMetadata {
  originalPath: string;
  originalName: string;
  originalFormat: string;
  originalSampleRate: number;
  originalBitDepth?: number;
  originalSize: number;
  embeddedFormat: string;
  embeddedSize: number;
  duration: number;
  channels: number;
  compressionRatio: number;
  wasConverted: boolean;
  conversionMethod?: string;
}

interface ProjectData {
  project: any;
  transcription: any;
  speakers: any;
  clips: any;
  history?: any;
  preferences?: any;
  audioMetadata?: AudioMetadata;
}

export class ProjectFileService {
  private static readonly CURRENT_VERSION = '1.0';
  private static readonly SUPPORTED_VERSIONS = ['1.0', '1.0.0'];

  static async saveProject(
    projectData: ProjectData, 
    filePath: string,
    onProgress?: (percent: number, status: string) => void
  ): Promise<void> {
    try {
      onProgress?.(0, 'Initializing project save...');
      
      const zip = new JSZip();
      
      // Prepare sanitized project copy (avoid persisting temp paths)
      const sanitizedProject: any = JSON.parse(JSON.stringify(projectData.project || {}));
      if (!sanitizedProject.version) sanitizedProject.version = this.CURRENT_VERSION;
      if (sanitizedProject?.audio) {
        delete sanitizedProject.audio?.tempDirectory;
        delete sanitizedProject.audio?.extractedPath;
        delete sanitizedProject.audio?.processedFile;
      }
      
      // Add main project file (will be overwritten later after audio embedding if needed)
      zip.file('project.json', JSON.stringify(sanitizedProject, null, 2));
      onProgress?.(5, 'Saving project metadata...');
      
      // Add transcription data
      zip.file('transcription.json', JSON.stringify(projectData.transcription, null, 2));
      onProgress?.(10, 'Saving transcription data...');
      
      // Add metadata files
      const metadataFolder = zip.folder('metadata');
      if (metadataFolder) {
        metadataFolder.file('speakers.json', JSON.stringify(projectData.speakers, null, 2));
        metadataFolder.file('clips.json', JSON.stringify(projectData.clips, null, 2));
        
        if (projectData.history) {
          metadataFolder.file('history.json', JSON.stringify(projectData.history, null, 2));
        }
        
        if (projectData.preferences) {
          metadataFolder.file('preferences.json', JSON.stringify(projectData.preferences, null, 2));
        }
        
        // Save audio metadata if available
        if (projectData.audioMetadata) {
          metadataFolder.file('audio.json', JSON.stringify(projectData.audioMetadata, null, 2));
        }
      }
      onProgress?.(15, 'Saving metadata files...');
      
      // Embed audio file if available
      const audioFolder = zip.folder('audio');
      if (audioFolder && projectData.project.audio?.embeddedPath) {
        try {
          onProgress?.(20, 'Embedding audio file...');
          console.log('Embedding audio file:', projectData.project.audio.embeddedPath);
          
          // Check if embedded audio file exists
          if (!fs.existsSync(projectData.project.audio.embeddedPath)) {
            throw new Error(`Audio file not found: ${projectData.project.audio.embeddedPath}`);
          }
          
          const audioStats = fs.statSync(projectData.project.audio.embeddedPath);
          const inferredExt = path.extname(projectData.project.audio.embeddedPath).slice(1);
          const audioFormat = projectData.audioMetadata?.embeddedFormat || inferredExt || 'flac';
          
          // Determine audio file name based on format
          const audioFileName = `audio.${audioFormat}`;
          
          console.log(`Embedding ${audioFileName} (${this.formatBytes(audioStats.size)})`);
          
          // Read audio file into buffer
          // For very large files, we could implement chunked reading, but for now use direct buffer approach
          console.log('Loading audio file into memory...');
          const audioBuffer = await fs.promises.readFile(projectData.project.audio.embeddedPath);
          
          // Add to ZIP without additional compression (FLAC is already compressed)
          audioFolder.file(audioFileName, audioBuffer, {
            compression: 'STORE' // No compression since FLAC is already compressed
          });
          
          onProgress?.(70, 'Audio file embedded successfully');
          console.log('Audio file embedded successfully');
          
          // Update sanitized project to point to package-relative path
          if (!sanitizedProject.audio) sanitizedProject.audio = {};
          sanitizedProject.audio.embedded = true;
          sanitizedProject.audio.embeddedPath = `audio/${audioFileName}`;

        } catch (audioError: any) {
          console.error('Failed to embed audio file:', audioError);
          // Don't fail the entire save operation, just warn
          console.warn('Project will be saved without embedded audio');
          
          // Save audio reference as fallback
          audioFolder.file('audio_reference.json', JSON.stringify({
            originalPath: projectData.project.audio.originalFile || projectData.project.audio.embeddedPath,
            originalName: projectData.project.audio.originalName,
            error: audioError.message,
            note: "Audio embedding failed. File reference preserved."
          }, null, 2));
          
          if (!sanitizedProject.audio) sanitizedProject.audio = {};
          sanitizedProject.audio.embedded = false;
          sanitizedProject.audio.embeddedPath = null;
        }
      } else if (audioFolder && projectData.project.audio?.originalFile) {
        // Fallback: save reference for external audio files
        console.log('Saving audio reference (external file)');
        audioFolder.file('audio_reference.json', JSON.stringify({
          originalPath: projectData.project.audio.originalFile,
          originalName: projectData.project.audio.originalName,
          note: "External audio file reference. Audio not embedded in project."
        }, null, 2));
        
        if (!sanitizedProject.audio) sanitizedProject.audio = {};
        sanitizedProject.audio.embedded = false;
        sanitizedProject.audio.embeddedPath = null;
      }
      
      // Overwrite project.json with final sanitized content (stable paths)
      zip.file('project.json', JSON.stringify(sanitizedProject, null, 2));

      onProgress?.(80, 'Generating project package...');
      
      // Generate ZIP with progress tracking
      console.log('Generating ZIP package...');
      const content = await zip.generateAsync({ 
        type: 'nodebuffer', 
        compression: 'DEFLATE',
        compressionOptions: { 
          level: 1 // Lower compression for speed since FLAC is already compressed
        }
      }, (metadata) => {
        // Progress callback for ZIP generation
        const zipProgress = 80 + (metadata.percent * 0.15); // Use 15% for ZIP generation
        onProgress?.(Math.round(zipProgress), 'Compressing project files...');
      });
      
      onProgress?.(95, 'Writing project file...');
      
      // Write to disk
      await fs.promises.writeFile(filePath, content);
      
      onProgress?.(100, 'Project saved successfully');
      console.log(`Project saved successfully to: ${filePath}`);
      console.log(`Final file size: ${this.formatBytes(content.length)}`);
      
    } catch (error: any) {
      console.error('Error saving project:', error);
      throw new Error(`Failed to save project: ${error.message}`);
    }
  }

  static async loadProject(filePath: string): Promise<ProjectData> {
    try {
      console.log(`Loading project from: ${filePath}`);
      
      // Read zip file
      const zipData = await fs.promises.readFile(filePath);
      const zip = await JSZip.loadAsync(zipData);
      
      // Validate project structure
      await this.validateProjectStructure(zip);
      
      // Extract project data
      const projectJson = await zip.file('project.json')?.async('text');
      const transcriptionJson = await zip.file('transcription.json')?.async('text');
      const speakersJson = await zip.file('metadata/speakers.json')?.async('text');
      const clipsJson = await zip.file('metadata/clips.json')?.async('text');
      const historyJson = await zip.file('metadata/history.json')?.async('text');
      const preferencesJson = await zip.file('metadata/preferences.json')?.async('text');
      const audioMetadataJson = await zip.file('metadata/audio.json')?.async('text');
      
      if (!projectJson || !transcriptionJson) {
        throw new Error('Invalid project file: missing required data files');
      }
      
      const projectData: ProjectData = {
        project: JSON.parse(projectJson),
        transcription: JSON.parse(transcriptionJson),
        speakers: speakersJson ? JSON.parse(speakersJson) : { speakers: {}, speakerMappings: {} },
        clips: clipsJson ? JSON.parse(clipsJson) : { clips: [] }
      };
      console.log('Loaded transcription segments:', Array.isArray(projectData.transcription?.segments) ? projectData.transcription.segments.length : 'N/A');
      
      // Add optional data
      if (historyJson) {
        projectData.history = JSON.parse(historyJson);
      }
      
      if (preferencesJson) {
        projectData.preferences = JSON.parse(preferencesJson);
      }
      
      if (audioMetadataJson) {
        projectData.audioMetadata = JSON.parse(audioMetadataJson);
        console.log('Audio metadata loaded:', projectData.audioMetadata);
      }
      
      // Extract embedded audio to temporary location
      await this.extractAudioFiles(zip, projectData);
      
      console.log(`Project loaded successfully from: ${filePath}`);
      console.log('Project audio data:', projectData.project.audio);
      console.log('Final transcription segment count:', Array.isArray(projectData.transcription?.segments) ? projectData.transcription.segments.length : 0);
      return projectData;
    } catch (error: any) {
      console.error('Error loading project:', error);
      throw new Error(`Failed to load project: ${error.message}`);
    }
  }

  private static async validateProjectStructure(zip: JSZip): Promise<void> {
    const requiredFiles = ['project.json', 'transcription.json'];
    
    for (const file of requiredFiles) {
      if (!zip.file(file)) {
        throw new Error(`Invalid project file: missing ${file}`);
      }
    }
    
    // Validate version compatibility
    const projectJson = await zip.file('project.json')?.async('text');
    if (projectJson) {
      const project = JSON.parse(projectJson);
      if (!this.SUPPORTED_VERSIONS.includes(project.version)) {
        throw new Error(`Unsupported project version: ${project.version}`);
      }
    }
  }

  private static async extractAudioFiles(zip: JSZip, projectData: ProjectData): Promise<void> {
    console.log('=== Extracting audio files from project ===');
    const tempDir = path.join(app.getPath('temp'), 'transcription_project_' + Date.now());
    console.log('Creating temp directory:', tempDir);
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Look for audio files in the audio folder
    const audioFolder = zip.folder('audio');
    if (!audioFolder) {
      console.log('No audio folder found in project');
      return;
    }
    
    // Check for embedded audio file
    const audioFiles = audioFolder.files;
    console.log('Audio folder files:', Object.keys(audioFiles));
    let extractedAudioPath: string | null = null;
    
    // Look for the main audio file (audio.flac, audio.mp3, etc.)
    for (const [fileName, file] of Object.entries(audioFiles)) {
      if (fileName.includes('/') && !fileName.endsWith('/')) {
        const baseName = path.basename(fileName);
        console.log('Checking file:', baseName);
        
        // Check if this is the main audio file (exclude metadata JSON files)
        if (baseName.startsWith('audio.') && !baseName.endsWith('.json')) {
          try {
            console.log(`Extracting embedded audio file: ${baseName}`);
            
            // Use streaming extraction for large files
            const audioBuffer = await file.async('nodebuffer');
            const tempAudioPath = path.join(tempDir, baseName);
            
            // Write audio file to temp directory
            await fs.promises.writeFile(tempAudioPath, audioBuffer);
            
            extractedAudioPath = tempAudioPath;
            console.log(`Extracted audio file to: ${tempAudioPath}`);
            console.log(`Extracted file size: ${this.formatBytes(audioBuffer.length)}`);
            
            // Verify the file was written correctly
            const verifyStats = await fs.promises.stat(tempAudioPath);
            console.log('Verified extracted file exists, size:', verifyStats.size);
            
            break; // Use the first audio file found
          } catch (audioError: any) {
            console.error('Could not extract audio file:', audioError);
          }
        }
      }
    }
    
    if (extractedAudioPath) {
      // Update project data with temporary path
      if (!projectData.project.audio) {
        projectData.project.audio = {} as any;
      }
      
      // Set both extractedPath and embeddedPath to the temp extraction location
      // to remain compatible with renderer code that expects embeddedPath.
      projectData.project.audio.extractedPath = extractedAudioPath;
      projectData.project.audio.embeddedPath = extractedAudioPath;
      projectData.project.audio.tempDirectory = tempDir;
      console.log('Set extractedPath and embeddedPath in project.audio:', extractedAudioPath);
      
      // Keep original metadata if available
      if (projectData.audioMetadata) {
        projectData.project.audio.originalName = projectData.audioMetadata.originalName;
        projectData.project.audio.originalFormat = projectData.audioMetadata.originalFormat;
        projectData.project.audio.embeddedFormat = projectData.audioMetadata.embeddedFormat;
        projectData.project.audio.duration = projectData.audioMetadata.duration;
        projectData.project.audio.channels = projectData.audioMetadata.channels;
      }
      
    } else {
      // Check for audio reference (fallback for external files)
      const audioRefFile = audioFolder.files['audio/audio_reference.json'];
      if (audioRefFile) {
        try {
          const refData = JSON.parse(await audioRefFile.async('text'));
          console.log('Found audio reference:', refData);
          
          // Check if the referenced file still exists
          if (refData.originalPath && fs.existsSync(refData.originalPath)) {
            projectData.project.audio = {
              originalFile: refData.originalPath,
              originalName: refData.originalName,
              isExternal: true
            };
            console.log('Using external audio file:', refData.originalPath);
          } else {
            console.warn('Referenced audio file not found:', refData.originalPath);
            projectData.project.audio = {
              error: 'Audio file not found',
              originalName: refData.originalName,
              originalPath: refData.originalPath
            };
          }
        } catch (error) {
          console.error('Failed to parse audio reference:', error);
        }
      } else {
        console.log('No audio files found in project');
      }
    }
  }

  static generateProjectId(): string {
    return 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  static createEmptyProject(audioFilePath: string, audioFileName: string): any {
    const fileStats = fs.statSync(audioFilePath);
    
    return {
      version: this.CURRENT_VERSION,
      projectId: this.generateProjectId(),
      name: path.basename(audioFileName, path.extname(audioFileName)),
      description: '',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      author: require('os').userInfo().username,
      
      audio: {
        originalFile: audioFilePath,
        originalName: audioFileName,
        duration: 0, // Will be populated after audio analysis
        sampleRate: 44100,
        channels: 2,
        format: path.extname(audioFileName).slice(1),
        checksum: this.calculateFileChecksum(audioFilePath),
        processedFile: null,
        fileSize: fileStats.size
      },
      
      transcription: {
        provider: '',
        model: '',
        language: 'en',
        timestamp: null,
        status: 'pending',
        confidence: 0,
        dataFile: 'transcription.json'
      },
      
      ui: {
        currentMode: 'playback',
        sidebarWidth: 300,
        playbackSpeed: 1.0,
        volume: 0.8,
        currentTime: 0,
        selectedSegmentId: null
      },
      
      export: {
        lastExportDate: null,
        exportFormats: [],
        exportSettings: {}
      }
    };
  }

  private static calculateFileChecksum(filePath: string): string {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex');
    } catch (error: any) {
      console.warn('Could not calculate file checksum:', error.message);
      return '';
    }
  }

  static async cleanupTempFiles(projectData: ProjectData): Promise<void> {
    if (projectData.project.audio?.tempDirectory) {
      try {
        await fs.promises.rm(projectData.project.audio.tempDirectory, { recursive: true, force: true });
        console.log('Cleaned up temporary project files');
      } catch (error: any) {
        console.warn('Could not clean up temporary files:', error.message);
      }
    }
  }

  static validateProjectData(projectData: ProjectData): boolean {
    try {
      // Check required fields
      if (!projectData.project || !projectData.transcription) {
        return false;
      }
      
      if (!projectData.project.version || !projectData.project.projectId) {
        return false;
      }
      
      if (!Array.isArray(projectData.transcription.segments)) {
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('Project validation error:', error);
      return false;
    }
  }
  
  /**
   * Format bytes as human-readable text
   */
  private static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
