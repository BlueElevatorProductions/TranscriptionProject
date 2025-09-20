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
import { $isSpacerNode } from '../nodes/SpacerNode';

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

    // Determine earliest-by-original-time speech to recognize a single leading global gap
    let earliestSpeech = speech[0] || null;
    for (const s of speech) {
      if (!earliestSpeech || (s.startTime ?? 0) < (earliestSpeech.startTime ?? 0)) {
        earliestSpeech = s;
      }
    }
    const earliestStart = earliestSpeech ? (earliestSpeech.startTime ?? 0) : 0;
    const attachSpacerToContainerEnd = (container: any, gap: Clip, editedStart: number, editedEnd: number) => {
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
      paragraph.append($createSpacerNode(duration, gap.startTime, gap.endTime, editedStart, editedEnd));
    };

    // Traverse full edited order; embed gaps strictly from per-clip tokens when present
    let lastSpeechContainer: any = null;
    const containerById = new Map<string, any>();
    let editedCursor = 0;

    // Preserve the incoming array order (no sort), since drag/drop already
    // provides the intended visual order
    const all = clips.slice();
    // Gaps detected as leading for an upcoming speech clip
    const pendingLeading = new Map<string, Clip[]>();
    all.forEach((c, idx) => {
      const clipStartEdited = editedCursor;

      if (c.type === 'audio-only') {
        const dur = Math.max(0, (c.endTime ?? 0) - (c.startTime ?? 0));
        editedCursor += dur;
        if (dur >= SPACER_VISUAL_THRESHOLD) {
          const isLeadingGlobalGap = Math.abs((c.startTime ?? 0) - 0) < 0.02 && Math.abs((c.endTime ?? 0) - earliestStart) < 0.02;
          if (isLeadingGlobalGap) {
            // Defer: attach to earliest speech after loop
            return;
          }
          // Do not attach global gap clips if tokens are used; embedding handled per-clip
          if (lastSpeechContainer && !(lastSpeechContainer as any)._hasTokenBasedGaps) {
            const paragraph =
              lastSpeechContainer.getChildren().find((n: any) => n.getType && n.getType() === 'paragraph') ||
              $createParagraphNode();
            if (!paragraph.isAttached()) lastSpeechContainer.append(paragraph);

            // Insert spacer after the last word with end <= gap.startTime
            const wordNodes: any[] = (lastSpeechContainer as any).getWordNodes?.() || [];
            let after: any = null;
            for (const wn of wordNodes) {
              const end = typeof (wn as any).getEnd === 'function' ? (wn as any).getEnd() : Number.NEGATIVE_INFINITY;
              if (end <= (c.startTime ?? 0)) after = wn; else break;
            }
            const editedStart = editedCursor - dur;
            const spacer = $createSpacerNode(dur, c.startTime, c.endTime, editedStart, editedCursor, c.id);
            if (after && typeof after.insertAfter === 'function') {
              after.insertAfter($createTextNode(' '));
              const space1 = after.getNextSibling();
              if (space1 && typeof (space1 as any).insertAfter === 'function') {
                (space1 as any).insertAfter(spacer);
                spacer.insertAfter($createTextNode(' '));
              } else {
                paragraph.append(spacer);
                paragraph.append($createTextNode(' '));
              }
            } else {
              const first = paragraph.getFirstChild();
              if (first && typeof (paragraph as any).insertBefore === 'function') {
                (paragraph as any).insertBefore($createTextNode(' '), first);
                (paragraph as any).insertBefore(spacer, first);
                (paragraph as any).insertBefore($createTextNode(' '), first);
              } else {
                paragraph.append($createTextNode(' '));
                paragraph.append(spacer);
                paragraph.append($createTextNode(' '));
              }
            }
          }
        }
        return;
      }

      // speech clip: build its container
      const container = $createClipContainerNode(c.id, c.speaker, (c as any).status ?? 'active');
      const paragraph = $createParagraphNode();
      container.append(paragraph);

      // If clip has canonical tokens, embed gaps strictly from tokens
      const tokens = (c as any).tokens as Array<{ kind: 'gap'|'word'; id: string; start: number; end: number; text?: string }> | undefined;
      if (Array.isArray(tokens) && tokens.length > 0) {
        (container as any)._hasTokenBasedGaps = true;
        // Insert leading gaps
        let idxTok = 0;
        const firstChild = paragraph.getFirstChild();
        while (idxTok < tokens.length && tokens[idxTok].kind === 'gap') {
          const g = tokens[idxTok];
          const gDur = Math.max(0, (g.end ?? 0) - (g.start ?? 0));
          const gStartEdited = Math.max(0, clipStartEdited - gDur);
          paragraph.insertBefore($createTextNode(' '), firstChild);
          paragraph.insertBefore($createSpacerNode(gDur, g.start, g.end, gStartEdited, clipStartEdited, g.id), firstChild);
          paragraph.insertBefore($createTextNode(' '), firstChild);
          idxTok++;
        }
      }

      (c.words || []).forEach((w, wi) => {
        const editedStart = clipStartEdited + (w.start - c.startTime);
        const editedEnd = clipStartEdited + (w.end - c.startTime);
        const wordNode = $createWordNode(w.word, w.start, w.end, c.speaker, w.score, editedStart, editedEnd);
        paragraph.append(wordNode);
        if (wi < c.words.length - 1) paragraph.append($createTextNode(' '));
      });

      // If tokens present, insert any mid/trailing gaps after words
      if (Array.isArray((c as any).tokens)) {
        const tokens = (c as any).tokens as any[];
        // Build array of word starts to map after which word to insert
        const wordsInClip = (c.words || []).slice();
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];
          if (t.kind !== 'gap') continue;
          // Find previous word whose end <= gap.start
          let afterWordEnd = -1;
          for (let wi = 0; wi < wordsInClip.length; wi++) {
            if (wordsInClip[wi].end <= (t.start ?? 0)) afterWordEnd = wi; else break;
          }
          if (afterWordEnd >= 0) {
            // Insert after that word
            const paragraphChildren = paragraph.getChildren();
            // Find the corresponding WordNode in paragraph by order
            let wordNodeIdx = 0;
            let targetWordNode: any = null;
            for (const ch of paragraphChildren) {
              if ((ch as any).getType && (ch as any).getType() === 'word') {
                if (wordNodeIdx === afterWordEnd) { targetWordNode = ch; break; }
                wordNodeIdx++;
              }
            }
            const gDur = Math.max(0, (t.end ?? 0) - (t.start ?? 0));
            const gStartEdited = clipStartEdited + ((t.start ?? 0) - c.startTime);
            const spacer = $createSpacerNode(gDur, t.start, t.end, gStartEdited, gStartEdited + gDur, t.id);
            if (targetWordNode && typeof (targetWordNode as any).insertAfter === 'function') {
              (targetWordNode as any).insertAfter($createTextNode(' '));
              const space = (targetWordNode as any).getNextSibling?.();
              if (space && typeof (space as any).insertAfter === 'function') {
                (space as any).insertAfter(spacer);
                spacer.insertAfter($createTextNode(' '));
              } else {
                paragraph.append(spacer);
                paragraph.append($createTextNode(' '));
              }
            } else {
              paragraph.append($createTextNode(' '));
              paragraph.append(spacer);
              paragraph.append($createTextNode(' '));
            }
          }
        }
      }

      root.append(container);
      lastSpeechContainer = container;
      containerById.set(c.id, container);
      editedCursor += c.duration;
    });

    // Attach leading global gap (if any) to earliest-by-original-time speech container at the very beginning
    if (speech.length > 0 && earliestSpeech) {
      const earliest = earliestSpeech;
      const leadDur = Math.max(0, (earliest.startTime ?? 0));
      if (leadDur >= SPACER_VISUAL_THRESHOLD) {
        const target = containerById.get(earliest.id);
        if (target) {
          const paragraph = target.getChildren().find((n: any) => n.getType && n.getType() === 'paragraph') || $createParagraphNode();
          if (!paragraph.isAttached()) target.append(paragraph);
          const firstChild = paragraph.getChildren()[0] || null;
          paragraph.insertBefore($createTextNode(' '), firstChild);
          const leadGap = clips.find(gc => gc.type === 'audio-only' && Math.abs((gc.startTime ?? 0) - 0) < 0.02 && Math.abs((gc.endTime ?? 0) - (earliest.startTime ?? 0)) < 0.02);
          paragraph.insertBefore($createSpacerNode(leadDur, 0, earliest.startTime, 0, leadDur, leadGap?.id), firstChild);
          paragraph.insertBefore($createTextNode(' '), firstChild);
        }
      }
    }
  });
}

