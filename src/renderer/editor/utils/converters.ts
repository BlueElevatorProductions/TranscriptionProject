/**
 * Converters utility - Convert between segment data and Lexical editor state
 * Handles bidirectional conversion for transcript editing
 */

import {
  $createParagraphNode,
  $getRoot,
  EditorState,
  LexicalEditor,
  ParagraphNode,
  $createTextNode,
  LexicalNode,
} from 'lexical';

import { WordNode, $createWordNode, $isWordNode } from '../nodes/WordNode';
import { SegmentNode, $createSegmentNode, $isSegmentNode } from '../nodes/SegmentNode';
// SpeakerNode no longer used - handled by ClipSpeakerPlugin
import { ClipNode, $isClipNode } from '../nodes/ClipNode';
import { $createSpacerNode } from '../nodes/SpacerNode';

export interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker: string;
  words: Word[];
}

export interface Word {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface ConversionOptions {
  includeSpeakerLabels?: boolean;
  groupBySpeaker?: boolean;
  insertParagraphBreaks?: boolean;
  preserveClips?: boolean;
  getSpeakerDisplayName?: (speakerId: string) => string;
  getSpeakerColor?: (speakerId: string) => string | undefined;
}

/**
 * Convert segment data to Lexical EditorState
 * Populates the editor with WordNodes, SegmentNodes, and SpeakerNodes
 */
export function segmentsToEditorState(
  editor: LexicalEditor,
  segments: Segment[],
  options: ConversionOptions = {}
): void {
  const {
    includeSpeakerLabels = true,
    groupBySpeaker = true,
    insertParagraphBreaks = true,
    getSpeakerDisplayName = (id) => id,
    getSpeakerColor,
  } = options;

  editor.update(() => {
    const root = $getRoot();
    root.clear();

    if (segments.length === 0) {
      // Create empty paragraph for empty state
      const paragraph = $createParagraphNode();
      root.append(paragraph);
      return;
    }

    let lastSpeakerId = '';
    let currentSegmentNode: SegmentNode | null = null;

    segments.forEach((segment, segmentIndex) => {
      const speakerChanged = segment.speaker !== lastSpeakerId;
      const shouldInsertParagraphBreak = insertParagraphBreaks && speakerChanged && segmentIndex > 0;

      // Create segment container
      currentSegmentNode = $createSegmentNode(
        segment.id || `segment_${segmentIndex}`,
        segment.start,
        segment.end,
        segment.speaker,
        shouldInsertParagraphBreak
      );

      // Speaker info is now handled by ClipSpeakerPlugin via data attributes on container
      // No longer append SpeakerNode to segment to prevent deletion issues

      // Add words to segment (only if provided by model)
      if (segment.words && segment.words.length > 0) {
        segment.words.forEach((word, wordIndex) => {
          const wordNode = $createWordNode(
            word.word,
            word.start,
            word.end,
            segment.speaker,
            word.score
          );
          currentSegmentNode!.append(wordNode);
          if (wordIndex < segment.words.length - 1) {
            currentSegmentNode!.append($createTextNode(' '));
          }
        });
      } else if (segment.text) {
        // No word timing data: insert raw text only (no synthetic timings)
        currentSegmentNode.append($createTextNode(segment.text));
      }

      root.append(currentSegmentNode);
      lastSpeakerId = segment.speaker;
    });
  });
}

// ==================== Clip Converters ====================
import { Clip } from '../../types';
import { ClipContainerNode, $createClipContainerNode } from '../nodes/ClipContainerNode';

/**
 * Convert clips to Lexical EditorState as ClipContainerNode blocks
 */
export function clipsToEditorState(
  editor: LexicalEditor,
  clips: Clip[],
  options: ConversionOptions = {}
): void {
  const {
    includeSpeakerLabels = true,
    getSpeakerDisplayName = (id) => id,
    getSpeakerColor,
  } = options;

  editor.update(() => {
    const root = $getRoot();
    root.clear();

    const UI_DEBUG = (globalThis as any).process?.env?.VITE_AUDIO_DEBUG === 'true' || 
                     (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
                     
    // Work with speech-only clips in the given array order (edited order)
    const speech = clips
      .filter(c => c.type !== 'audio-only')
      .slice();

    if (UI_DEBUG) {
      console.log('[clipsToEditorState] Speech-only orders:', speech.map(c => `${c.id.slice(-6)}:${c.order}`));
    }

    const SPACER_VISUAL_THRESHOLD = 1.0; // show pills only if >= 1s
    const attachSpacerToContainerEnd = (container: any, gap: Clip) => {
      const duration = Math.max(0, (gap.endTime ?? 0) - (gap.startTime ?? 0));
      if (duration < SPACER_VISUAL_THRESHOLD) return;
      // Append spacer pill at the end of the first paragraph
      const children = container.getChildren();
      let paragraph: any = children.find((c: any) => c.getType && c.getType() === 'paragraph');
      if (!paragraph) {
        paragraph = $createParagraphNode();
        container.append(paragraph);
      }
      // Add a space before spacer if last child is a word/text
      const lastChild = paragraph.getChildren().slice(-1)[0];
      if (lastChild && lastChild.getType && lastChild.getType() === 'text') {
        paragraph.append($createTextNode(' '));
      } else if (lastChild && (lastChild as any).getType && (lastChild as any).getType() === 'word') {
        paragraph.append($createTextNode(' '));
      }
      paragraph.append($createSpacerNode(duration, gap.startTime, gap.endTime));
    };

    // Traverse full edited order including gaps to attach pills after speech or at the beginning of the first encountered speech
    let lastSpeechContainer: any = null;
    const containerById = new Map<string, any>();
    let editedCursor = 0;

    // Preserve the incoming array order (no sort), since drag/drop already
    // provides the intended visual order
    const all = clips.slice();
    all.forEach((c) => {
      const clipStartEdited = editedCursor;

      if (c.type === 'audio-only') {
        const dur = Math.max(0, (c.endTime ?? 0) - (c.startTime ?? 0));
        editedCursor += dur;
        if (dur >= SPACER_VISUAL_THRESHOLD) {
          if (lastSpeechContainer) {
            // trailing spacer after last speech
            const paragraph = lastSpeechContainer.getChildren().find((n: any) => n.getType && n.getType() === 'paragraph') || $createParagraphNode();
            if (!paragraph.isAttached()) lastSpeechContainer.append(paragraph);
            paragraph.append($createTextNode(' '));
            paragraph.append($createSpacerNode(dur, c.startTime, c.endTime));
          } else {
            // Initial global gaps before any speech are handled separately (attached to earliest speech)
            // Do nothing here to avoid pinning to the first visual clip.
          }
        }
        return;
      }

      // speech clip: build its container
      const container = $createClipContainerNode(c.id, c.speaker, (c as any).status ?? 'active');
      const paragraph = $createParagraphNode();
      container.append(paragraph);

      // No-op: initial gaps are handled later by attaching to earliest-by-original-time speech

      (c.words || []).forEach((w, wi) => {
        const editedStart = clipStartEdited + (w.start - c.startTime);
        const editedEnd = clipStartEdited + (w.end - c.startTime);
        const wordNode = $createWordNode(w.word, w.start, w.end, c.speaker, w.score, editedStart, editedEnd);
        paragraph.append(wordNode);
        if (wi < c.words.length - 1) paragraph.append($createTextNode(' '));
      });

      root.append(container);
      lastSpeechContainer = container;
      containerById.set(c.id, container);
      editedCursor += c.duration;
    });

    // Attach leading global gap (music intro) to the earliest-by-original-start speech clip, so it moves with that clip
    if (speech.length > 0) {
      let earliest = speech[0];
      for (const s of speech) {
        if ((s.startTime ?? 0) < (earliest.startTime ?? 0)) earliest = s;
      }
      const leadDur = Math.max(0, (earliest.startTime ?? 0)); // from 0 to earliest speech start
      if (leadDur >= SPACER_VISUAL_THRESHOLD) {
        const target = containerById.get(earliest.id);
        if (target) {
          const paragraph = target.getChildren().find((n: any) => n.getType && n.getType() === 'paragraph') || $createParagraphNode();
          if (!paragraph.isAttached()) target.append(paragraph);
          const children = paragraph.getChildren();
          const firstChild = children[0] || null;
          paragraph.insertBefore($createTextNode(' '), firstChild);
          paragraph.insertBefore($createSpacerNode(leadDur, 0, earliest.startTime), firstChild);
          paragraph.insertBefore($createTextNode(' '), firstChild);
        }
      }
    }
  });
}

/**
 * Convert editor ClipContainerNodes back to Clip[]
 */
export function editorStateToClips(editor: LexicalEditor, preserveOrderFromClips?: Clip[]): Clip[] {
  const result: Clip[] = [];
  
  // Create order lookup from existing clips to preserve drag-drop ordering
  const orderLookup = new Map<string, number>();
  if (preserveOrderFromClips) {
    preserveOrderFromClips.forEach(clip => {
      orderLookup.set(clip.id, clip.order ?? 0);
    });
  }
  
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();
    let fallbackOrder = 0;
    children.forEach((child) => {
      if (child instanceof ClipContainerNode) {
        const clipId = (child as ClipContainerNode).getClipId();
        const speakerId = (child as ClipContainerNode).getSpeakerId();
        const status = (child as ClipContainerNode).getStatus?.() ?? 'active';
        const wordsNodes = (child as ClipContainerNode).getWordNodes();
        const words = wordsNodes
          .map((n) => {
            if ((n as any).getType && (n as any).getType() === 'word') {
              const w: any = n;
              return {
                word: w.getTextContent(),
                start: w.getStart(),
                end: w.getEnd(),
                score: w.getConfidence?.() || 1.0,
              };
            }
            return null;
          })
          .filter(Boolean) as any[];
        const text = words.map((w) => w.word).join(' ');
        const startTime = words.length ? words[0].start : 0;
        const endTime = words.length ? words[words.length - 1].end : startTime;
        
        // Preserve existing order if available, otherwise fall back to sequential
        const preservedOrder = orderLookup.has(clipId) ? orderLookup.get(clipId)! : fallbackOrder++;
        
        result.push({
          id: clipId,
          speaker: speakerId,
          startTime,
          endTime,
          startWordIndex: 0,
          endWordIndex: words.length - 1,
          words: words as any,
          text,
          confidence: 1.0,
          type: 'transcribed' as const,
          duration: endTime - startTime,
          order: preservedOrder,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          status: status,
        });
      }
    });
  });
  return result;
}

