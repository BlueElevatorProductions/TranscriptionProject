/**
 * EDLBuilderService v2.0 - Clean JUCE integration
 *
 * This service builds Edit Decision Lists (EDLs) for the JUCE audio backend
 * with segment-aware metadata and efficient binary search support.
 *
 * Key features:
 * - Pure function design with no side effects
 * - Includes segment metadata for highlighting
 * - Binary search optimization for large projects
 * - Clear original-to-edited time mapping
 * - Validation of EDL consistency
 */

import {
  Clip,
  Segment,
  WordSegment
} from '../../shared/types';

// ==================== EDL Types ====================

export interface EdlClip {
  id: string;
  startSec: number;           // Contiguous timeline position
  endSec: number;             // Contiguous timeline position
  originalStartSec: number;   // Original audio file position
  originalEndSec: number;     // Original audio file position
  type: 'speech' | 'audio-only';
  speaker?: string;

  // V2.0 segment metadata for highlighting
  segments?: EdlSegment[];
  segmentBoundaries?: number[]; // Optimized lookup for binary search
}

export interface EdlSegment {
  type: 'word' | 'spacer';
  startSec: number;    // Relative to clip start
  endSec: number;      // Relative to clip start
  text?: string;       // For word segments
  originalStartSec?: number; // Original timing (for debugging)
  originalEndSec?: number;   // Original timing (for debugging)
}

export interface EdlMetadata {
  totalDuration: number;
  clipCount: number;
  segmentCount: number;
  hasReordering: boolean;
  generatedAt: number;
}

export interface EdlResult {
  clips: EdlClip[];
  metadata: EdlMetadata;
  lookupTable: SegmentLookupTable;
}

export interface SegmentLookupTable {
  boundaries: number[];  // Sorted segment boundary times
  segments: SegmentLookupEntry[];
}

export interface SegmentLookupEntry {
  clipId: string;
  segmentIndex: number;
  startTime: number;
  endTime: number;
  type: 'word' | 'spacer';
  text?: string;
}

// ==================== EDL Builder Service ====================

export class EDLBuilderService {
  /**
   * Build EDL for JUCE backend with segment metadata
   */
  public static buildEDL(clips: Clip[]): EdlResult {
    console.log('🎬 Building EDL for', clips.length, 'clips');

    // Filter active clips and sort by order
    const activeClips = clips
      .filter(clip => clip.status === 'active')
      .sort((a, b) => a.order - b.order);

    // Detect if clips are reordered from original timeline
    const hasReordering = this.detectReordering(activeClips);

    // Build contiguous timeline
    const edlClips = this.buildContiguousTimeline(activeClips, hasReordering);

    // Build segment lookup table for efficient searches
    const lookupTable = this.buildSegmentLookupTable(edlClips);

    // Calculate metadata
    const metadata: EdlMetadata = {
      totalDuration: edlClips.length > 0 ?
        edlClips[edlClips.length - 1].endSec : 0,
      clipCount: edlClips.length,
      segmentCount: edlClips.reduce((sum, clip) =>
        sum + (clip.segments?.length || 0), 0),
      hasReordering,
      generatedAt: Date.now()
    };

    console.log('📊 EDL generated:', {
      clips: edlClips.length,
      segments: metadata.segmentCount,
      duration: metadata.totalDuration.toFixed(2) + 's',
      reordered: hasReordering
    });

    return {
      clips: edlClips,
      metadata,
      lookupTable
    };
  }

  // ==================== Timeline Building ====================

