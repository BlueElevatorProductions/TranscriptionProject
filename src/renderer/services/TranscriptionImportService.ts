/**
 * TranscriptionImportService v2.0 - Clean segment-based import
 *
 * This service converts raw transcription results into clip-based project data
 * with proper segment arrays, WITHOUT modifying original word timestamps.
 *
 * Key principles:
 * - NEVER modify original word timestamps
 * - Create explicit spacer segments for large gaps ≥1s (prevents EDL timeline compression)
 * - Extend segments for small gaps with proportional original timing (preserves speed)
 * - Build clips with complete segment coverage including inter-clip silences
 * - Maintain original timing data for debugging/recovery
 */

import {
  ProjectData,
  Clip,
  LegacySegment,
  Word,
  Segment,
  WordSegment,
  SpacerSegment,
  TranscriptionResult
} from '../../shared/types';
import {
  createWordSegment,
  createSpacerSegment,
  validateSegments,
  getSegmentText,
  normalizeSegmentsForImport,
  validateNormalizedSegments,
  ImportValidationError
} from '../../shared/operations';

// ==================== Configuration ====================

const SPACER_THRESHOLD_SECONDS = 1.0;  // Gaps ≥1s become spacer segments
const MAX_CLIP_DURATION = 30.0;        // Split long speaker segments
const MIN_CLIP_DURATION = 1.0;         // Merge very short clips

// ==================== Import Service ====================

export class TranscriptionImportService {
  /**
   * Convert transcription result to ProjectData with segment-based clips
   */
  public static importTranscription(
    transcriptionResult: TranscriptionResult,
    audioFilePath: string,
    audioMetadata: any
  ): ProjectData {
    console.log('[Import][Transcribe] done', {
      jobId: audioMetadata?.jobId ?? 'unknown',
      words: transcriptionResult?.segments?.reduce((acc: number, seg) => acc + (seg.words?.length || 0), 0) ?? 0,
      rawSegments: transcriptionResult?.segments?.length ?? 0,
    });
    console.log('[Import][Audio] resolved metadata forwarded to renderer', {
      audioPath: audioFilePath,
      duration: audioMetadata?.duration,
      format: audioMetadata?.format,
    });
    console.log('[Import][Spacer] threshold', { seconds: SPACER_THRESHOLD_SECONDS });

    const { segments: rawSegments, speakers, speakerSegments } = transcriptionResult;

    // Step 1: Convert legacy segments to words with original timing
    const allWords = this.extractWordsFromSegments(rawSegments);
    console.log(`📝 Extracted ${allWords.length} words from ${rawSegments.length} segments`);

    const normalizedWords = this.normalizeWordTimestamps(allWords);
    const timestampsAdjusted =
      normalizedWords.length === allWords.length &&
      normalizedWords.some((word, index) => {
        const original = allWords[index];
        return (
          Math.abs(Number(original.start) - word.start) > 1e-6 ||
          Math.abs(Number(original.end) - word.end) > 1e-6
        );
      });

    if (timestampsAdjusted) {
      const maxEndSec = normalizedWords.length ? Math.max(...normalizedWords.map((w) => w.end)) : 0;
      console.log('[Import][Spacer] Normalized word timestamps', {
        detectedUnit: 'seconds',
        maxEndSec: Number(maxEndSec.toFixed(3)),
      });
    }

    // Step 2: Group words by speaker and create clips
    const clips = this.createClipsFromWords(normalizedWords, speakers || {});
    console.log('[Import][Clip] grouping complete', { clipCount: clips.length });

    let totalWordSegments = 0;
    let totalSpacerSegments = 0;
    let firstSpacerExample: { clipOrder: number; clipId: string; start: number; end: number; duration: number } | null = null;

    clips.forEach((clip, index) => {
      let words = 0;
      let spacers = 0;
      for (const segment of clip.segments) {
        if (segment.type === 'spacer') {
          spacers += 1;
          totalSpacerSegments += 1;
          if (!firstSpacerExample) {
            firstSpacerExample = {
              clipOrder: clip.order ?? index,
              clipId: clip.id,
              start: Number(segment.start.toFixed(3)),
              end: Number(segment.end.toFixed(3)),
              duration: Number((segment.end - segment.start).toFixed(3))
            };
          }
        } else {
          words += 1;
          totalWordSegments += 1;
        }
      }
      console.log('[Import][Spacer] summary', {
        clipOrder: clip.order ?? index,
        speaker: clip.speaker,
        microSpacerCount: clip.segments.filter(segment => segment.type === 'spacer' && segment.duration < SPACER_THRESHOLD_SECONDS).length,
        totalSpacerCount: spacers,
      });
      console.log('[Import][Clip] built', {
        clipId: clip.id,
        order: clip.order ?? index,
        segmentCount: clip.segments.length,
        durationSec: Number(clip.duration.toFixed(3)),
        speaker: clip.speaker,
      });
    });

    if (firstSpacerExample) {
      console.log('[Import][Spacer] example', firstSpacerExample);
    } else {
      console.warn('[Import][Spacer] warning No spacer segments were generated during import.');
    }
    console.log('[Import][Clip] totals', {
      wordSegments: totalWordSegments,
      spacerSegments: totalSpacerSegments,
    });

    // Step 3: Build project data structure
    const projectData: ProjectData = {
      version: '2.0',
      project: {
        projectId: this.generateId(),
        name: this.extractFileName(audioFilePath),
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '2.0',
        audio: {
          ...audioMetadata,
          path: audioFilePath // Ensure path is set for WAV conversion
        },
        transcription: {
          service: 'openai', // TODO: Get from actual service
          model: 'whisper-1',
          language: transcriptionResult.language || 'en',
          status: 'completed',
          completedAt: new Date().toISOString()
        },
        ui: {
          currentMode: 'transcript-edit',
          sidebarWidth: 256,
          playbackSpeed: 1.0,
          volume: 1.0,
          currentTime: 0
        }
      },
      transcription: {
        version: '2.0',
        originalSegments: rawSegments, // Preserve original data
        speakers: speakers || {},
        speakerSegments,
        globalMetadata: {
          totalSegments: rawSegments.length,
          totalWords: allWords.length,
          averageConfidence: this.calculateAverageConfidence(allWords),
          processingTime: 0,
          editCount: 0
        }
      },
      speakers: {
        version: '2.0',
        speakers: speakers || {},
        speakerMappings: speakers || {},
        defaultSpeaker: 'Speaker 1'
      },
      clips: {
        version: '2.0',
        clips,
        clipSettings: {
          defaultDuration: 10,
          autoExport: false,
          exportFormat: 'mp3',
          grouping: {
            pauseThreshold: SPACER_THRESHOLD_SECONDS,
            maxClipDuration: MAX_CLIP_DURATION,
            minWordsPerClip: 3,
            maxWordsPerClip: 100,
            sentenceTerminators: ['.', '!', '?', '...']
          }
        }
      }
    };

    console.log('[Import][Project] audioPath set', {
      path: audioFilePath,
      exists: !!audioFilePath,
    });
    const totalSegments = clips.reduce((sum, clip) => sum + clip.segments.length, 0);
    console.log('[Import][Project] assembled', {
      clipCount: clips.length,
      segmentCount: totalSegments,
      audioPath: audioFilePath,
      durationSec: audioMetadata?.duration ?? 0,
    });
    console.log('[Import][Complete] success', {
      clipCount: clips.length,
      segmentCount: totalSegments,
    });
    return projectData;
  }

