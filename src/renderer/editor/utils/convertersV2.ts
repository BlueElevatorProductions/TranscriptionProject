/**
 * Converters v2.0 - Convert between segment-based clips and Lexical editor state
 *
 * This replaces the old word/token-based converters with the new segment model.
 * Key features:
 * - Uses Segment union type (WordSegment | SpacerSegment)
 * - Handles clip-relative timing
 * - Preserves original timestamps for debugging
 * - Supports segment-based editing operations
 */

import {
  $createParagraphNode,
  $getRoot,
  EditorState,
  LexicalEditor,
  ParagraphNode,
  $createTextNode,
  LexicalNode,
  createEditor,
} from 'lexical';

import {
  Clip,
  Segment,
  WordSegment,
  SpacerSegment
} from '../../../shared/types';

import { WordNodeV2, $createWordNodeV2, $isWordNodeV2 } from '../nodes/WordNodeV2';
import { SpacerNodeV2, $createSpacerNodeV2, $isSpacerNodeV2 } from '../nodes/SpacerNodeV2';
import { ClipNodeV2, $createClipNodeV2, $isClipNodeV2 } from '../nodes/ClipNodeV2';

// ==================== Types ====================

export interface ConversionOptionsV2 {
  includeSpacers?: boolean;           // Whether to render spacer segments as nodes
  spacerThreshold?: number;           // Minimum spacer duration to render (seconds)
  readOnly?: boolean;                 // Listen mode vs Edit mode
  currentTime?: number;               // For highlighting active segments
  getSpeakerDisplayName?: (speakerId: string) => string;
  getSpeakerColor?: (speakerId: string) => string | undefined;
}

export interface SegmentNodeInfo {
  clipId: string;
  segmentIndex: number;
  segment: Segment;
  isActive?: boolean;  // Currently playing/highlighted
}

export interface EditorToClipsResult {
  clips: Clip[];
  hasChanges: boolean;
}

// ==================== Clips to Editor State ====================

/**
 * Convert segment-based clips to Lexical EditorState
 */
export function clipsToEditorStateV2(
  clips: Clip[],
  options: ConversionOptionsV2 = {}
): EditorState {
  const {
    includeSpacers = true,
    spacerThreshold = 1.0,
    readOnly = false,
    currentTime,
    getSpeakerDisplayName = (id) => id,
    getSpeakerColor
  } = options;

  // Create a temporary editor to generate the state
  const tempEditor = createEditor({
    nodes: [WordNodeV2, SpacerNodeV2, ClipNodeV2]
  });

  return tempEditor.getEditorState().read(() => {
    const root = $getRoot();
    root.clear();

    // Sort clips by order
    const sortedClips = [...clips]
      .filter(clip => clip.status === 'active')
      .sort((a, b) => a.order - b.order);

    for (const clip of sortedClips) {
      const clipNode = $createClipNodeV2({
        clipId: clip.id,
        speaker: clip.speaker,
        displayName: getSpeakerDisplayName(clip.speaker),
        color: getSpeakerColor?.(clip.speaker),
        startTime: clip.startTime,
        endTime: clip.endTime,
        readOnly
      });

      // Add segments to clip
      const paragraph = $createParagraphNode();

      for (let i = 0; i < clip.segments.length; i++) {
        const segment = clip.segments[i];
        const absoluteStartTime = clip.startTime + segment.start;
        const absoluteEndTime = clip.startTime + segment.end;

        // Check if this segment is currently active
        const isActive = currentTime !== undefined &&
          currentTime >= absoluteStartTime &&
          currentTime < absoluteEndTime;

        if (segment.type === 'word') {
          const wordSegment = segment as WordSegment;
          const wordNode = $createWordNodeV2({
            word: wordSegment.text,
            start: absoluteStartTime,
            end: absoluteEndTime,
            originalStart: wordSegment.originalStart,
            originalEnd: wordSegment.originalEnd,
            confidence: wordSegment.confidence,
            clipId: clip.id,
            segmentIndex: i,
            isActive
          });

          paragraph.append(wordNode);

          // Add space after word (except for last word in clip)
          if (i < clip.segments.length - 1) {
            paragraph.append($createTextNode(' '));
          }

        } else if (segment.type === 'spacer' && includeSpacers) {
          const spacerSegment = segment as SpacerSegment;

          // Only render spacers above threshold
          if (spacerSegment.duration >= spacerThreshold) {
            const spacerNode = $createSpacerNodeV2({
              start: absoluteStartTime,
              end: absoluteEndTime,
              duration: spacerSegment.duration,
              label: spacerSegment.label || `${spacerSegment.duration.toFixed(1)}s`,
              clipId: clip.id,
              segmentIndex: i,
              isActive
            });

            paragraph.append(spacerNode);
          }
        }
      }

      clipNode.append(paragraph);
      root.append(clipNode);
    }

    return root.getEditorState();
  });
}

