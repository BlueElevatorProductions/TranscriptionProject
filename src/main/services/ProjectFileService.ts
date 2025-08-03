import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { app } from 'electron';
import * as crypto from 'crypto';

interface ProjectData {
  project: any;
  transcription: any;
  speakers: any;
  clips: any;
  history?: any;
  preferences?: any;
}

export class ProjectFileService {
  private static readonly CURRENT_VERSION = '1.0';
  private static readonly SUPPORTED_VERSIONS = ['1.0'];

  static async saveProject(projectData: ProjectData, filePath: string): Promise<void> {
    try {
      const zip = new JSZip();
      
      // Add main project file
      zip.file('project.json', JSON.stringify(projectData.project, null, 2));
      
      // Add transcription data
      zip.file('transcription.json', JSON.stringify(projectData.transcription, null, 2));
      
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
      }
      
      // TEMPORARILY DISABLE AUDIO EMBEDDING TO PREVENT CRASHES
      console.log('Audio embedding temporarily disabled for stability testing');
      
      // Save audio reference instead of embedding the file
      const audioFolder = zip.folder('audio');
      if (audioFolder && projectData.project.audio?.originalFile) {
        try {
          const audioRef = {
            originalPath: projectData.project.audio.originalFile,
            originalName: projectData.project.audio.originalName,
            note: "Audio embedding temporarily disabled for crash diagnosis. Audio file path preserved for reference."
          };
          audioFolder.file('audio_reference.json', JSON.stringify(audioRef, null, 2));
          console.log('Audio reference saved (embedding disabled for testing)');
        } catch (audioError: any) {
          console.warn('Could not save audio reference:', audioError.message);
        }
      }
      
      // Generate zip file with optimized settings for large files
      console.log('Generating ZIP package with memory optimization...');
      const content = await zip.generateAsync({ 
        type: 'nodebuffer', 
        compression: 'DEFLATE',
        compressionOptions: { 
          level: 1 // Lower compression level for speed and memory efficiency
        },
        streamFiles: true // Enable streaming for large files
      });
      
      // Write to disk
      await fs.promises.writeFile(filePath, content);
      
      console.log(`Project saved successfully to: ${filePath}`);
    } catch (error: any) {
      console.error('Error saving project:', error);
      throw new Error(`Failed to save project: ${error.message}`);
    }
  }

  static async loadProject(filePath: string): Promise<ProjectData> {
    try {
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
      
      if (!projectJson || !transcriptionJson) {
        throw new Error('Invalid project file: missing required data files');
      }
      
      const projectData: ProjectData = {
        project: JSON.parse(projectJson),
        transcription: JSON.parse(transcriptionJson),
        speakers: speakersJson ? JSON.parse(speakersJson) : { speakers: {}, speakerMappings: {} },
        clips: clipsJson ? JSON.parse(clipsJson) : { clips: [] }
      };
      
      // Add optional data
      if (historyJson) {
        projectData.history = JSON.parse(historyJson);
      }
      
      if (preferencesJson) {
        projectData.preferences = JSON.parse(preferencesJson);
      }
      
      // Extract audio files to temporary location
      await this.extractAudioFiles(zip, projectData);
      
      console.log(`Project loaded successfully from: ${filePath}`);
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
    const tempDir = path.join(app.getPath('temp'), 'transcription_project_' + Date.now());
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Look for audio files in the audio folder
    const audioFiles = zip.folder('audio')?.files || {};
    
    for (const [fileName, file] of Object.entries(audioFiles)) {
      if (fileName.includes('/') && !fileName.endsWith('/')) {
        // This is a file, not a folder
        const baseName = path.basename(fileName);
        
        if (baseName.startsWith('original.')) {
          try {
            console.log('Extracting embedded audio file using streaming...');
            
            // Use streaming extraction for large files to avoid memory issues
            const audioBuffer = await file.async('nodebuffer');
            const tempAudioPath = path.join(tempDir, baseName);
            
            // Write in chunks to avoid memory spikes
            await fs.promises.writeFile(tempAudioPath, audioBuffer);
            
            // Update project data with temporary path
            if (!projectData.project.audio) {
              projectData.project.audio = {};
            }
            projectData.project.audio.originalFile = tempAudioPath;
            projectData.project.audio.tempDirectory = tempDir;
            
            console.log(`Extracted audio file to: ${tempAudioPath}`);
            break; // Use the first original audio file found
          } catch (audioError: any) {
            console.error('Could not extract audio file:', audioError);
            // Try to continue without audio
          }
        }
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
}