  // ==================== Word Extraction ====================

  /**
   * Extract all words from legacy segments, preserving original timing
   */
  private static extractWordsFromSegments(segments: LegacySegment[]): Word[] {
    const words: Word[] = [];

    for (const segment of segments) {
      if (segment.words && segment.words.length > 0) {
        // Use words from the segment directly
        for (const word of segment.words) {
          words.push({
            start: word.start,
            end: word.end,
            word: word.word,
            score: word.score || 0.9,
            speaker: word.speaker || segment.speaker
          });
        }
      } else {
        // Fallback: create single word from segment text
        words.push({
          start: segment.start,
          end: segment.end,
          word: segment.text,
          score: 0.8,
          speaker: segment.speaker
        });
      }
    }

    // Sort by start time to ensure chronological order
    words.sort((a, b) => a.start - b.start);

    return words;
  }

  private static normalizeWordTimestamps(words: Word[]): Word[] {
    if (!words.length) {
      return words;
    }

    const numeric = words.map((word) => ({
      ...word,
      start: Number(word.start),
      end: Number(word.end),
    }));

    const durations = numeric
      .map((word) => {
        const duration = Number(word.end) - Number(word.start);
        return Number.isFinite(duration) ? Math.max(0, duration) : 0;
      })
      .filter((value) => value > 0)
      .sort((a, b) => a - b);

    const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
    const scale = median > 10 ? 0.001 : 1;

    if (scale === 1) {
      return numeric;
    }

    console.log('[Import][Spacer] Detected millisecond timestamps; converting to seconds', {
      medianSampleMs: Number(median.toFixed(2)),
    });

    return numeric.map((word) => ({
      ...word,
      start: Number((word.start * scale).toFixed(6)),
      end: Number((word.end * scale).toFixed(6)),
    }));
  }

  // ==================== Clip Creation ====================

