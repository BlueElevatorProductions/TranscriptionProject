/**
 * TranscriptionProject v2.0 - Edit Operations
 * Atomic operations for project state changes
 */

import {
  EditOperation,
  EditOperationType,
  EditOperationData,
  Clip,
  Segment,
  WordSegment,
  SpacerSegment,
  ValidationResult
} from './types';

// ==================== Operation Creators ====================

export function createSplitClipOperation(clipId: string, segmentIndex: number): EditOperation {
  return {
    id: `split-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'splitClip',
    timestamp: Date.now(),
    data: { clipId, segmentIndex }
  };
}

export function createMergeClipsOperation(clipIds: string[]): EditOperation {
  return {
    id: `merge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'mergeClips',
    timestamp: Date.now(),
    data: { clipIds }
  };
}

export function createDeleteClipOperation(clipId: string): EditOperation {
  return {
    id: `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'deleteClip',
    timestamp: Date.now(),
    data: { clipId }
  };
}

export function createReorderClipsOperation(clipId: string, newOrder: number): EditOperation {
  return {
    id: `reorder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'reorderClips',
    timestamp: Date.now(),
    data: { clipId, newOrder }
  };
}

export function createInsertSpacerOperation(clipId: string, segmentIndex: number, duration: number): EditOperation {
  return {
    id: `spacer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'insertSpacer',
    timestamp: Date.now(),
    data: { clipId, segmentIndex, duration }
  };
}

export function createEditWordOperation(clipId: string, segmentIndex: number, newText: string): EditOperation {
  return {
    id: `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'editWord',
    timestamp: Date.now(),
    data: { clipId, segmentIndex, newText }
  };
}

export function createChangeSpeakerOperation(clipId: string, newSpeaker: string): EditOperation {
  return {
    id: `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'changeSpeaker',
    timestamp: Date.now(),
    data: { clipId, newSpeaker }
  };
}

export function createRenameSpeakerOperation(oldSpeakerName: string, newSpeakerName: string): EditOperation {
  return {
    id: `rename-speaker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'renameSpeaker',
    timestamp: Date.now(),
    data: { oldSpeakerName, newSpeakerName }
  };
}

// ==================== Segment Utilities ====================

/**
 * Create a word segment from transcription data
 */
export function createWordSegment(
  text: string,
  start: number,
  end: number,
  confidence: number,
  originalStart?: number,
  originalEnd?: number
): WordSegment {
  return {
    type: 'word',
    id: `word-${start.toFixed(3)}-${Math.random().toString(36).substr(2, 6)}`,
    start,
    end,
    text,
    confidence,
    originalStart: originalStart ?? start,
    originalEnd: originalEnd ?? end
  };
}

/**
 * Create a spacer segment for gaps
 */
export function createSpacerSegment(
  start: number,
  end: number,
  label?: string
): SpacerSegment {
  const safeStart = Number.isFinite(start) ? Number(start) : 0;
  const safeEnd = Number.isFinite(end) ? Number(end) : safeStart;
  const sanitizedStart = Number(safeStart.toFixed(6));
  const rawDuration = safeEnd - safeStart;
  const sanitizedDuration = Number(Math.max(0, rawDuration).toFixed(6));
  const sanitizedEnd = Number((sanitizedStart + sanitizedDuration).toFixed(6));

  const spacer: SpacerSegment = {
    type: 'spacer',
    id: `spacer-${sanitizedStart.toFixed(3)}-${Math.random().toString(36).substr(2, 6)}`,
    start: sanitizedStart,
    end: sanitizedEnd,
    duration: sanitizedDuration,
    label
  };

  const logPayload = {
    label,
    raw: {
      start: safeStart,
      end: safeEnd,
      duration: Number(rawDuration.toFixed(6)),
    },
    sanitized: {
      start: sanitizedStart,
      end: sanitizedEnd,
      duration: sanitizedDuration,
    },
  };

  if (sanitizedDuration === 0) {
    console.log('[Spacer] zero-duration segment sanitized', logPayload);
  } else {
    console.log('[Spacer] segment created', logPayload);
  }

  return spacer;
}

/**
 * Validate that segments maintain required invariants
 */
