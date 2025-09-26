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