/**
 * Convert editor ClipContainerNodes back to Clip[]
 */
export function editorStateToClips(editor: LexicalEditor, existingClips?: Clip[]): Clip[] {
  const result: Clip[] = [];
  let orderCounter = 0;

  // Create a lookup map for existing clips by ID for efficient comparison
  const existingClipsMap = new Map<string, Clip>();
  if (existingClips) {
    existingClips.forEach(clip => {
      existingClipsMap.set(clip.id, clip);
    });
  }
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();
    children.forEach((child) => {
      if (child instanceof ClipContainerNode) {
        const clipId = (child as ClipContainerNode).getClipId();
        const speakerId = (child as ClipContainerNode).getSpeakerId();
        const status = (child as ClipContainerNode).getStatus?.() ?? 'active';
        const wordsNodes = (child as ClipContainerNode).getWordNodes();
        const spacers: any[] = [];
        const collect = (n: any) => {
          if ($isSpacerNode(n)) spacers.push(n);
          const ch = n?.getChildren?.();
          if (Array.isArray(ch)) ch.forEach(collect);
        };
        collect(child as any);

        const words = wordsNodes
          .map((n) => {
            if ((n as any).getType && (n as any).getType() === 'word') {
              const w: any = n;
              return { word: w.getTextContent(), start: w.getStart(), end: w.getEnd(), score: w.getConfidence?.() || 1.0 };
            }
            return null;
          })
          .filter(Boolean) as any[];
        const text = words.map((w) => w.word).join(' ');
        const startTime = words.length ? words[0].start : 0;
        const endTime = words.length ? words[words.length - 1].end : startTime;

        const EPS = 1e-3;
        const leadingSpacers = spacers
          .filter((s: any) => (s.__endSec ?? 0) <= startTime + EPS)
          .sort((a: any, b: any) => (a.__startSec ?? 0) - (b.__startSec ?? 0));
        leadingSpacers.forEach((s: any) => {
          const sStart = s.__startSec ?? 0;
          const sEnd = s.__endSec ?? sStart;
          const sDur = Math.max(1e-6, sEnd - sStart);
          const spacerId = s.__clipId || `g-${Math.round(sStart * 1000)}-${Math.round(sEnd * 1000)}`;

          // Try to reuse existing spacer clip if content matches
          const existingClip = existingClipsMap.get(spacerId);
          if (existingClip &&
              existingClip.type === 'audio-only' &&
              Math.abs(existingClip.startTime - sStart) < 0.001 &&
              Math.abs(existingClip.endTime - sEnd) < 0.001 &&
              existingClip.speaker === '' &&
              existingClip.status === status) {
            // Reuse existing clip, only updating order
            result.push({
              ...existingClip,
              order: orderCounter++,
            });
          } else {
            // Create new clip
            result.push({
              id: spacerId,
              speaker: '',
              startTime: sStart,
              endTime: sEnd,
              startWordIndex: 0,
              endWordIndex: -1,
              words: [],
              text: '',
              confidence: 1.0,
              type: 'audio-only' as const,
              duration: sDur,
              order: orderCounter++,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              status: status,
            });
          }
        });

        // Try to reuse existing transcribed clip if content matches
          const existingTranscribedClip = existingClipsMap.get(clipId);
        if (existingTranscribedClip &&
            existingTranscribedClip.type === 'transcribed' &&
            existingTranscribedClip.speaker === speakerId &&
            existingTranscribedClip.text === text &&
            existingTranscribedClip.words?.length === words.length &&
            Math.abs(existingTranscribedClip.startTime - startTime) < 0.001 &&
            Math.abs(existingTranscribedClip.endTime - endTime) < 0.001 &&
            existingTranscribedClip.status === status) {
          // Reuse existing clip, only updating order
          result.push({
            ...existingTranscribedClip,
            order: orderCounter++,
          });
        } else {
          // Create new clip
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
            order: orderCounter++,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            status: status,
          });
        }

        const trailingSpacers = spacers
          .filter((s: any) => (s.__startSec ?? 0) >= endTime - EPS)
          .sort((a: any, b: any) => (a.__startSec ?? 0) - (b.__startSec ?? 0));
        trailingSpacers.forEach((s: any) => {
          const sStart = s.__startSec ?? 0;
          const sEnd = s.__endSec ?? sStart;
          const sDur = Math.max(1e-6, sEnd - sStart);
          const trailingSpacerId = s.__clipId || `g-${Math.round(sStart * 1000)}-${Math.round(sEnd * 1000)}`;

          // Try to reuse existing trailing spacer clip if content matches
          const existingTrailingClip = existingClipsMap.get(trailingSpacerId);
          if (existingTrailingClip &&
              existingTrailingClip.type === 'audio-only' &&
              Math.abs(existingTrailingClip.startTime - sStart) < 0.001 &&
              Math.abs(existingTrailingClip.endTime - sEnd) < 0.001 &&
              existingTrailingClip.speaker === '' &&
              existingTrailingClip.status === status) {
            // Reuse existing clip, only updating order
            result.push({
              ...existingTrailingClip,
              order: orderCounter++,
            });
          } else {
            // Create new clip
            result.push({
              id: trailingSpacerId,
              speaker: '',
              startTime: sStart,
              endTime: sEnd,
              startWordIndex: 0,
              endWordIndex: -1,
              words: [],
              text: '',
              confidence: 1.0,
              type: 'audio-only' as const,
              duration: sDur,
              order: orderCounter++,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              status: status,
            });
          }
        });
      }
    });
  });

  // Sort clips by startTime to ensure chronological order (fixes ordering issues after TokenSplitPlugin DOM manipulation)
  result.sort((a, b) => a.startTime - b.startTime);

  // Reassign order values sequentially to match sorted chronological order
  result.forEach((clip, index) => {
    clip.order = index;
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
