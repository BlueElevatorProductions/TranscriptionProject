import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import JSZip from 'jszip';

interface ProjectData {
  project: any;
  transcription: any;
  speakers: any;
  clips?: any;
  history?: any;
  preferences?: any;
}

/**
 * ProjectPackageService - Manages .transcript packages (directories)
 * Creates GarageBand-style packages that appear as single files but contain
 * all project resources including embedded audio files.
 */
export class ProjectPackageService {
  private static readonly CURRENT_VERSION = '1.0';
  private static readonly SUPPORTED_VERSIONS = ['1.0', '1.0.0'];
  private static readonly PACKAGE_STRUCTURE = {
    PROJECT_JSON: 'project.json',
    TRANSCRIPTION_JSON: 'transcription.json',
    AUDIO_DIR: 'audio',
    METADATA_DIR: 'metadata',
    RESOURCES_DIR: 'resources'
  };

  /**
   * Save project data as a .transcript package (ZIP file with embedded audio)
   */
  static async saveProject(projectData: ProjectData, packagePath: string): Promise<void> {
    try {
      console.log(`Creating project package at: ${packagePath}`);
      
      // Ensure package path ends with .transcript
      if (!packagePath.endsWith('.transcript')) {
        packagePath = packagePath + '.transcript';
      }

      // Create ZIP package
      const zip = new JSZip();
      
      // Add main project metadata
      zip.file(this.PACKAGE_STRUCTURE.PROJECT_JSON, JSON.stringify(projectData.project, null, 2));
      
      // Add transcription data
      zip.file(this.PACKAGE_STRUCTURE.TRANSCRIPTION_JSON, JSON.stringify(projectData.transcription, null, 2));
      
      // Add metadata files
      const metadataFolder = zip.folder(this.PACKAGE_STRUCTURE.METADATA_DIR);
      if (metadataFolder) {
        metadataFolder.file('speakers.json', JSON.stringify(projectData.speakers, null, 2));
        
        const clipsData = projectData.clips || { clips: [], clipSettings: {} };
        metadataFolder.file('clips.json', JSON.stringify(clipsData, null, 2));
        
        if (projectData.history) {
          metadataFolder.file('history.json', JSON.stringify(projectData.history, null, 2));
        }
        
        if (projectData.preferences) {
          metadataFolder.file('preferences.json', JSON.stringify(projectData.preferences, null, 2));
        }
      }
      
      // Embed audio file
      const audioFolder = zip.folder(this.PACKAGE_STRUCTURE.AUDIO_DIR);
      if (audioFolder && projectData.project.audio?.originalFile) {
        try {
          console.log('Attempting to read audio file:', projectData.project.audio.originalFile);
          
          // Check if file exists first
          await fs.promises.access(projectData.project.audio.originalFile);
          
          const audioBuffer = await fs.promises.readFile(projectData.project.audio.originalFile);
          console.log('Audio file read successfully, size:', audioBuffer.length);
          
          const originalExt = path.extname(projectData.project.audio.originalName || 'audio.wav');
          const embeddedFileName = `original${originalExt}`;
          
          console.log('Adding audio file to ZIP:', embeddedFileName);
          audioFolder.file(embeddedFileName, audioBuffer);
          
          // Update project data with embedded path
          projectData.project.audio.embeddedPath = `${this.PACKAGE_STRUCTURE.AUDIO_DIR}/${embeddedFileName}`;
          projectData.project.audio.embedded = true;
          
          // Re-add updated project data to ZIP
          zip.file(this.PACKAGE_STRUCTURE.PROJECT_JSON, JSON.stringify(projectData.project, null, 2));
          
          console.log(`Audio file embedded: ${projectData.project.audio.originalFile} -> ${embeddedFileName}`);
        } catch (audioError: any) {
          console.error('Could not embed audio file:', audioError);
          console.warn('Continuing without audio file...');
        }
      } else {
        console.log('No audio file to embed or missing audio folder');
      }
      
      // Generate and save ZIP file
      console.log('Generating ZIP package...');
      try {
        const content = await zip.generateAsync({ 
          type: 'nodebuffer', 
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        
        console.log('ZIP generated successfully, size:', content.length);
        console.log('Writing to file:', packagePath);
        
        await fs.promises.writeFile(packagePath, content);
        console.log('ZIP file written successfully');
      } catch (zipError: any) {
        console.error('Error during ZIP generation or file write:', zipError);
        throw zipError;
      }

      console.log(`Project package created successfully: ${packagePath}`);
    } catch (error: any) {
      console.error('Error saving project package:', error);
      throw new Error(`Failed to save project package: ${error.message}`);
    }
  }

  /**
   * Load project data from a .transcript package (ZIP file)
   */
  static async loadProject(packagePath: string): Promise<ProjectData> {
    try {
      console.log(`Loading project package from: ${packagePath}`);

      // Read ZIP file
      const zipData = await fs.promises.readFile(packagePath);
      const zip = await JSZip.loadAsync(zipData);
      
      // Validate ZIP structure
      await this.validateZipStructure(zip);
      
      // Extract project data
      const projectJson = await zip.file(this.PACKAGE_STRUCTURE.PROJECT_JSON)?.async('text');
      const transcriptionJson = await zip.file(this.PACKAGE_STRUCTURE.TRANSCRIPTION_JSON)?.async('text');
      const speakersJson = await zip.file(`${this.PACKAGE_STRUCTURE.METADATA_DIR}/speakers.json`)?.async('text');
      const clipsJson = await zip.file(`${this.PACKAGE_STRUCTURE.METADATA_DIR}/clips.json`)?.async('text');
      const historyJson = await zip.file(`${this.PACKAGE_STRUCTURE.METADATA_DIR}/history.json`)?.async('text');
      const preferencesJson = await zip.file(`${this.PACKAGE_STRUCTURE.METADATA_DIR}/preferences.json`)?.async('text');
      
      if (!projectJson || !transcriptionJson) {
        throw new Error('Invalid project package: missing required data files');
      }
      
      const projectData: ProjectData = {
        project: JSON.parse(projectJson),
        transcription: JSON.parse(transcriptionJson),
        speakers: speakersJson ? JSON.parse(speakersJson) : { speakers: {}, speakerMappings: {} },
        clips: clipsJson ? JSON.parse(clipsJson) : { clips: [], clipSettings: {} }
      };
      
      // Add optional metadata
      if (historyJson) {
        projectData.history = JSON.parse(historyJson);
      }
      
      if (preferencesJson) {
        projectData.preferences = JSON.parse(preferencesJson);
      }
      
      // Extract audio files to temporary location
      await this.extractAudioFromZip(zip, projectData);

      console.log(`Project package loaded successfully from: ${packagePath}`);
      return projectData;
    } catch (error: any) {
      console.error('Error loading project package:', error);
      throw new Error(`Failed to load project package: ${error.message}`);
    }
  }


  /**
   * Validate ZIP package structure
   */
  private static async validateZipStructure(zip: JSZip): Promise<void> {
    const requiredFiles = [
      this.PACKAGE_STRUCTURE.PROJECT_JSON,
      this.PACKAGE_STRUCTURE.TRANSCRIPTION_JSON
    ];
    
    for (const file of requiredFiles) {
      if (!zip.file(file)) {
        throw new Error(`Invalid project package: missing ${file}`);
      }
    }
    
    // Validate version compatibility
    const projectJson = await zip.file(this.PACKAGE_STRUCTURE.PROJECT_JSON)?.async('text');
    if (projectJson) {
      const project = JSON.parse(projectJson);
      if (!this.SUPPORTED_VERSIONS.includes(project.version)) {
        throw new Error(`Unsupported project version: ${project.version}`);
      }
    }
  }

  /**
   * Extract audio files from ZIP to temporary location
   */
  private static async extractAudioFromZip(zip: JSZip, projectData: ProjectData): Promise<void> {
    const tempDir = path.join(app.getPath('temp'), 'transcription_project_' + Date.now());
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Look for audio files in the audio folder
    const audioFiles = zip.folder(this.PACKAGE_STRUCTURE.AUDIO_DIR)?.files || {};
    
    for (const [fileName, file] of Object.entries(audioFiles)) {
      if (fileName.includes('/') && !fileName.endsWith('/')) {
        // This is a file, not a folder
        const baseName = path.basename(fileName);
        
        if (baseName.startsWith('original.')) {
          try {
            const audioBuffer = await file.async('nodebuffer');
            const tempAudioPath = path.join(tempDir, baseName);
            await fs.promises.writeFile(tempAudioPath, audioBuffer);
            
            // Update project data with temporary path
            if (!projectData.project.audio) {
              projectData.project.audio = {};
            }
            projectData.project.audio.resolvedPath = tempAudioPath;
            projectData.project.audio.tempDirectory = tempDir;
            
            console.log(`Extracted audio file to: ${tempAudioPath}`);
            break; // Use the first original audio file found
          } catch (audioError: any) {
            console.warn('Could not extract audio file:', audioError.message);
          }
        }
      }
    }
  }


  /**
   * Generate a unique project ID
   */
  static generateProjectId(): string {
    return 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create initial project structure for new projects
   */
  static createEmptyProject(audioFilePath: string, audioFileName: string): any {
    const fileStats = fs.statSync(audioFilePath);
    
    return {
      version: this.CURRENT_VERSION,
      projectId: this.generateProjectId(),
      name: path.basename(audioFileName, path.extname(audioFileName)),
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      
      audio: {
        originalFile: audioFilePath,
        originalName: audioFileName,
        embeddedPath: null, // Will be set during save
        duration: 0,
        format: path.extname(audioFileName).slice(1),
        size: fileStats.size,
        embedded: true
      },
      
      transcription: {
        service: '',
        model: '',
        language: 'en',
        status: 'pending'
      },
      
      ui: {
        currentMode: 'playback',
        sidebarWidth: 300,
        playbackSpeed: 1.0,
        volume: 0.8,
        currentTime: 0,
        selectedSegmentId: null
      }
    };
  }

  /**
   * Validate project data structure
   */
  static validateProjectData(projectData: ProjectData): boolean {
    try {
      if (!projectData.project || !projectData.transcription) {
        return false;
      }
      
      if (!projectData.project.version || !projectData.project.projectId) {
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('Project validation error:', error);
      return false;
    }
  }
}