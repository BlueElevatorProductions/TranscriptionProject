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
import { SpeakerNode, $createSpeakerNode, $isSpeakerNode } from '../nodes/SpeakerNode';
import { ClipNode, $isClipNode } from '../nodes/ClipNode';

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

      // Add speaker label if needed and speaker changed
      if (includeSpeakerLabels && speakerChanged) {
        const speakerDisplayName = getSpeakerDisplayName(segment.speaker);
        const speakerColor = getSpeakerColor?.(segment.speaker);
        
        const speakerNode = $createSpeakerNode(
          segment.speaker,
          speakerDisplayName,
          speakerColor
        );
        
        currentSegmentNode.append(speakerNode);
      }

      // Add words to segment
      if (segment.words && segment.words.length > 0) {
        console.log(`🔧 Converting segment ${segmentIndex} with ${segment.words.length} words:`, 
          segment.words.slice(0, 3).map(w => ({ word: w.word, start: w.start, end: w.end })));
        
        segment.words.forEach((word, wordIndex) => {
          // Create word node
          const wordNode = $createWordNode(
            word.word,
            word.start,
            word.end,
            segment.speaker,
            word.score
          );

          currentSegmentNode!.append(wordNode);

          // Add space between words (except for last word)
          if (wordIndex < segment.words.length - 1) {
            currentSegmentNode!.append($createTextNode(' '));
          }
        });
      } else {
        // Fallback: create word nodes from segment text
        console.log(`⚠️  Segment ${segmentIndex} has no word timing data, using fallback for text: "${segment.text.substring(0, 50)}..."`);
        
        const words = segment.text.trim().split(/\s+/);
        const segmentDuration = segment.end - segment.start;
        const avgWordDuration = segmentDuration / words.length;

        console.log(`📊 Fallback timing: ${words.length} words, ${segmentDuration}s duration, ${avgWordDuration.toFixed(3)}s per word`);

        words.forEach((wordText, wordIndex) => {
          const wordStart = segment.start + (wordIndex * avgWordDuration);
          const wordEnd = wordStart + avgWordDuration;

          const wordNode = $createWordNode(
            wordText,
            wordStart,
            wordEnd,
            segment.speaker,
            1.0
          );

          currentSegmentNode!.append(wordNode);

          // Add space between words (except for last word)
          if (wordIndex < words.length - 1) {
            currentSegmentNode!.append($createTextNode(' '));
          }
        });
      }

      root.append(currentSegmentNode);
      lastSpeakerId = segment.speaker;
    });
  });
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
        
        let speakerLabel = '';
        let segmentText = '';
        
        segmentChildren.forEach((segmentChild) => {
          if ($isSpeakerNode(segmentChild)) {
            const speakerNode = segmentChild as SpeakerNode;
            speakerLabel = `${speakerNode.getDisplayName()}: `;
          } else if ($isWordNode(segmentChild)) {
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