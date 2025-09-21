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

      const job: TranscriptionJobV2 = {
        id: jobId,
        filePath,
        fileName,
        status: 'pending',
        progress: 0,
        startedAt: new Date().toISOString(),
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
        // Local transcription using existing local services
        console.log('🔧 TranscriptionServiceV2: Starting local transcription');
        job.progress = 25;
        this.emitJobUpdate(job);

        // For now, create dummy segments for testing
        // In production, this would use a local Whisper service
        console.log('⚠️  TranscriptionServiceV2: Using dummy local transcription for testing');

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        job.progress = 50;
        this.emitJobUpdate(job);

        await new Promise(resolve => setTimeout(resolve, 2000));
        job.progress = 75;
        this.emitJobUpdate(job);

        // Create dummy result structure
        rawResult = {
          segments: [
            {
              id: 1,
              start: 0.0,
              end: 3.0,
              text: "This is a test transcription from local processing.",
              words: [
                { word: "This", start: 0.0, end: 0.3, score: 0.9 },
                { word: "is", start: 0.4, end: 0.5, score: 0.95 },
                { word: "a", start: 0.6, end: 0.7, score: 0.9 },
                { word: "test", start: 0.8, end: 1.1, score: 0.92 },
                { word: "transcription", start: 1.2, end: 1.8, score: 0.88 },
                { word: "from", start: 1.9, end: 2.1, score: 0.94 },
                { word: "local", start: 2.2, end: 2.5, score: 0.91 },
                { word: "processing.", start: 2.6, end: 3.0, score: 0.89 }
              ],
              speaker: "SPEAKER_00"
            }
          ],
          speakers: {
            "SPEAKER_00": "Speaker 1"
          }
        };

        console.log('✅ TranscriptionServiceV2: Local transcription completed (dummy data)');
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

    let previousEndTime = 0;

    for (const rawSegment of rawResult.segments) {
      const segmentStart = rawSegment.start || 0;
      const segmentEnd = rawSegment.end || segmentStart;

      // Create spacer segment for gap if needed
      if (segmentStart - previousEndTime >= SPACER_THRESHOLD_SECONDS) {
        const spacerSegment: SpacerSegment = {
          type: 'spacer',
          id: this.generateSegmentId(),
          start: previousEndTime,
          end: segmentStart,
          duration: segmentStart - previousEndTime,
          label: `Gap (${(segmentStart - previousEndTime).toFixed(1)}s)`
        };
        segments.push(spacerSegment);
      }

      // Create word segments from words in this segment
      if (rawSegment.words && Array.isArray(rawSegment.words)) {
        for (const word of rawSegment.words) {
          if (word.word && word.word.trim()) {
            const wordSegment: WordSegment = {
              type: 'word',
              id: this.generateSegmentId(),
              start: word.start || segmentStart,
              end: word.end || word.start || segmentEnd,
              text: word.word.trim(),
              confidence: word.score || word.confidence || 1.0,
              originalStart: word.start || segmentStart,
              originalEnd: word.end || word.start || segmentEnd
            };

            // Ensure minimum duration
            if (wordSegment.end - wordSegment.start < MIN_SEGMENT_DURATION) {
              wordSegment.end = wordSegment.start + MIN_SEGMENT_DURATION;
            }

            segments.push(wordSegment);
          }
        }
      } else {
        // No word-level data, create segment-level word
        const text = rawSegment.text?.trim() || '';
        if (text) {
          const wordSegment: WordSegment = {
            type: 'word',
            id: this.generateSegmentId(),
            start: segmentStart,
            end: segmentEnd,
            text: text,
            confidence: 1.0,
            originalStart: segmentStart,
            originalEnd: segmentEnd
          };
          segments.push(wordSegment);
        }
      }

      previousEndTime = Math.max(previousEndTime, segmentEnd);
    }

    console.log(`🎯 TranscriptionServiceV2: Created ${segments.length} segments`);
    return segments;
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

  // ==================== Utility Methods ====================

  private static generateJobId(): string {
    return 'job_v2_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  private static generateSegmentId(): string {
    return 'seg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

export default TranscriptionServiceV2;