export function validateSegments(segments: Segment[], clipDuration: number, options: { isImport?: boolean; spacerThreshold?: number } = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for finite times
  let finiteTimes = true;
  segments.forEach((segment, index) => {
    if (!isFinite(segment.start) || !isFinite(segment.end)) {
      errors.push(`Segment ${index} has invalid start/end times`);
      finiteTimes = false;
    }
  });

  // Check chronological order
  let chronologicalOrder = true;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].start < segments[i-1].end) {
      errors.push(`Segment ${i} starts before previous segment ends`);
      chronologicalOrder = false;
    }
  }

  // Check for overlaps
  let noOverlaps = true;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].start < segments[i-1].end) {
      errors.push(`Segments ${i-1} and ${i} overlap`);
      noOverlaps = false;
    }
  }

  // Check complete coverage
  let completeCoverage = true;
  if (segments.length === 0) {
    if (clipDuration > 0) {
      errors.push('No segments but clip has duration');
      completeCoverage = false;
    }
  } else {
    // Use more lenient tolerance during import to allow for transcription timing issues
    const epsilon = options.isImport && options.spacerThreshold ?
      Math.min(options.spacerThreshold, 0.1) : // Allow gaps up to spacer threshold (max 0.1s)
      0.001; // Standard 1ms tolerance for normal operation

    if (Math.abs(segments[0].start) > epsilon) {
      errors.push(`First segment starts at ${segments[0].start}, should start at 0`);
      completeCoverage = false;
    }
    if (Math.abs(segments[segments.length - 1].end - clipDuration) > epsilon) {
      errors.push(`Last segment ends at ${segments[segments.length - 1].end}, should end at ${clipDuration}`);
      completeCoverage = false;
    }

    // Check for gaps between segments
    for (let i = 1; i < segments.length; i++) {
      const gap = segments[i].start - segments[i-1].end;
      if (gap > epsilon) {
        const message = `Gap of ${gap}s between segments ${i-1} and ${i}`;
        if (options.isImport && gap < (options.spacerThreshold || 1.0)) {
          // During import, treat small gaps as warnings rather than errors
          warnings.push(message);
        } else {
          errors.push(message);
          completeCoverage = false;
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    invariants: {
      completeCoverage,
      noOverlaps,
      chronologicalOrder,
      finiteTimes
    }
  };
}

export interface SegmentNormalizationResult {
  segments: Segment[];
  trimmedCount: number;
  shiftedCount: number;
  removedCount: number;
}

export interface SegmentValidationFailure {
  reason: 'order' | 'negative-duration' | 'overlap';
  index: number;
  prev?: { idx: number; start: number; end: number; text?: string };
  curr: { idx: number; start: number; end: number; text?: string };
}

export class ImportValidationError extends Error {
  public readonly failures: SegmentValidationFailure[];

  constructor(message: string, failures: SegmentValidationFailure[]) {
    super(message);
    this.name = 'ImportValidationError';
    this.failures = failures;
  }
}

function cloneSegmentForNormalization(segment: Segment): Segment {
  if (segment.type === 'spacer') {
    return { ...segment };
  }
  return { ...segment };
}

function sanitizeTime(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return Number(value);
}

function refreshSpacerDuration(segment: Segment): void {
  if (segment.type === 'spacer') {
    segment.duration = Number(Math.max(0, segment.end - segment.start).toFixed(6));
  }
}

export function normalizeSegmentsForImport(rawSegments: Segment[]): SegmentNormalizationResult {
  const sorted = rawSegments.map(cloneSegmentForNormalization).sort((a, b) => sanitizeTime(a.start) - sanitizeTime(b.start));
  const normalized: Segment[] = [];

  let trimmedCount = 0;
  let shiftedCount = 0;
  let removedCount = 0;

  sorted.forEach((segment, index) => {
    const sanitizedStart = sanitizeTime(segment.start);
    const sanitizedEndRaw = sanitizeTime(segment.end);
    const sanitizedEnd = sanitizedEndRaw >= sanitizedStart ? sanitizedEndRaw : sanitizedStart;

    const safeSegment: Segment = {
      ...segment,
      start: Number(sanitizedStart.toFixed(6)),
      end: Number(sanitizedEnd.toFixed(6)),
    } as Segment;

    if (safeSegment.type === 'spacer') {
      safeSegment.duration = Number(Math.max(0, safeSegment.end - safeSegment.start).toFixed(6));
    }

    const previous = normalized[normalized.length - 1];
    if (previous) {
      const overlap = safeSegment.start - previous.end;
      if (overlap < 0) {
        const canTrimPrevious = overlap >= -0.005;
        if (canTrimPrevious) {
          const prevEndOld = previous.end;
          previous.end = Number(Math.max(previous.start, safeSegment.start).toFixed(6));
          refreshSpacerDuration(previous);
          trimmedCount += 1;
          console.log('[Import][Normalize] trimmed', {
            index: normalized.length - 1,
            prevEndOld: Number(prevEndOld.toFixed(6)),
            prevEndNew: previous.end,
            nextStart: safeSegment.start,
          });
        } else {
          const startOld = safeSegment.start;
          safeSegment.start = Number(previous.end.toFixed(6));
          if (safeSegment.end < safeSegment.start) {
            safeSegment.end = safeSegment.start;
          }
          refreshSpacerDuration(safeSegment);
          shiftedCount += 1;
          console.log('[Import][Normalize] shifted', {
            index,
            startOld: Number(startOld.toFixed(6)),
            startNew: safeSegment.start,
            prevEnd: previous.end,
          });
        }
      }
    }

    const duration = safeSegment.end - safeSegment.start;
    if (duration < 1e-6) {
      removedCount += 1;
      console.log('[Import][Normalize] removed', {
        index,
        reason: 'zero-duration',
        start: safeSegment.start,
        end: safeSegment.end,
      });
      return;
    }

    normalized.push(safeSegment);
  });

  console.log('[Import][Normalize] summary', {
    trimmedCount,
    shiftedCount,
    removedCount,
    totalSegments: normalized.length,
  });

  return {
    segments: normalized,
    trimmedCount,
    shiftedCount,
    removedCount,
  };
}

export function validateNormalizedSegments(segments: Segment[]): void {
  const failures: SegmentValidationFailure[] = [];

  for (let i = 0; i < segments.length; i++) {
    const curr = segments[i];
    if (curr.end < curr.start) {
      failures.push({
        reason: 'negative-duration',
        index: i,
        curr: { idx: i, start: curr.start, end: curr.end, text: (curr as WordSegment).text },
      });
      continue;
    }

    if (i > 0) {
      const prev = segments[i - 1];
      if (curr.start < prev.end) {
        failures.push({
          reason: 'overlap',
          index: i,
          prev: { idx: i - 1, start: prev.start, end: prev.end, text: (prev as WordSegment).text },
          curr: { idx: i, start: curr.start, end: curr.end, text: (curr as WordSegment).text },
        });
      }
      if (curr.start < prev.start) {
        failures.push({
          reason: 'order',
          index: i,
          prev: { idx: i - 1, start: prev.start, end: prev.end, text: (prev as WordSegment).text },
          curr: { idx: i, start: curr.start, end: curr.end, text: (curr as WordSegment).text },
        });
      }
    }
  }

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error('[Import][Validate] fail', {
        reason: failure.reason,
        at: failure.index,
        prev: failure.prev,
        curr: failure.curr,
      });
    });
    throw new ImportValidationError('Segment validation failed', failures);
  }
}

/**
 * Get total text from segments (words only)
 */
export function getSegmentText(segments: Segment[]): string {
  return segments
    .filter((segment): segment is WordSegment => segment.type === 'word')
    .map(segment => segment.text)
    .join(' ');
}

/**
 * Find segment at a specific time
 */
export function findSegmentAtTime(segments: Segment[], time: number): Segment | null {
  // Binary search for efficiency
  let left = 0;
  let right = segments.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const segment = segments[mid];

    if (time >= segment.start && time < segment.end) {
      return segment;
    } else if (time < segment.start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
}

/**
 * Convert clip-relative time to absolute timeline time
 */
export function clipTimeToAbsolute(clipStartTime: number, clipRelativeTime: number): number {
  return clipStartTime + clipRelativeTime;
}

/**
 * Convert absolute timeline time to clip-relative time
 */
export function absoluteTimeToClip(clipStartTime: number, absoluteTime: number): number {
  return absoluteTime - clipStartTime;
}