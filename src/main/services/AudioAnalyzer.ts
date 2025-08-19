import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface AudioMetadata {
  // File info
  filePath: string;
  fileName: string;
  fileSize: number;
  
  // Audio properties
  format: string;           // 'wav', 'mp3', 'flac', etc.
  codec: string;            // 'pcm_s24le', 'mp3', 'flac', etc.
  sampleRate: number;       // 44100, 48000, 96000, etc.
  bitDepth?: number;        // 16, 24, 32 (undefined for lossy)
  bitrate?: number;         // For lossy formats (e.g., 128000)
  duration: number;         // In seconds
  channels: number;         // 1 = mono, 2 = stereo
  
  // Analysis results
  isLossy: boolean;
  isCompressed: boolean;
  needsConversion: boolean;
}

export interface ConversionRecommendation {
  action: 'keep-original' | 'convert-to-flac' | 'resample' | 'normalize';
  reason: string;
  estimatedSize: number;
  qualityImpact: 'none' | 'minimal' | 'lossy-upscale';
  targetFormat?: string;
  targetSampleRate?: number;
  targetBitDepth?: number;
}

export interface ProjectAudioSettings {
  masterSampleRate: 44100 | 48000 | 96000 | 192000;
  masterBitDepth: 16 | 24 | 32;
  storageFormat: 'flac' | 'original' | 'always-convert';
  normalizeOnImport: boolean;
}

export class AudioAnalyzer {
  private static readonly LOSSY_FORMATS = ['mp3', 'aac', 'm4a', 'ogg', 'opus', 'wma'];
  private static readonly LOSSLESS_UNCOMPRESSED = ['wav', 'aiff', 'aif', 'pcm'];
  private static readonly LOSSLESS_COMPRESSED = ['flac', 'alac', 'ape', 'wv'];
  
  /**
   * Analyze an audio file using ffprobe
   */
  async analyze(filePath: string): Promise<AudioMetadata> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase().substring(1);
    