// ==================== Editor State to Clips ====================

/**
 * Convert Lexical EditorState back to segment-based clips
 */
export function editorStateToClipsV2(
  editorState: EditorState,
  originalClips: Clip[]
): EditorToClipsResult {
  const result: EditorToClipsResult = {
    clips: [],
    hasChanges: false
  };

  editorState.read(() => {
    const root = $getRoot();
    const children = root.getChildren();

    for (const node of children) {
      if ($isClipNodeV2(node)) {
        const clipNode = node as ClipNodeV2;
        const clipId = clipNode.getClipId();

        // Find original clip for reference
        const originalClip = originalClips.find(c => c.id === clipId);
        if (!originalClip) continue;

        // Extract segments from clip node
        const newSegments = extractSegmentsFromClipNode(clipNode, originalClip);

        // Check if segments have changed
        const segmentsChanged = !segmentsEqual(newSegments, originalClip.segments);
        if (segmentsChanged) {
          result.hasChanges = true;
        }

        // Create updated clip
        const updatedClip: Clip = {
          ...originalClip,
          segments: newSegments,
          modifiedAt: segmentsChanged ? Date.now() : originalClip.modifiedAt
        };

        result.clips.push(updatedClip);
      }
    }
  });

  return result;
}

// ==================== Segment Extraction ====================

/**
 * Extract segments from a ClipNode
 */
function extractSegmentsFromClipNode(clipNode: ClipNodeV2, originalClip: Clip): Segment[] {
  const segments: Segment[] = [];
  let currentTime = 0;

  // Get paragraph node containing segments
  const paragraph = clipNode.getFirstChild() as ParagraphNode;
  if (!paragraph) return originalClip.segments; // Fallback to original

  const children = paragraph.getChildren();

  for (const child of children) {
    if ($isWordNodeV2(child)) {
      const wordNode = child as WordNodeV2;
      const segmentIndex = wordNode.getSegmentIndex();
      const originalSegment = originalClip.segments[segmentIndex];

      if (originalSegment && originalSegment.type === 'word') {
        const originalWordSegment = originalSegment as WordSegment;

        // Check if text was edited
        const currentText = wordNode.getWord();
        const hasTextChanged = currentText !== originalWordSegment.text;

        const updatedSegment: WordSegment = {
          ...originalWordSegment,
          text: currentText,
          // Keep original timing unless we implement time adjustment
          start: originalWordSegment.start,
          end: originalWordSegment.end
        };

        segments.push(updatedSegment);
      }

    } else if ($isSpacerNodeV2(child)) {
      const spacerNode = child as any; // Type assertion for spacer node
      const segmentIndex = spacerNode.getSegmentIndex();
      const originalSegment = originalClip.segments[segmentIndex];

      if (originalSegment && originalSegment.type === 'spacer') {
        // Spacer segments typically don't change in the editor
        segments.push(originalSegment);
      }
    }
  }

  return segments;
}

// ==================== Utilities ====================

/**
 * Check if two segment arrays are equal
 */
