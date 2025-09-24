/**
 * TranscriptionServiceV2 - Direct segment-based transcription
 *
 * This service directly outputs WordSegment and SpacerSegment arrays
 * without any legacy format conversion. Works with v2.0 architecture.
 *
 * Key features:
 * - Direct segment output (WordSegment | SpacerSegment)
 * - Preserves original timestamps
 * - Creates explicit spacer segments for gaps
 * - No legacy format support
 */

import {
  WordSegment,
  SpacerSegment,
  Segment,
  ProjectData,
  TranscriptionResult
} from '../../shared/types';
import { spawn } from 'child_process';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SimpleCloudTranscriptionService } from './SimpleCloudTranscriptionService';

// ==================== Configuration ====================

const SPACER_THRESHOLD_SECONDS = 1.0;  // Gaps ≥1s become spacer segments
const MIN_SEGMENT_DURATION = 0.1;      // Minimum segment duration

// ==================== Types ====================

export interface TranscriptionJobV2 {
  id: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  segments?: Segment[];
  speakers?: { [key: string]: string };
  error?: string;
  startedAt: string;
  completedAt?: string;
  audioPath?: string; // Store original audio path for import
  audioMetadata?: any; // Store audio metadata for import
}

export interface TranscriptionOptionsV2 {
  method: 'cloud' | 'local';
  language?: string;
  model?: string;
  quality?: 'standard' | 'high';
}

// ==================== TranscriptionServiceV2 ====================

export class TranscriptionServiceV2 {
  private static activeJobs = new Map<string, TranscriptionJobV2>();
  private static eventEmitter: any = null;
  private static apiKeys: { [key: string]: string } = {};

  /**
   * Set event emitter for progress updates
   */
  public static setEventEmitter(emitter: any): void {
    this.eventEmitter = emitter;
  }

  /**
   * Set API keys for cloud services
   */
  public static setApiKeys(keys: { [key: string]: string }): void {
    console.log('🔑 TranscriptionServiceV2: Setting API keys:', Object.keys(keys));
    this.apiKeys = keys;
  }

