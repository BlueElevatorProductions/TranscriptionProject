/**
 * TranscriptionImportService v2.0 - Clean segment-based import
 *
 * This service converts raw transcription results into clip-based project data
 * with proper segment arrays, WITHOUT modifying original word timestamps.
 *
 * Key principles:
 * - NEVER modify original word timestamps
 * - Create explicit spacer CLIPS for large gaps ≥1s (prevents EDL timeline compression)
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
  getSegmentText
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
    console.log('🔄 Starting transcription import with segment-based architecture');
    console.log('🎵 Audio file path:', audioFilePath);
    console.log('🎵 Audio metadata:', audioMetadata);

    const { segments: rawSegments, speakers, speakerSegments } = transcriptionResult;

    // Step 1: Convert legacy segments to words with original timing
    const allWords = this.extractWordsFromSegments(rawSegments);
    console.log(`📝 Extracted ${allWords.length} words from ${rawSegments.length} segments`);

    // Step 2: Group words by speaker and create clips
    const clips = this.createClipsFromWords(allWords, speakers || {});
    console.log(`🎬 Created ${clips.length} clips from speaker groups`);

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
      console.log(`📊 Clip[${index}] ${clip.id.slice(-8)} — ${words} words / ${spacers} spacers`);
    });

    if (firstSpacerExample) {
      console.log('🧩 First spacer example:', firstSpacerExample);
    } else {
      console.warn('⚠️ No spacer segments were generated during import.');
    }
    console.log(`📦 Segment totals after import: ${totalWordSegments} words, ${totalSpacerSegments} spacers`);

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

    console.log('✅ Transcription import completed');
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

      // Check if we need to start a new clip
      const hasLargeGap = currentWords.length > 0 &&
        (word.start - currentWords[currentWords.length - 1].end) >= SPACER_THRESHOLD_SECONDS;

      if (currentSpeaker !== wordSpeaker ||
          hasLargeGap ||
          this.getWordGroupDuration(currentWords) >= MAX_CLIP_DURATION) {

        // Finish current clip if we have words
        if (currentWords.length > 0) {
          const clip = this.createClipFromWords(currentWords, clipStartTime, currentSpeaker!, clips.length);
          clips.push(clip);

          // If there's a large gap, create a spacer clip for it
          if (hasLargeGap) {
            const lastWord = currentWords[currentWords.length - 1];
            const gapDuration = word.start - lastWord.end;
            const spacerClip = this.createSpacerClip(
              lastWord.end,        // Start at last word's end
              word.start,          // End at next word's start
              gapDuration,
              clips.length
            );
            clips.push(spacerClip);
            console.log(`🔊 Created spacer clip: ${gapDuration.toFixed(3)}s gap between clips`);
          }
        }

        // Start new clip
        currentSpeaker = wordSpeaker;
        currentWords = [word];
        clipStartTime = word.start;
      } else {
        // Continue current clip
        currentWords.push(word);
      }
    }

    // Finish final clip
    if (currentWords.length > 0) {
      const clip = this.createClipFromWords(currentWords, clipStartTime, currentSpeaker!, clips.length);
      clips.push(clip);
    }

    console.log(`🏗️ Built ${clips.length} clips with segment arrays`);
    return clips;
  }

  /**
   * Create a single clip with proper segment array from words
   */
  private static createClipFromWords(words: Word[], clipStartTime: number, speaker: string, order: number): Clip {
    const segments: Segment[] = [];
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
        const gapDuration = nextWord.start - word.end;

        if (gapDuration >= SPACER_THRESHOLD_SECONDS) {
          // Create spacer segment for significant gap (≥1s)
          // Use clip-relative timing for both start and end
          const spacerStart = wordEnd; // Start right after current word ends (clip-relative)
          const spacerEnd = nextWord.start - clipStartTime; // End when next word starts (clip-relative)

          console.log(`🔍 Creating spacer: gap=${gapDuration.toFixed(3)}s, start=${spacerStart.toFixed(3)}, end=${spacerEnd.toFixed(3)}`);

          const spacerSegment = createSpacerSegment(
            spacerStart,
            spacerEnd,
            `${gapDuration.toFixed(1)}s`
          );

          segments.push(spacerSegment);
          currentTime = spacerEnd;
        } else if (gapDuration > 0) {
          // Small gap - extend current word segment with proportional original timing
          const nextWordClipRelativeStart = nextWord.start - clipStartTime;
          const currentSegment = segments[segments.length - 1] as WordSegment;

          // Calculate proportional scaling to maintain timing ratio
          const originalDuration = currentSegment.originalEnd - currentSegment.originalStart;
          const currentEditedDuration = currentSegment.end - currentSegment.start;
          const newEditedDuration = nextWordClipRelativeStart - currentSegment.start;

          // Scale the original duration proportionally
          const scaleFactor = newEditedDuration / currentEditedDuration;
          const newOriginalEnd = currentSegment.originalStart + (originalDuration * scaleFactor);

          console.log(`🔧 Extending segment: gap=${gapDuration.toFixed(3)}s, scale=${scaleFactor.toFixed(3)}, origEnd=${currentSegment.originalEnd.toFixed(3)}->${newOriginalEnd.toFixed(3)}`);

          segments[segments.length - 1] = {
            ...currentSegment,
            end: nextWordClipRelativeStart,
            originalEnd: newOriginalEnd
          };
          currentTime = nextWordClipRelativeStart;
        }
      }
    }

    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    const clipDuration = currentTime;

    // Validate segments with lenient import mode
    const validation = validateSegments(segments, clipDuration, {
      isImport: true,
      spacerThreshold: SPACER_THRESHOLD_SECONDS
    });
    if (!validation.isValid) {
      console.warn(`⚠️ Clip validation failed:`, validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn(`⚠️ Clip validation warnings:`, validation.warnings);
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

    console.log(`📑 Created clip: ${segments.length} segments, ${clipDuration.toFixed(2)}s duration`);
    return clip;
  }

  // ==================== Utilities ====================

  private static getWordGroupDuration(words: Word[]): number {
    if (words.length === 0) return 0;
    return words[words.length - 1].end - words[0].start;
  }

  /**
   * Create a spacer-only clip for large gaps between words
   */
  private static createSpacerClip(startTime: number, endTime: number, duration: number, order: number): Clip {
    const spacerSegment = createSpacerSegment(0, duration, `${duration.toFixed(1)}s`);

    return {
      id: this.generateId(),
      speaker: 'Silence',
      startTime,
      endTime,
      duration,
      segments: [spacerSegment],
      type: 'transcribed',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      order,
      status: 'active'
    };
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