/**
 * Convert Lexical EditorState to segment data
 * Extracts segments with timing and speaker information
 */
export function editorStateToSegments(editor: LexicalEditor): Segment[] {
  const segments: Segment[] = [];

  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();

    children.forEach((child) => {
      if ($isSegmentNode(child)) {
        const segmentNode = child as SegmentNode;
        const segment: Segment = {
          id: segmentNode.getSegmentId(),
          start: segmentNode.getStartTime(),
          end: segmentNode.getEndTime(),
          text: '',
          speaker: segmentNode.getSpeakerId(),
          words: []
        };

        // Extract words from segment
        const wordNodes = segmentNode.getWordNodes();
        wordNodes.forEach((wordNode) => {
          if ($isWordNode(wordNode)) {
            const word: Word = {
              word: wordNode.getTextContent(),
              start: wordNode.getStart(),
              end: wordNode.getEnd(),
              score: wordNode.getConfidence() || 1.0
            };
            segment.words.push(word);
          }
        });

        // Reconstruct segment text from words
        segment.text = segment.words.map(w => w.word).join(' ');

        // Update segment timing based on words
        if (segment.words.length > 0) {
          segment.start = Math.min(segment.start, segment.words[0].start);
          segment.end = Math.max(segment.end, segment.words[segment.words.length - 1].end);
        }

        segments.push(segment);
      }
    });
  });

  return segments;
}