  /**
   * Detect if clips are reordered from their original timeline
   */
  private static detectReordering(clips: Clip[]): boolean {
    if (clips.length < 2) return false;

    for (let i = 1; i < clips.length; i++) {
      // If any clip starts before the previous clip's original start time,
      // we have reordering
      if (clips[i].startTime < clips[i - 1].startTime) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build contiguous timeline with dual time mapping
   */
  private static buildContiguousTimeline(clips: Clip[], hasReordering: boolean): EdlClip[] {
    const edlClips: EdlClip[] = [];
    let contiguousTime = 0;

    for (const clip of clips) {
      // Convert clip segments to EDL segments
      const edlSegments = this.convertSegmentsToEdl(clip);

      // Build segment boundaries for binary search
      const segmentBoundaries = edlSegments.map(seg => seg.startSec);
      if (edlSegments.length > 0) {
        segmentBoundaries.push(edlSegments[edlSegments.length - 1].endSec);
      }

      const edlClip: EdlClip = {
        id: clip.id,
        startSec: contiguousTime,
        endSec: contiguousTime + clip.duration,
        originalStartSec: clip.startTime,
        originalEndSec: clip.endTime,
        type: 'speech',
        speaker: clip.speaker,
        segments: edlSegments,
        segmentBoundaries
      };

      edlClips.push(edlClip);
      contiguousTime += clip.duration;
    }

    if (hasReordering) {
      console.log('⚡ REORDERED CLIPS DETECTED - Using dual timeline mapping');
      this.logReorderingInfo(edlClips);
    }

    return edlClips;
  }

  /**
   * Convert clip segments to EDL format
   */
  private static convertSegmentsToEdl(clip: Clip): EdlSegment[] {
    return clip.segments.map(segment => {
      const startSec = Number(segment.start) || 0;
      const endSecRaw = Number(segment.end);
      const endSec = Number.isFinite(endSecRaw) ? endSecRaw : startSec;
      const fallbackOriginalStart = clip.startTime + startSec;
      const fallbackOriginalEnd = clip.startTime + endSec;

      const edlSegment: EdlSegment = {
        type: segment.type,
        startSec,
        endSec
      };

      if (segment.type === 'word') {
        const wordSegment = segment as WordSegment;
        edlSegment.text = wordSegment.text;
        edlSegment.originalStartSec = Number.isFinite(wordSegment.originalStart)
          ? wordSegment.originalStart
          : fallbackOriginalStart;
        edlSegment.originalEndSec = Number.isFinite(wordSegment.originalEnd)
          ? wordSegment.originalEnd
          : fallbackOriginalEnd;
      } else {
        edlSegment.originalStartSec = fallbackOriginalStart;
        edlSegment.originalEndSec = fallbackOriginalEnd;
      }

      return edlSegment;
    });
  }

  // ==================== Lookup Table ====================

  /**
   * Build optimized segment lookup table for binary search
   */
  private static buildSegmentLookupTable(edlClips: EdlClip[]): SegmentLookupTable {
    const boundaries: number[] = [];
    const segments: SegmentLookupEntry[] = [];

    for (const clip of edlClips) {
      if (!clip.segments) continue;

      for (let i = 0; i < clip.segments.length; i++) {
        const segment = clip.segments[i];
        const absoluteStart = clip.startSec + segment.startSec;
        const absoluteEnd = clip.startSec + segment.endSec;

        boundaries.push(absoluteStart);

        segments.push({
          clipId: clip.id,
          segmentIndex: i,
          startTime: absoluteStart,
          endTime: absoluteEnd,
          type: segment.type,
          text: segment.text
        });
      }
    }

    // Add final boundary
    if (segments.length > 0) {
      boundaries.push(segments[segments.length - 1].endTime);
    }

    // Remove duplicates and sort
    const uniqueBoundaries = [...new Set(boundaries)].sort((a, b) => a - b);

    return {
      boundaries: uniqueBoundaries,
      segments
    };
  }

  // ==================== Utilities ====================

  /**
   * Find segment at specific time using binary search
   */
  public static findSegmentAtTime(lookupTable: SegmentLookupTable, time: number): SegmentLookupEntry | null {
    const { segments } = lookupTable;

    // Binary search for efficiency
    let left = 0;
    let right = segments.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const segment = segments[mid];

      if (time >= segment.startTime && time < segment.endTime) {
        return segment;
      } else if (time < segment.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return null;
  }

  /**
   * Convert contiguous time to original audio time
   */
  public static contiguousToOriginalTime(edlClips: EdlClip[], contiguousTime: number): number | null {
    // Find the clip containing this time
    for (const clip of edlClips) {
      if (contiguousTime >= clip.startSec && contiguousTime < clip.endSec) {
        const clipRelativeTime = contiguousTime - clip.startSec;
        return clip.originalStartSec + clipRelativeTime;
      }
    }

    return null;
  }

  /**
   * Convert original audio time to contiguous time
   */
  public static originalToContiguousTime(edlClips: EdlClip[], originalTime: number): number | null {
    // Find the clip containing this original time
    for (const clip of edlClips) {
      if (originalTime >= clip.originalStartSec && originalTime < clip.originalEndSec) {
        const clipRelativeTime = originalTime - clip.originalStartSec;
        return clip.startSec + clipRelativeTime;
      }
    }

    return null;
  }

  /**
   * Validate EDL consistency
   */
  public static validateEDL(edlResult: EdlResult): { isValid: boolean; errors: string[] } {
    const { clips } = edlResult;
    const errors: string[] = [];

    // Check contiguous timeline
    for (let i = 1; i < clips.length; i++) {
      const prevClip = clips[i - 1];
      const currentClip = clips[i];

      if (Math.abs(currentClip.startSec - prevClip.endSec) > 0.001) {
        errors.push(`Gap between clips ${prevClip.id} and ${currentClip.id}`);
      }
    }

    // Check clip durations
    for (const clip of clips) {
      const expectedDuration = clip.endSec - clip.startSec;
      const originalDuration = clip.originalEndSec - clip.originalStartSec;

      if (Math.abs(expectedDuration - originalDuration) > 0.001) {
        errors.push(`Duration mismatch for clip ${clip.id}`);
      }
    }

    // Check segment coverage
    for (const clip of clips) {
      if (clip.segments && clip.segments.length > 0) {
        const firstSegment = clip.segments[0];
        const lastSegment = clip.segments[clip.segments.length - 1];
        const clipDuration = clip.endSec - clip.startSec;

        if (Math.abs(firstSegment.startSec) > 0.001) {
          errors.push(`Clip ${clip.id} segments don't start at 0`);
        }

        if (Math.abs(lastSegment.endSec - clipDuration) > 0.001) {
          errors.push(`Clip ${clip.id} segments don't cover full duration`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ==================== Debug Utilities ====================

  private static logReorderingInfo(edlClips: EdlClip[]): void {
    console.log('  Original clip order:',
      edlClips.map((c, i) => `${i}:${c.id.slice(-6)}(${c.originalStartSec.toFixed(1)}-${c.originalEndSec.toFixed(1)}s)`).join(' ')
    );

    console.log('  Contiguous timeline mapping:');
    edlClips.forEach((clip, index) => {
      const segmentCount = clip.segments?.length || 0;
      console.log(`    [${index}] ${clip.id.slice(-6)}: Original(${clip.originalStartSec.toFixed(2)}-${clip.originalEndSec.toFixed(2)}s) → Contiguous(${clip.startSec.toFixed(2)}-${clip.endSec.toFixed(2)}s) [${segmentCount} segments]`);
    });
  }

  /**
   * Get human-readable EDL summary
   */
  public static getEDLSummary(edlResult: EdlResult): string {
    const { clips, metadata } = edlResult;

    const summary = [
      `EDL Summary:`,
      `  Clips: ${metadata.clipCount}`,
      `  Segments: ${metadata.segmentCount}`,
      `  Duration: ${metadata.totalDuration.toFixed(2)}s`,
      `  Reordered: ${metadata.hasReordering ? 'Yes' : 'No'}`,
      `  Generated: ${new Date(metadata.generatedAt).toISOString()}`
    ];

    if (clips.length > 0) {
      summary.push(`  First clip: ${clips[0].id.slice(-6)} (${clips[0].originalStartSec.toFixed(1)}s)`);
      summary.push(`  Last clip: ${clips[clips.length-1].id.slice(-6)} (${clips[clips.length-1].originalEndSec.toFixed(1)}s)`);
    }

    return summary.join('\n');
  }

  /**
   * Convert to format for JUCE backend with segments included
   */
  public static toLegacyFormat(edlResult: EdlResult): any[] {
    return edlResult.clips.map(clip => ({
      id: clip.id,
      startSec: clip.startSec,
      endSec: clip.endSec,
      originalStartSec: clip.originalStartSec,
      originalEndSec: clip.originalEndSec,
      type: clip.type,
      speaker: clip.speaker,
      segments: clip.segments || [], // Include segments for JUCE backend
      segmentBoundaries: clip.segmentBoundaries || [] // Include boundaries for optimization
    }));
  }
}