  /**
   * Start transcription and return job ID
   */
  public static async startTranscription(
    filePath: string,
    options: TranscriptionOptionsV2
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      console.log('🎬 TranscriptionServiceV2.startTranscription called with:', { filePath, options });

      const jobId = this.generateJobId();
      const fileName = filePath.split('/').pop() || 'Unknown file';
      const originalFilePath = filePath; // Store original path for reference

      // Convert audio file to WAV and place in project audio directory
      // Try to get current project path to determine audio directory
      const currentProjectPath = this.getCurrentProjectPath();
      const projectAudioDir = this.getProjectAudioDirectory(currentProjectPath);
      const audioFileName = fileName;
      const projectAudioPath = await this.convertAudioToWav(originalFilePath, projectAudioDir, audioFileName);

      const job: TranscriptionJobV2 = {
        id: jobId,
        filePath: projectAudioPath, // Use converted WAV path for transcription processing
        fileName,
        status: 'pending',
        progress: 0,
        startedAt: new Date().toISOString(),
        audioPath: projectAudioPath, // Use project audio path for import
        audioMetadata: {
          fileName,
          audioPath: projectAudioPath, // Point to converted WAV file
          originalPath: originalFilePath       // Keep reference to original MP3/source
        }
      };

      this.activeJobs.set(jobId, job);
      console.log('✅ TranscriptionServiceV2: Job created and stored:', {
        jobId,
        fileName,
        options,
        activeJobCount: this.activeJobs.size
      });

      // Start transcription asynchronously
      console.log('🔄 TranscriptionServiceV2: Starting async processing...');
      this.processTranscription(jobId, options);

      console.log('🎯 TranscriptionServiceV2: Returning success with jobId:', jobId);
      return { success: true, jobId };

    } catch (error) {
      console.error('❌ TranscriptionServiceV2: Failed to start transcription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start transcription'
      };
    }
  }

  /**
   * Get job status
   */
  public static getJob(jobId: string): TranscriptionJobV2 | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  public static getAllJobs(): TranscriptionJobV2[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel transcription job
   */
  public static async cancelJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status === 'completed' || job.status === 'error') {
      return { success: true }; // Already finished
    }

    // Update job status
    job.status = 'error';
    job.error = 'Cancelled by user';
    job.completedAt = new Date().toISOString();

    this.emitJobUpdate(job);

    console.log('🚫 TranscriptionServiceV2: Job cancelled', jobId);
    return { success: true };
  }

  // ==================== Private Methods ====================

  private static async processTranscription(jobId: string, options: TranscriptionOptionsV2): Promise<void> {
    console.log('🔥 TranscriptionServiceV2.processTranscription started for jobId:', jobId);

    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.error('❌ TranscriptionServiceV2: Job not found for jobId:', jobId);
      return;
    }

    try {
      console.log('📝 TranscriptionServiceV2: Found job, updating status to processing...');

      // Update status to processing
      job.status = 'processing';
      job.progress = 10;
      this.emitJobUpdate(job);

      console.log('⚡ TranscriptionServiceV2: Processing job:', {
        jobId,
        options,
        fileName: job.fileName,
        filePath: job.filePath
      });

      // Use existing cloud transcription service for actual transcription
      let rawResult: any;

      if (options.method === 'cloud') {
        // Update progress
        job.progress = 25;
        this.emitJobUpdate(job);

        // Use SimpleCloudTranscriptionService with API keys
        console.log('🔑 TranscriptionServiceV2: Using API keys for cloud service');
        const cloudService = new SimpleCloudTranscriptionService({
          openai: this.apiKeys.openai || '',
          assemblyai: this.apiKeys.assemblyai || ''
        });
        rawResult = await cloudService.transcribeWithOpenAI(job.filePath, (progress) => {
          job.progress = 25 + (Number(progress) * 0.5); // Progress from 25% to 75%
          this.emitJobUpdate(job);
        });

        // Update progress
        job.progress = 75;
        this.emitJobUpdate(job);

      } else {
        // Local transcription using Python whisper service
        console.log('🔧 TranscriptionServiceV2: Starting local transcription');
        job.progress = 25;
        this.emitJobUpdate(job);

        // Call Python whisper service
        rawResult = await this.runLocalTranscription(job.filePath, options, (progress) => {
          job.progress = 25 + (progress * 0.5); // Progress from 25% to 75%
          this.emitJobUpdate(job);
        });

        // Update progress after transcription
        job.progress = 75;
        this.emitJobUpdate(job);
      }

      // Convert raw result to v2.0 segments
      console.log('🔄 TranscriptionServiceV2: Converting to segments');
      const segments = this.convertToSegments(rawResult);
      const speakers = this.extractSpeakers(rawResult);

      // Update job with segments
      job.status = 'completed';
      job.progress = 100;
      job.segments = segments;
      job.speakers = speakers;
      job.completedAt = new Date().toISOString();

      // Ensure audioMetadata includes duration from transcription result if available
      if (job.audioMetadata && rawResult?.duration) {
        job.audioMetadata.duration = rawResult.duration;
      }

      console.log('✅ TranscriptionServiceV2: Job completed', {
        jobId,
        segmentCount: segments.length,
        speakerCount: Object.keys(speakers).length
      });

      this.emitJobUpdate(job);

    } catch (error) {
      console.error('❌ TranscriptionServiceV2: Job failed', jobId, error);

      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Transcription failed';
      job.completedAt = new Date().toISOString();

      this.emitJobUpdate(job);
    }
  }

  /**
   * Convert raw transcription result to v2.0 segments
   */
  private static convertToSegments(rawResult: any): Segment[] {
    const segments: Segment[] = [];

    if (!rawResult?.segments || !Array.isArray(rawResult.segments)) {
      console.warn('TranscriptionServiceV2: No segments in transcription result');
      return segments;
    }

    let currentTime = 0;

    for (const rawSegment of rawResult.segments) {
      const segmentStart = rawSegment.start || 0;
      const segmentEnd = rawSegment.end || segmentStart;

      // Create spacer segment for significant gaps only
      if (segmentStart - currentTime >= SPACER_THRESHOLD_SECONDS) {
        const spacerSegment: SpacerSegment = {
          type: 'spacer',
          id: this.generateSegmentId(),
          start: currentTime,
          end: segmentStart,
          duration: segmentStart - currentTime,
          label: `Gap (${(segmentStart - currentTime).toFixed(1)}s)`
        };
        segments.push(spacerSegment);
        currentTime = segmentStart;
      }

      // Create word segments from words in this segment
      if (rawSegment.words && Array.isArray(rawSegment.words)) {
        for (const word of rawSegment.words) {
          if (word.word && word.word.trim()) {
            // Adjust start time to ensure continuity
            const adjustedStart = Math.max(word.start || segmentStart, currentTime);
            const originalEnd = word.end || word.start || segmentEnd;
            const adjustedEnd = Math.max(adjustedStart + MIN_SEGMENT_DURATION, originalEnd);

            const wordSegment: WordSegment = {
              type: 'word',
              id: this.generateSegmentId(),
              start: adjustedStart,
              end: adjustedEnd,
              text: word.word.trim(),
              confidence: word.score || word.confidence || 1.0,
              originalStart: word.start || segmentStart,
              originalEnd: originalEnd
            };

            segments.push(wordSegment);
            currentTime = adjustedEnd;
          }
        }
      } else {
        // No word-level data, create segment-level word
        const text = rawSegment.text?.trim() || '';
        if (text) {
          const adjustedStart = Math.max(segmentStart, currentTime);
          const adjustedEnd = Math.max(adjustedStart + MIN_SEGMENT_DURATION, segmentEnd);

          const wordSegment: WordSegment = {
            type: 'word',
            id: this.generateSegmentId(),
            start: adjustedStart,
            end: adjustedEnd,
            text: text,
            confidence: 1.0,
            originalStart: segmentStart,
            originalEnd: segmentEnd
          };
          segments.push(wordSegment);
          currentTime = adjustedEnd;
        }
      }
    }

    // Post-process segments to ensure perfect coverage
    const processedSegments = this.postProcessSegments(segments);

    console.log(`🎯 TranscriptionServiceV2: Created ${processedSegments.length} segments`);
    return processedSegments;
  }

  /**
   * Post-process segments to ensure perfect coverage and no overlaps
   */
  private static postProcessSegments(segments: Segment[]): Segment[] {
    if (segments.length === 0) return segments;

    // Sort segments by start time
    segments.sort((a, b) => a.start - b.start);

    const processedSegments: Segment[] = [];
    let expectedTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Adjust start time to ensure continuity
      if (segment.start > expectedTime) {
        // Create small gap filler if needed (only for very small gaps)
        const gap = segment.start - expectedTime;
        if (gap < SPACER_THRESHOLD_SECONDS && gap > 0.001) {
          // Fill small gap by extending previous segment or adjusting current start
          if (processedSegments.length > 0) {
            const lastSegment = processedSegments[processedSegments.length - 1];
            if (lastSegment.type === 'word') {
              (lastSegment as WordSegment).end = segment.start;
            }
          } else {
            // Adjust current segment to start at expected time
            const adjustedSegment = { ...segment };
            adjustedSegment.start = expectedTime;
            processedSegments.push(adjustedSegment);
            expectedTime = adjustedSegment.end;
            continue;
          }
        }
      } else if (segment.start < expectedTime) {
        // Overlap detected - adjust start time
        const adjustedSegment = { ...segment };
        adjustedSegment.start = expectedTime;

        // Ensure minimum duration
        if (adjustedSegment.end <= adjustedSegment.start) {
          adjustedSegment.end = adjustedSegment.start + MIN_SEGMENT_DURATION;
        }

        processedSegments.push(adjustedSegment);
        expectedTime = adjustedSegment.end;
        continue;
      }

      processedSegments.push(segment);
      expectedTime = segment.end;
    }

    return processedSegments;
  }

  /**
   * Extract speaker information
   */
  private static extractSpeakers(rawResult: any): { [key: string]: string } {
    const speakers: { [key: string]: string } = {};

    // Default speaker
    speakers['SPEAKER_00'] = 'Speaker 1';

    // Extract from result if available
    if (rawResult?.speakers) {
      Object.assign(speakers, rawResult.speakers);
    }

    return speakers;
  }

  /**
   * Emit job update event
   */
  private static emitJobUpdate(job: TranscriptionJobV2): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit('transcription:progress', job);

      if (job.status === 'completed') {
        this.eventEmitter.emit('transcription:completed', job);
      } else if (job.status === 'error') {
        this.eventEmitter.emit('transcription:error', job);
      }
    }
  }

  // ==================== Local Transcription ====================

  /**
   * Run local transcription using Python whisper service
   */
  private static async runLocalTranscription(
    filePath: string,
    options: TranscriptionOptionsV2,
    progressCallback: (progress: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Get whisper service path
        const projectRoot = app.getAppPath();
        const whisperServicePath = path.join(projectRoot, 'whisper_service.py');

        console.log('🐍 Local transcription using Python service');
        console.log('📁 Project root:', projectRoot);
        console.log('🔍 Whisper service path:', whisperServicePath);
        console.log('📁 File exists:', fs.existsSync(whisperServicePath));

        if (!fs.existsSync(whisperServicePath)) {
          throw new Error(`Whisper service not found at: ${whisperServicePath}`);
        }

        // Map quality to model size
        const modelSize = options.quality === 'high' ? 'medium' : 'base';
        const language = options.language || 'en';

        // Build Python command
        const args = [
          whisperServicePath,
          'transcribe',
          filePath,
          '--model', modelSize
        ];

        if (language) {
          args.push('--language', language);
        }

        console.log('🚀 Spawning Python process:', 'python3', args);

        // Spawn Python process
        const pythonProcess = spawn('python3', args, {
          env: process.env
        });

        let output = '';
        let errorOutput = '';

        // Handle stdout (JSON result)
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        // Handle stderr (progress and logs)
        pythonProcess.stderr.on('data', (data) => {
          const stderrData = data.toString();
          errorOutput += stderrData;

          // Parse progress updates (format: PROGRESS:XX)
          const progressMatch = stderrData.match(/PROGRESS:(\d+)/);
          if (progressMatch) {
            const progress = parseInt(progressMatch[1]);
            console.log(`📊 Local transcription progress: ${progress}%`);
            progressCallback(progress);
          }
        });

        // Handle process completion
        pythonProcess.on('close', (code) => {
          console.log('🏁 Python process closed with code:', code);
          console.log('📤 Raw output length:', output.length);
          console.log('⚠️  Error output:', errorOutput);

          if (code !== 0) {
            reject(new Error(`Whisper process failed with code ${code}: ${errorOutput}`));
            return;
          }

          if (!output.trim()) {
            reject(new Error('No output from whisper service'));
            return;
          }

          try {
            // Extract JSON from output (may have extra text before/after)
            let jsonString = output.trim();

            // Find JSON start and end markers
            const jsonStart = jsonString.indexOf('{');
            const jsonEnd = jsonString.lastIndexOf('}');

            if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
              throw new Error('No valid JSON found in output');
            }

            // Extract just the JSON portion
            jsonString = jsonString.substring(jsonStart, jsonEnd + 1);

            // Parse JSON result
            const result = JSON.parse(jsonString);

            if (result.status === 'error') {
              reject(new Error(result.message || 'Transcription failed'));
              return;
            }

            console.log('✅ Local transcription completed successfully');
            console.log('📊 Segments:', result.segments?.length || 0);
            console.log('🗣️  Speakers:', Object.keys(result.speakers || {}).length);

            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse JSON output:', parseError);
            console.log('📤 Raw output (first 500 chars):', output.substring(0, 500));
            console.log('📤 Raw output (last 200 chars):', output.substring(Math.max(0, output.length - 200)));
            reject(new Error(`Failed to parse transcription result: ${parseError}`));
          }
        });

        // Handle process errors
        pythonProcess.on('error', (error) => {
          console.error('❌ Python process error:', error);
          reject(new Error(`Failed to start Python process: ${error.message}`));
        });

      } catch (error) {
        console.error('❌ Local transcription setup failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Get project audio directory - dynamic path resolution
   */
  private static getProjectAudioDirectory(projectPath?: string): string {
    const path = require('path');
    const { app } = require('electron');

    if (projectPath) {
      // If we have a project path, use its directory + Audio Files
      const projectDir = path.dirname(projectPath);
      return path.join(projectDir, 'Audio Files');
    }

    // If no project path, use a temp directory in userData
    return path.join(app.getPath('userData'), 'temp_audio');
  }

  /**
   * Convert audio file to WAV and place in project directory
   */
  private static async convertAudioToWav(
    sourcePath: string,
    targetDir: string,
    targetFileName: string
  ): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');

    // Ensure target directory exists
    await fs.promises.mkdir(targetDir, { recursive: true });

    // Force WAV extension
    const baseName = path.parse(targetFileName).name;
    const wavFileName = `${baseName}.wav`;
    const targetPath = path.join(targetDir, wavFileName);

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️ TranscriptionServiceV2: Source audio file not found: ${sourcePath}`);
      return sourcePath; // Return original path as fallback
    }

    // If WAV already exists, return it
    if (fs.existsSync(targetPath)) {
      console.log(`📁 TranscriptionServiceV2: WAV file already exists: ${targetPath}`);
      return targetPath;
    }

    console.log(`🎵 TranscriptionServiceV2: Converting to WAV: ${sourcePath} -> ${targetPath}`);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', sourcePath,
        '-acodec', 'pcm_s16le',
        '-ar', '48000',
        '-ac', '2',
        '-y', // Overwrite output file
        targetPath
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code: number | null) => {
        if (code === 0) {
          console.log(`✅ TranscriptionServiceV2: Successfully converted to WAV: ${targetPath}`);
          resolve(targetPath);
        } else {
          console.error(`❌ TranscriptionServiceV2: FFmpeg conversion failed (code ${code}):`, stderr);
          reject(new Error(`Audio conversion failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error: Error) => {
        console.error(`❌ TranscriptionServiceV2: FFmpeg spawn error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Get current project path if available
   * Accesses ProjectDataStore to get the current project path
   */
  private static getCurrentProjectPath(): string | undefined {
    try {
      const { ProjectDataStore } = require('./ProjectDataStore');
      const store = ProjectDataStore.getInstance();
      return store.getCurrentProjectPath();
    } catch (error) {
      console.warn('⚠️ TranscriptionServiceV2: Could not access ProjectDataStore:', error);
      return undefined;
    }
  }

  // ==================== Utility Methods ====================

  private static generateJobId(): string {
    return 'job_v2_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  private static generateSegmentId(): string {
    return 'seg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

export default TranscriptionServiceV2;