    try {
      const ffprobeData = await this.runFFprobe(filePath);
      const audioStream = ffprobeData.streams.find((s: any) => s.codec_type === 'audio');
      
      if (!audioStream) {
        throw new Error('No audio stream found in file');
      }
      
      // Extract metadata
      const sampleRate = parseInt(audioStream.sample_rate) || 48000;
      const codec = audioStream.codec_name || 'unknown';
      const channels = audioStream.channels || 2;
      const duration = parseFloat(ffprobeData.format.duration) || 0;
      const bitrate = parseInt(ffprobeData.format.bit_rate) || undefined;
      
      // Determine bit depth for PCM formats
      let bitDepth: number | undefined;
      if (codec.includes('pcm')) {
        // Extract bit depth from codec name (e.g., pcm_s24le = 24-bit)
        const match = codec.match(/(\d+)/);
        if (match) {
          bitDepth = parseInt(match[1]);
        }
      } else if (audioStream.bits_per_sample) {
        bitDepth = audioStream.bits_per_sample;
      } else if (audioStream.bits_per_raw_sample) {
        bitDepth = audioStream.bits_per_raw_sample;
      }
      
      // Determine format characteristics
      const isLossy = this.isLossyFormat(extension, codec);
      const isCompressed = this.isCompressedFormat(extension, codec);
      
      return {
        filePath,
        fileName,
        fileSize: stats.size,
        format: extension,
        codec,
        sampleRate,
        bitDepth,
        bitrate,
        duration,
        channels,
        isLossy,
        isCompressed,
        needsConversion: this.needsConversion(extension, isLossy, isCompressed)
      };
    } catch (error) {
      console.error('FFprobe analysis failed:', error);
      // Fallback to basic analysis
      return this.basicAnalysis(filePath, stats);
    }
  }
  
  /**
   * Generate smart conversion recommendation based on file analysis
   */
  generateRecommendation(
    metadata: AudioMetadata,
    projectSettings?: ProjectAudioSettings
  ): ConversionRecommendation {
    // Case 1: Lossy format (MP3, AAC, etc.)
    if (metadata.isLossy) {
      // Check if we need to resample for project consistency
      if (projectSettings && metadata.sampleRate !== projectSettings.masterSampleRate) {
        return {
          action: 'resample',
          reason: `Resample from ${metadata.sampleRate}Hz to project standard ${projectSettings.masterSampleRate}Hz`,
          estimatedSize: metadata.fileSize, // Size won't change much for lossy
          qualityImpact: 'minimal',
          targetSampleRate: projectSettings.masterSampleRate
        };
      }
      
      // Otherwise keep original to avoid quality loss
      return {
        action: 'keep-original',
        reason: `Keep original ${metadata.format.toUpperCase()} - no quality gain from converting lossy format`,
        estimatedSize: metadata.fileSize,
        qualityImpact: 'none'
      };
    }
    
    // Case 2: Uncompressed lossless (WAV, AIFF)
    if (!metadata.isCompressed && !metadata.isLossy) {
      const estimatedFlacSize = metadata.fileSize * 0.6; // FLAC typically achieves 40% compression
      
      return {
        action: 'convert-to-flac',
        reason: `Convert to FLAC for ${Math.round((1 - 0.6) * 100)}% size reduction with no quality loss`,
        estimatedSize: estimatedFlacSize,
        qualityImpact: 'none',
        targetFormat: 'flac',
        targetSampleRate: projectSettings?.masterSampleRate || metadata.sampleRate,
        targetBitDepth: projectSettings?.masterBitDepth || metadata.bitDepth
      };
    }
    
    // Case 3: Already compressed lossless (FLAC, ALAC)
    if (metadata.isCompressed && !metadata.isLossy) {
      // Check if we need to resample
      if (projectSettings && metadata.sampleRate !== projectSettings.masterSampleRate) {
        return {
          action: 'resample',
          reason: `Resample from ${metadata.sampleRate}Hz to project standard ${projectSettings.masterSampleRate}Hz`,
          estimatedSize: metadata.fileSize,
          qualityImpact: 'minimal',
          targetSampleRate: projectSettings.masterSampleRate,
          targetFormat: 'flac'
        };
      }
      
      return {
        action: 'keep-original',
        reason: `Already optimally compressed as ${metadata.format.toUpperCase()}`,
        estimatedSize: metadata.fileSize,
        qualityImpact: 'none'
      };
    }
    
    // Default fallback
    return {
      action: 'keep-original',
      reason: 'Keep original format',
      estimatedSize: metadata.fileSize,
      qualityImpact: 'none'
    };
  }
  
  /**
   * Determine smart project settings from first audio file
   */
  determineProjectSettings(metadata: AudioMetadata): ProjectAudioSettings {
    // Smart defaults based on the source file
    let masterSampleRate: 44100 | 48000 | 96000 | 192000 = 48000;
    let masterBitDepth: 16 | 24 | 32 = 24;
    
    // Use source sample rate if it's a standard rate
    if ([44100, 48000, 96000, 192000].includes(metadata.sampleRate)) {
      masterSampleRate = metadata.sampleRate as any;
    } else if (metadata.sampleRate > 48000) {
      masterSampleRate = 96000; // Upsample to 96k for high-res sources
    } else {
      masterSampleRate = 48000; // Standard for most pro audio
    }
    
    // Use source bit depth if available
    if (metadata.bitDepth && [16, 24, 32].includes(metadata.bitDepth)) {
      masterBitDepth = metadata.bitDepth as any;
    } else if (!metadata.isLossy) {
      masterBitDepth = 24; // Good default for pro audio
    }
    
    // Determine storage format
    const storageFormat = metadata.isLossy ? 'original' : 'flac';
    
    return {
      masterSampleRate,
      masterBitDepth,
      storageFormat,
      normalizeOnImport: false // Let user decide
    };
  }
  
  /**
   * Run ffprobe to get detailed audio metadata
   */
  private runFFprobe(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ]);
      
      let output = '';
      let errorOutput = '';
      
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (parseError) {
            reject(new Error('Failed to parse ffprobe output'));
          }
        } else {
          reject(new Error(`ffprobe failed: ${errorOutput}`));
        }
      });
      
      ffprobe.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  /**
   * Basic analysis fallback when ffprobe is not available
   */
  private basicAnalysis(filePath: string, stats: fs.Stats): AudioMetadata {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase().substring(1);
    
    return {
      filePath,
      fileName,
      fileSize: stats.size,
      format: extension,
      codec: extension,
      sampleRate: 48000, // Assume standard
      bitDepth: undefined,
      bitrate: undefined,
      duration: 0,
      channels: 2,
      isLossy: this.isLossyFormat(extension, extension),
      isCompressed: this.isCompressedFormat(extension, extension),
      needsConversion: this.needsConversion(extension, 
        this.isLossyFormat(extension, extension),
        this.isCompressedFormat(extension, extension))
    };
  }
  
  private isLossyFormat(extension: string, codec: string): boolean {
    return AudioAnalyzer.LOSSY_FORMATS.includes(extension) ||
           ['mp3', 'aac', 'vorbis', 'opus'].includes(codec);
  }
  
  private isCompressedFormat(extension: string, codec: string): boolean {
    return AudioAnalyzer.LOSSLESS_COMPRESSED.includes(extension) ||
           AudioAnalyzer.LOSSY_FORMATS.includes(extension) ||
           ['flac', 'alac'].includes(codec);
  }
  
  private needsConversion(extension: string, isLossy: boolean, isCompressed: boolean): boolean {
    // WAV and AIFF should be converted to FLAC
    // Lossy formats should be kept as-is
    // Already compressed lossless should be kept as-is
    return !isLossy && !isCompressed;
  }
}

export default AudioAnalyzer;