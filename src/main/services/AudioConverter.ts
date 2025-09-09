import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';

export interface ConversionOptions {
  targetSampleRate?: number;
  targetBitDepth?: number;
  outputPath?: string;
  preserveMetadata?: boolean;
  onProgress?: (percent: number, status: string) => void;
}

export interface ConversionResult {
  outputPath: string;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
  duration: number;
  wasConverted: boolean;
}

export class AudioConverter {
  private tempDir: string;
  
  constructor() {
    this.tempDir = path.join(app.getPath('temp'), 'audio_conversion');
    this.ensureTempDir();
  }
  
  /**
   * Convert audio to FLAC for lossless compression
   */
  async convertToFLAC(
    inputPath: string, 
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }
    
    const inputStats = fs.statSync(inputPath);
    const outputPath = options.outputPath || this.generateOutputPath(inputPath, 'flac');
    
    options.onProgress?.(0, 'Starting FLAC conversion...');
    
    try {
      // Build ffmpeg arguments for high-quality FLAC conversion
      const args = this.buildFLACArgs(inputPath, outputPath, options);
      
      options.onProgress?.(10, 'Converting to FLAC...');
      
      // Run conversion with progress tracking
      await this.runFFmpeg(args, {
        onProgress: (percent) => {
          options.onProgress?.(10 + (percent * 0.8), 'Converting to FLAC...');
        }
      });
      
      options.onProgress?.(95, 'Finalizing conversion...');
      
      // Verify output file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error('Conversion failed - output file not created');
      }
      
      const outputStats = fs.statSync(outputPath);
      const compressionRatio = outputStats.size / inputStats.size;
      
      options.onProgress?.(100, 'Conversion complete');
      
      // Get duration from ffprobe
      const duration = await this.getAudioDuration(outputPath);
      
