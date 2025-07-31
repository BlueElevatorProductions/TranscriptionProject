import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ProjectData {
  name?: string;
  description?: string;
  audioFile?: string;
  transcription?: any;
  speakers?: { [key: string]: string };
  clips?: any[];
  preferences?: any;
  created?: string;
}

interface ProjectFile {
  version: string;
  created: string;
  modified: string;
  project: {
    name: string;
    description: string;
  };
  media: {
    audioFile: {
      originalPath: string;
      fileName: string;
      duration: number;
      format: string;
      size: number;
      checksum: string;
      embedded: boolean;
      data: string | null;
    };
  } | null;
  transcription: any;
  speakers: { [key: string]: string };
  clips: any[];
  preferences: any;
}

interface SaveOptions {
  embedAudio?: boolean;
}

export class ProjectFileManager {
  private version = "1.0";

  async saveProject(projectData: ProjectData, savePath: string, options: SaveOptions = {}): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const { embedAudio = false } = options;
      
      const projectFile: ProjectFile = {
        version: this.version,
        created: projectData.created || new Date().toISOString(),
        modified: new Date().toISOString(),
        project: {
          name: projectData.name || path.basename(savePath, '.transcription'),
          description: projectData.description || ''
        },
        media: await this.processMediaFiles(projectData.audioFile, embedAudio),
        transcription: projectData.transcription || {},
        speakers: projectData.speakers || {},
        clips: projectData.clips || [],
        preferences: projectData.preferences || {}
      };

      // Write project file
      await fs.promises.writeFile(savePath, JSON.stringify(projectFile, null, 2), 'utf8');
      
      // If not embedding audio, copy audio file to project folder
      if (!embedAudio && projectData.audioFile) {
        const projectDir = path.dirname(savePath);
        const audioFileName = path.basename(projectData.audioFile);
        const audioDestPath = path.join(projectDir, audioFileName);
        
        if (projectData.audioFile !== audioDestPath && fs.existsSync(projectData.audioFile)) {
          await fs.promises.copyFile(projectData.audioFile, audioDestPath);
        }
      }

      return { success: true, path: savePath };
    } catch (error) {
      console.error('Save project failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save project' 
      };
    }
  }

  async loadProject(projectPath: string): Promise<{ success: boolean; project?: ProjectFile; error?: string }> {
    try {
      if (!fs.existsSync(projectPath)) {
        return { success: false, error: 'Project file does not exist' };
      }

      const projectData: ProjectFile = JSON.parse(await fs.promises.readFile(projectPath, 'utf8'));
      
      // Verify version compatibility
      if (!this.isVersionCompatible(projectData.version)) {
        return { success: false, error: `Unsupported project version: ${projectData.version}` };
      }

      // Resolve audio file path
      if (projectData.media?.audioFile) {
        const audioFile = projectData.media.audioFile;
        
        if (audioFile.embedded && audioFile.data) {
          // Extract embedded audio to temp file
          const tempPath = path.join(require('os').tmpdir(), audioFile.fileName);
          const audioBuffer = Buffer.from(audioFile.data, 'base64');
          await fs.promises.writeFile(tempPath, audioBuffer);
          (audioFile as any).resolvedPath = tempPath;
        } else {
          // Look for audio file relative to project
          const projectDir = path.dirname(projectPath);
          const audioPath = path.join(projectDir, audioFile.fileName);
          
          if (await this.fileExists(audioPath)) {
            (audioFile as any).resolvedPath = audioPath;
          } else if (await this.fileExists(audioFile.originalPath)) {
            (audioFile as any).resolvedPath = audioFile.originalPath;
          } else {
            return { success: false, error: `Audio file not found: ${audioFile.fileName}` };
          }
        }
      }

      return { success: true, project: projectData };
    } catch (error) {
      console.error('Load project failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load project' 
      };
    }
  }

  private async processMediaFiles(audioFilePath?: string, embedAudio: boolean = false): Promise<ProjectFile['media']> {
    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
      return null;
    }

    try {
      const stats = await fs.promises.stat(audioFilePath);
      const fileName = path.basename(audioFilePath);
      
      const mediaInfo = {
        originalPath: audioFilePath,
        fileName: fileName,
        duration: 0, // Will be filled by audio analysis
        format: path.extname(fileName).slice(1),
        size: stats.size,
        checksum: await this.calculateChecksum(audioFilePath),
        embedded: embedAudio,
        data: null as string | null
      };

      if (embedAudio) {
        const audioBuffer = await fs.promises.readFile(audioFilePath);
        mediaInfo.data = audioBuffer.toString('base64');
      }

      return { audioFile: mediaInfo };
    } catch (error) {
      console.error('Error processing media files:', error);
      return null;
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private isVersionCompatible(version: string): boolean {
    return version === this.version; // For now, exact match
  }
}

export default ProjectFileManager;