function segmentsEqual(segments1: Segment[], segments2: Segment[]): boolean {
  if (segments1.length !== segments2.length) return false;

  for (let i = 0; i < segments1.length; i++) {
    const seg1 = segments1[i];
    const seg2 = segments2[i];

    if (seg1.type !== seg2.type) return false;
    if (Math.abs(seg1.start - seg2.start) > 0.001) return false;
    if (Math.abs(seg1.end - seg2.end) > 0.001) return false;

    if (seg1.type === 'word' && seg2.type === 'word') {
      const word1 = seg1 as WordSegment;
      const word2 = seg2 as WordSegment;
      if (word1.text !== word2.text) return false;
    }
  }

  return true;
}

/**
 * Find active segment at given time
 */
export function findActiveSegment(
  clips: Clip[],
  currentTime: number
): SegmentNodeInfo | null {
  for (const clip of clips) {
    if (clip.status !== 'active') continue;

    if (currentTime >= clip.startTime && currentTime < clip.endTime) {
      const clipRelativeTime = currentTime - clip.startTime;

      for (let i = 0; i < clip.segments.length; i++) {
        const segment = clip.segments[i];

        if (clipRelativeTime >= segment.start && clipRelativeTime < segment.end) {
          return {
            clipId: clip.id,
            segmentIndex: i,
            segment,
            isActive: true
          };
        }
      }
    }
  }

  return null;
}

/**
 * Get total word count from clips
 */
export function getWordCount(clips: Clip[]): number {
  return clips.reduce((total, clip) => {
    if (clip.status !== 'active') return total;

    return total + clip.segments.filter(seg => seg.type === 'word').length;
  }, 0);
}

/**
 * Get total duration from clips
 */
export function getTotalDuration(clips: Clip[]): number {
  const activeClips = clips.filter(clip => clip.status === 'active');
  if (activeClips.length === 0) return 0;

  const sortedClips = activeClips.sort((a, b) => a.order - b.order);
  const lastClip = sortedClips[sortedClips.length - 1];

  return lastClip.endTime;
}

/**
 * Get speaker statistics
 */
export function getSpeakerStats(clips: Clip[]): { [speaker: string]: { duration: number; wordCount: number } } {
  const stats: { [speaker: string]: { duration: number; wordCount: number } } = {};

  for (const clip of clips) {
    if (clip.status !== 'active') continue;

    if (!stats[clip.speaker]) {
      stats[clip.speaker] = { duration: 0, wordCount: 0 };
    }

    stats[clip.speaker].duration += clip.duration;
    stats[clip.speaker].wordCount += clip.segments.filter(seg => seg.type === 'word').length;
  }

  return stats;
}

// ==================== Migration Helpers ====================

/**
 * Convert legacy segments to new clip format
 * @deprecated Only for migration from old format
 */
export function migrateLegacySegments(legacySegments: any[]): Clip[] {
  // This would be implemented for migrating existing projects
  // For now, return empty array since we're starting fresh
  return [];
}

/**
 * Debug utility to log clip structure
 */
export function debugLogClips(clips: Clip[]): void {
  console.group('🎬 Clips Debug Info');

  for (const clip of clips) {
    console.group(`Clip ${clip.id.slice(-6)} (${clip.speaker})`);
    console.log(`Duration: ${clip.duration.toFixed(2)}s`);
    console.log(`Status: ${clip.status}`);
    console.log(`Segments: ${clip.segments.length}`);

    for (let i = 0; i < clip.segments.length; i++) {
      const segment = clip.segments[i];
      const duration = segment.end - segment.start;

      if (segment.type === 'word') {
        const word = segment as WordSegment;
        console.log(`  [${i}] word: "${word.text}" (${duration.toFixed(2)}s)`);
      } else {
        const spacer = segment as SpacerSegment;
        console.log(`  [${i}] spacer: ${spacer.label} (${duration.toFixed(2)}s)`);
      }
    }

    console.groupEnd();
  }

  console.groupEnd();
}