/**
 * Extract all words from the editor with their timing information
 * Useful for audio synchronization and analysis
 */
export function extractWordsWithTiming(editor: LexicalEditor): Array<{
  text: string;
  startTime: number;
  endTime: number;
  speakerId: string;
  segmentId: string;
  wordIndex: number;
  segmentIndex: number;
}> {
  const words: Array<{
    text: string;
    startTime: number;
    endTime: number;
    speakerId: string;
    segmentId: string;
    wordIndex: number;
    segmentIndex: number;
  }> = [];

  editor.getEditorState().read(() => {
    const root = $getRoot();
    let segmentIndex = 0;

    const traverseNodes = (node: LexicalNode, currentSegmentId = '', currentSpeakerId = '') => {
      if ($isSegmentNode(node)) {
        const segmentNode = node as SegmentNode;
        const segmentId = segmentNode.getSegmentId();
        const speakerId = segmentNode.getSpeakerId();
        
        let wordIndex = 0;
        const wordNodes = segmentNode.getWordNodes();
        
        wordNodes.forEach((wordNode) => {
          if ($isWordNode(wordNode)) {
            words.push({
              text: wordNode.getTextContent(),
              startTime: wordNode.getStart(),
              endTime: wordNode.getEnd(),
              speakerId: speakerId,
              segmentId: segmentId,
              wordIndex: wordIndex,
              segmentIndex: segmentIndex
            });
            wordIndex++;
          }
        });
        
        segmentIndex++;
      } else {
        // Recursively traverse children
        const children = (node as any).getChildren?.();
        if (children) {
          children.forEach((child: LexicalNode) => {
            traverseNodes(child, currentSegmentId, currentSpeakerId);
          });
        }
      }
    };

    const children = root.getChildren();
    children.forEach((child) => traverseNodes(child));
  });

  return words;
}