  /**
   * Create clips with segment arrays from words
   */
  private static createClipsFromWords(words: Word[], speakerMap: { [key: string]: string }): Clip[] {
    if (words.length === 0) return [];

    const clips: Clip[] = [];
    let currentSpeaker: string | null = null;
    let currentWords: Word[] = [];
    let clipStartTime = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordSpeaker = word.speaker || 'Unknown';

      const shouldStartNewClip =
        currentWords.length === 0 ||
        currentSpeaker !== wordSpeaker ||
        this.getWordGroupDuration(currentWords) >= MAX_CLIP_DURATION;

      if (shouldStartNewClip) {
        if (currentWords.length > 0) {
          const clip = this.createClipFromWords(currentWords, clipStartTime, currentSpeaker!, clips.length);
          clips.push(clip);
        }

        currentSpeaker = wordSpeaker;
        currentWords = [word];
        clipStartTime = word.start;
        continue;
      }

      const previousWord = currentWords[currentWords.length - 1];
      const gapDuration = word.start - previousWord.end;

      if (gapDuration >= SPACER_THRESHOLD_SECONDS) {
        console.log('[Import][Gap]', {
          clipOrder: clips.length,
          speaker: currentSpeaker,
          prevToken: previousWord.word,
          nextToken: word.word,
          prevEnd: Number(previousWord.end.toFixed(3)),
          nextStart: Number(word.start.toFixed(3)),
          gapSec: Number(gapDuration.toFixed(3)),
          thresholdSec: Number(SPACER_THRESHOLD_SECONDS.toFixed(3)),
          decision: 'spacer',
        });
      }

      currentWords.push(word);
    }

    // Finish final clip
    if (currentWords.length > 0) {
      const clip = this.createClipFromWords(currentWords, clipStartTime, currentSpeaker!, clips.length);
      clips.push(clip);
    }