      return {
        outputPath,
        originalSize: inputStats.size,
        convertedSize: outputStats.size,
        compressionRatio,
        duration,
        wasConverted: true
      };
      
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      throw new Error(`FLAC conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Resample audio to target sample rate and bit depth
   */
  async resampleAudio(
    inputPath: string,
    targetSampleRate: number,
    targetBitDepth?: number,
    outputFormat: string = 'flac',
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const inputStats = fs.statSync(inputPath);
    const outputPath = options.outputPath || this.generateOutputPath(inputPath, outputFormat);
    
    options.onProgress?.(0, `Resampling to ${targetSampleRate}Hz...`);
    
    try {
      const args = this.buildResampleArgs(inputPath, outputPath, {
        sampleRate: targetSampleRate,
        bitDepth: targetBitDepth,
        format: outputFormat,
        preserveMetadata: options.preserveMetadata ?? true
      });
      
      await this.runFFmpeg(args, {
        onProgress: (percent) => {
          options.onProgress?.(percent, `Resampling to ${targetSampleRate}Hz...`);
        }
      });
      
      const outputStats = fs.statSync(outputPath);
      const duration = await this.getAudioDuration(outputPath);
      
      return {
        outputPath,
        originalSize: inputStats.size,
        convertedSize: outputStats.size,
        compressionRatio: outputStats.size / inputStats.size,
        duration,
        wasConverted: true
      };
      
    } catch (error) {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      throw new Error(`Resampling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Copy audio file without conversion (for lossy sources or already compressed lossless)
   */
  async copyOriginal(inputPath: string, outputPath?: string): Promise<ConversionResult> {
    const targetPath = outputPath || this.generateOutputPath(inputPath);
    const inputStats = fs.statSync(inputPath);
    
    await fs.promises.copyFile(inputPath, targetPath);
    
    const duration = await this.getAudioDuration(targetPath);
    
    return {
      outputPath: targetPath,
      originalSize: inputStats.size,
      convertedSize: inputStats.size,
      compressionRatio: 1.0,
      duration,
      wasConverted: false
    };
  }
  
  /**
   * Build ffmpeg arguments for FLAC conversion
   */
  private buildFLACArgs(
    inputPath: string, 
    outputPath: string, 
    options: ConversionOptions
  ): string[] {
    const args = [
      '-i', inputPath,
      '-c:a', 'flac',
      '-compression_level', '8', // Maximum compression for smallest file
      '-exact_rice_parameters', '1', // Better compression
    ];
    
    // Set sample rate if specified
    if (options.targetSampleRate) {
      args.push('-ar', options.targetSampleRate.toString());
    }
    
    // Set bit depth if specified
    if (options.targetBitDepth) {
      const sampleFormat = this.getSampleFormat(options.targetBitDepth);
      args.push('-sample_fmt', sampleFormat);
    }
    
    // Preserve metadata
    if (options.preserveMetadata !== false) {
      args.push('-map_metadata', '0');
    }
    
    // Output file
    args.push('-y', outputPath);
    
    return args;
  }
  
  /**
   * Build ffmpeg arguments for resampling
   */
  private buildResampleArgs(
    inputPath: string,
    outputPath: string,
    resampleOptions: {
      sampleRate: number;
      bitDepth?: number;
      format: string;
      preserveMetadata: boolean;
    }
  ): string[] {
    const args = [
      '-i', inputPath,
      '-ar', resampleOptions.sampleRate.toString(),
    ];
    
    // High-quality resampling filter
    args.push('-af', 'aresample=resampler=soxr:precision=28:osf=s32:dither_method=triangular');
    
    // Set output format
    if (resampleOptions.format === 'flac') {
      args.push('-c:a', 'flac', '-compression_level', '8');
    } else if (resampleOptions.format === 'wav') {
      // Choose PCM codec based on desired bit depth (default 16-bit)
      const bd = resampleOptions.bitDepth || 16;
      const pcmCodec = bd >= 32 ? 'pcm_s32le' : bd >= 24 ? 'pcm_s24le' : 'pcm_s16le';
      args.push('-c:a', pcmCodec);
    }
    
    // Set bit depth
    if (resampleOptions.bitDepth) {
      const sampleFormat = this.getSampleFormat(resampleOptions.bitDepth);
      args.push('-sample_fmt', sampleFormat);
    }
    
    // Preserve metadata
    if (resampleOptions.preserveMetadata) {
      args.push('-map_metadata', '0');
    }
    
    args.push('-y', outputPath);
    
    return args;
  }
  
  /**
   * Run ffmpeg with progress tracking
   */
  private runFFmpeg(
    args: string[], 
    options: { onProgress?: (percent: number) => void } = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Running ffmpeg with args:', args);
      
      const ffmpeg = spawn('ffmpeg', args);
      let duration = 0;
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        
        // Parse duration from initial output
        if (duration === 0) {
          const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (durationMatch) {
            const [, hours, minutes, seconds] = durationMatch;
            duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
          }
        }
        
        // Parse progress
        if (duration > 0 && options.onProgress) {
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch) {
            const [, hours, minutes, seconds] = timeMatch;
            const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
            const percent = Math.min(100, (currentTime / duration) * 100);
            options.onProgress(percent);
          }
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  /**
   * Get audio duration using ffprobe
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        filePath
      ]);
      
      let output = '';
      
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          resolve(isNaN(duration) ? 0 : duration);
        } else {
          resolve(0); // Fallback to 0 if can't determine duration
        }
      });
      
      ffprobe.on('error', () => {
        resolve(0); // Fallback to 0 on error
      });
    });
  }
  
  /**
   * Get appropriate sample format for bit depth
   */
  private getSampleFormat(bitDepth: number): string {
    switch (bitDepth) {
      case 16: return 's16';
      case 24: return 's32'; // FFmpeg uses s32 for 24-bit
      case 32: return 's32';
      default: return 's24';
    }
  }
  
  /**
   * Generate output path for converted file
   */
  private generateOutputPath(inputPath: string, format?: string): string {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const extension = format || 'flac';
    const timestamp = Date.now();
    
    return path.join(this.tempDir, `${baseName}_${timestamp}.${extension}`);
  }
  
  /**
   * Ensure temp directory exists
   */
  private ensureTempDir(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }
  
  /**
   * Clean up temp files
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          const stats = fs.statSync(filePath);
          // Remove files older than 1 hour
          if (Date.now() - stats.mtime.getTime() > 3600000) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

export default AudioConverter;