/**
 * Find word at specific timestamp
 * Used for audio synchronization highlighting
 */
export function findWordAtTime(
  editor: LexicalEditor,
  timestamp: number
): {
  wordNode: WordNode | null;
  element: HTMLElement | null;
} {
  let result: { wordNode: WordNode | null; element: HTMLElement | null } = {
    wordNode: null,
    element: null
  };

  editor.getEditorState().read(() => {
    const root = $getRoot();

    const findWord = (node: LexicalNode): boolean => {
      if ($isWordNode(node)) {
        const wordNode = node as WordNode;
        if (wordNode.isCurrentlyPlaying(timestamp)) {
          result.wordNode = wordNode;
          result.element = editor.getElementByKey(wordNode.getKey()) as HTMLElement;
          return true;
        }
      }

      const children = (node as any).getChildren?.();
      if (children) {
        for (const child of children) {
          if (findWord(child)) {
            return true;
          }
        }
      }
      return false;
    };

    const children = root.getChildren();
    for (const child of children) {
      if (findWord(child)) {
        break;
      }
    }
  });

  return result;
}

/**
 * Update word timing in the editor
 * Used for fine-tuning synchronization
 */
export function updateWordTiming(
  editor: LexicalEditor,
  wordKey: string,
  newStartTime: number,
  newEndTime: number
): boolean {
  let updated = false;

  editor.update(() => {
    const wordNode = editor.getEditorState()._nodeMap.get(wordKey);
    if (wordNode && $isWordNode(wordNode)) {
      (wordNode as WordNode).setTiming(newStartTime, newEndTime);
      updated = true;
    }
  });

  return updated;
}

/**
 * Extract plain text from editor
 * Useful for search and export functions
 */
export function extractPlainText(editor: LexicalEditor): string {
  let text = '';

  editor.getEditorState().read(() => {
    const root = $getRoot();
    text = root.getTextContent();
  });

  return text;
}

/**
 * Extract formatted text with speaker labels
 * Useful for exports with speaker information
 */
export function extractFormattedText(editor: LexicalEditor): string {
  let formattedText = '';

  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();
    
    children.forEach((child) => {
      if ($isSegmentNode(child)) {
        const segmentNode = child as SegmentNode;
        const segmentChildren = segmentNode.getChildren();
        
        // Get speaker info from segment node since SpeakerNodes are no longer used
        const speakerLabel = `${segmentNode.getSpeakerId()}: `;
        let segmentText = '';
        
        segmentChildren.forEach((segmentChild) => {
          if ($isWordNode(segmentChild)) {
            const wordNode = segmentChild as WordNode;
            segmentText += wordNode.getTextContent();
          } else if (segmentChild.getType() === 'text') {
            segmentText += segmentChild.getTextContent();
          }
        });
        
        if (segmentNode.isParagraphBreak()) {
          formattedText += '\n\n';
        }
        
        formattedText += speakerLabel + segmentText + '\n';
      }
    });
  });

  return formattedText.trim();
}

/**
 * Get statistics about the transcript
 * Useful for analysis and UI display
 */
export function getTranscriptStatistics(editor: LexicalEditor): {
  totalSegments: number;
  totalWords: number;
  totalDuration: number;
  speakers: string[];
  avgWordsPerSegment: number;
  avgSegmentDuration: number;
} {
  let totalSegments = 0;
  let totalWords = 0;
  let totalDuration = 0;
  const speakers = new Set<string>();
  let minStartTime = Infinity;
  let maxEndTime = 0;

  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();

    children.forEach((child) => {
      if ($isSegmentNode(child)) {
        totalSegments++;
        const segmentNode = child as SegmentNode;
        const wordNodes = segmentNode.getWordNodes();
        
        totalWords += wordNodes.length;
        speakers.add(segmentNode.getSpeakerId());
        
        minStartTime = Math.min(minStartTime, segmentNode.getStartTime());
        maxEndTime = Math.max(maxEndTime, segmentNode.getEndTime());
      }
    });
  });

  totalDuration = maxEndTime - minStartTime;

  return {
    totalSegments,
    totalWords,
    totalDuration,
    speakers: Array.from(speakers),
    avgWordsPerSegment: totalSegments > 0 ? totalWords / totalSegments : 0,
    avgSegmentDuration: totalSegments > 0 ? totalDuration / totalSegments : 0,
  };
}