    console.log('[Import][Clip] build complete', { clipCount: clips.length });
    return clips;
  }

  /**
   * Create a single clip with proper segment array from words
   */
  private static createClipFromWords(words: Word[], clipStartTime: number, speaker: string, order: number): Clip {
    let segments: Segment[] = [];
    let currentTime = 0; // Clip-relative time

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const nextWord = i < words.length - 1 ? words[i + 1] : null;

      // Create word segment (clip-relative timing)
      const wordStart = word.start - clipStartTime;
      const wordEnd = word.end - clipStartTime;

      const wordSegment = createWordSegment(
        word.word,
        wordStart,
        wordEnd,
        word.score,
        word.start, // originalStart (absolute time)
        word.end    // originalEnd (absolute time)
      );

      segments.push(wordSegment);
      currentTime = wordEnd;

      // Check for gap to next word
      if (nextWord) {
        const nextStartAbs = Number(nextWord.start);
        const currentEndAbs = Number(word.end);
        const gapRaw = nextStartAbs - currentEndAbs;
        const gapDuration = Number.isFinite(gapRaw) ? gapRaw : 0;
        const sanitizedGap = gapDuration > 0 ? Number(gapDuration.toFixed(6)) : 0;
        const decision =
          sanitizedGap >= SPACER_THRESHOLD_SECONDS
            ? 'spacer'
            : sanitizedGap > 0
            ? 'micro-spacer'
            : 'contiguous';

        console.log('[Import][Gap]', {
          prevToken: word.word,
          nextToken: nextWord.word,
          prevEnd: Number(word.end.toFixed(3)),
          nextStart: Number(nextWord.start.toFixed(3)),
          gapSec: Number(sanitizedGap.toFixed(3)),
          thresholdSec: Number(SPACER_THRESHOLD_SECONDS.toFixed(3)),
          clipOrder: order,
          speaker,
          rawGap: Number.isFinite(gapRaw) ? Number(gapRaw.toFixed(6)) : null,
          decision,
        });

        if (sanitizedGap >= SPACER_THRESHOLD_SECONDS) {
          const spacerStart = wordEnd;
          const spacerEnd = spacerStart + sanitizedGap;
          const spacerSegment = createSpacerSegment(
            spacerStart,
            spacerEnd,
            `${sanitizedGap.toFixed(1)}s`
          );

          segments.push(spacerSegment);
          console.log('[Import][Spacer] segment created', {
            start: Number(spacerSegment.start.toFixed(3)),
            end: Number(spacerSegment.end.toFixed(3)),
            duration: Number(spacerSegment.duration.toFixed(3)),
            label: spacerSegment.label,
            clipOrder: order,
            speaker,
            kind: 'gap',
          });
          currentTime = spacerEnd;
          // counted after normalization in summary logs
        } else if (sanitizedGap > 0) {
          const spacerStart = wordEnd;
          const spacerEnd = spacerStart + sanitizedGap;
          const spacerSegment = createSpacerSegment(
            spacerStart,
            spacerEnd,
            `${sanitizedGap.toFixed(2)}s`
          );

          segments.push(spacerSegment);
          console.log('[Import][Spacer] segment created', {
            start: Number(spacerSegment.start.toFixed(3)),
            end: Number(spacerSegment.end.toFixed(3)),
            duration: Number(spacerSegment.duration.toFixed(3)),
            label: spacerSegment.label,
            clipOrder: order,
            speaker,
            kind: 'micro-gap',
          });
          currentTime = spacerEnd;
          // counted after normalization in summary logs
        } else if (sanitizedGap === 0) {
          const spacerSegment = createSpacerSegment(wordEnd, wordEnd, '0.00s');
          segments.push(spacerSegment);
          console.log('[Import][Spacer] segment created', {
            start: Number(spacerSegment.start.toFixed(3)),
            end: Number(spacerSegment.end.toFixed(3)),
            duration: Number(spacerSegment.duration.toFixed(3)),
            label: spacerSegment.label,
            clipOrder: order,
            speaker,
            kind: 'contiguous',
          });
        }
      }
    }
    const normalization = normalizeSegmentsForImport(segments);
    segments = normalization.segments;

    try {
      validateNormalizedSegments(segments);
    } catch (error) {
      if (error instanceof ImportValidationError) {
        throw error;
      }
      throw new ImportValidationError('Segment validation failed', []);
    }

    const clipDuration = segments.length > 0 ? segments[segments.length - 1].end : currentTime;

    const validation = validateSegments(segments, clipDuration, {
      isImport: true,
      spacerThreshold: SPACER_THRESHOLD_SECONDS
    });
    if (!validation.isValid) {
      console.warn('[Import][Validate] post-normalize warnings', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('[Import][Validate] post-normalize warnings', validation.warnings);
    }

    const clip: Clip = {
      id: this.generateId(),
      speaker,
      startTime: clipStartTime,
      endTime: clipStartTime + clipDuration,
      duration: clipDuration,
      segments,
      type: 'transcribed',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      order,
      status: 'active'
    };
    return clip;
  }

  // ==================== Utilities ====================

  private static getWordGroupDuration(words: Word[]): number {
    if (words.length === 0) return 0;
    return words[words.length - 1].end - words[0].start;
  }

  private static calculateAverageConfidence(words: Word[]): number {
    if (words.length === 0) return 0;
    const totalConfidence = words.reduce((sum, word) => sum + word.score, 0);
    return totalConfidence / words.length;
  }

  private static extractFileName(filePath: string): string {
    return filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
  }

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Migration Utilities ====================

  /**
   * Convert old token-based clips to new segment-based clips
   * @deprecated Only for migration purposes
   */
  public static migrateTokensToSegments(legacyClip: any): Clip {
    const segments: Segment[] = [];
    let currentTime = 0;

    if (legacyClip.tokens) {
      // Convert tokens to segments
      for (const token of legacyClip.tokens) {
        if (token.kind === 'word') {
          const wordSegment = createWordSegment(
            token.text,
            currentTime,
            currentTime + (token.end - token.start),
            token.score || 0.8,
            token.start,
            token.end
          );
          segments.push(wordSegment);
          currentTime = wordSegment.end;
        } else if (token.kind === 'gap') {
          const spacerSegment = createSpacerSegment(
            currentTime,
            currentTime + (token.end - token.start),
            token.label
          );
          segments.push(spacerSegment);
          currentTime = spacerSegment.end;
        }
      }
    } else if (legacyClip.words) {
      // Convert words to segments
      for (const word of legacyClip.words) {
        const wordSegment = createWordSegment(
          word.word,
          currentTime,
          currentTime + (word.end - word.start),
          word.score || 0.8,
          word.start,
          word.end
        );
        segments.push(wordSegment);
        currentTime = wordSegment.end;
      }
    }

    return {
      id: legacyClip.id,
      speaker: legacyClip.speaker,
      startTime: legacyClip.startTime,
      endTime: legacyClip.endTime,
      duration: legacyClip.duration,
      segments,
      type: legacyClip.type,
      createdAt: legacyClip.createdAt,
      modifiedAt: Date.now(),
      order: legacyClip.order,
      status: legacyClip.status || 'active'
    };
  }

  /**
   * Validate imported project data
   */
  public static validateImportedProject(projectData: ProjectData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check version
    if (projectData.version !== '2.0') {
      errors.push(`Unsupported project version: ${projectData.version}`);
    }

    // Validate clips
    for (const clip of projectData.clips.clips) {
      const validation = validateSegments(clip.segments, clip.duration);
      if (!validation.isValid) {
        errors.push(`Clip ${clip.id} validation failed: ${validation.errors.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}