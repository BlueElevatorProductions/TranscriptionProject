/**
 * WordNode v2.0 - Lexical TextNode for segment-based transcript words
 *
 * Updated for the new segment architecture:
 * - Works with WordSegment type
 * - Preserves original timing metadata
 * - Supports clip-relative positioning
 * - Enables atomic edit operations
 */

import {
  NodeKey,
  TextNode,
  LexicalNode,
  SerializedTextNode,
  EditorConfig,
  $isTextNode
} from 'lexical';

export interface SerializedWordNodeV2 extends SerializedTextNode {
  // Absolute timeline times (for audio sync)
  startTime: number;
  endTime: number;

  // Original transcription times (preserved for debugging)
  originalStartTime: number;
  originalEndTime: number;

  // Segment metadata
  clipId: string;
  segmentIndex: number;
  confidence: number;

  // UI state
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface WordNodeProps {
  word: string;
  start: number;           // Absolute time
  end: number;             // Absolute time
  originalStart: number;   // Original transcription time
  originalEnd: number;     // Original transcription time
  confidence: number;
  clipId: string;
  segmentIndex: number;
  isActive?: boolean;
  isDeleted?: boolean;
}

export class WordNodeV2 extends TextNode {
  __startTime: number;
  __endTime: number;
  __originalStartTime: number;
  __originalEndTime: number;
  __clipId: string;
  __segmentIndex: number;
  __confidence: number;
  __isActive: boolean;
  __isDeleted: boolean;

  static getType(): string {
    return 'word-v2';
  }

  static clone(node: WordNodeV2): WordNodeV2 {
    return new WordNodeV2(
      {
        word: node.__text,
        start: node.__startTime,
        end: node.__endTime,
        originalStart: node.__originalStartTime,
        originalEnd: node.__originalEndTime,
        confidence: node.__confidence,
        clipId: node.__clipId,
        segmentIndex: node.__segmentIndex,
        isActive: node.__isActive,
        isDeleted: node.__isDeleted
      },
      node.__key
    );
  }

  constructor(props: WordNodeProps, key?: NodeKey) {
    super(props.word, key);

    this.__startTime = props.start;
    this.__endTime = props.end;
    this.__originalStartTime = props.originalStart;
    this.__originalEndTime = props.originalEnd;
    this.__clipId = props.clipId;
    this.__segmentIndex = props.segmentIndex;
    this.__confidence = props.confidence;
    this.__isActive = props.isActive || false;
    this.__isDeleted = props.isDeleted || false;
  }

  // ==================== Getters ====================

  getWord(): string {
    return this.__text;
  }

  getStartTime(): number {
    return this.__startTime;
  }

  getEndTime(): number {
    return this.__endTime;
  }

  getOriginalStartTime(): number {
    return this.__originalStartTime;
  }

  getOriginalEndTime(): number {
    return this.__originalEndTime;
  }

  getClipId(): string {
    return this.__clipId;
  }

  getSegmentIndex(): number {
    return this.__segmentIndex;
  }

  getConfidence(): number {
    return this.__confidence;
  }

  isActive(): boolean {
    return this.__isActive;
  }

  isDeleted(): boolean {
    return this.__isDeleted;
  }

  getDuration(): number {
    return this.__endTime - this.__startTime;
  }

  // ==================== Setters ====================

  setWord(word: string): void {
    const writable = this.getWritable();
    writable.__text = word;
  }

  setActive(isActive: boolean): void {
    const writable = this.getWritable();
    writable.__isActive = isActive;
  }

  setDeleted(isDeleted: boolean): void {
    const writable = this.getWritable();
    writable.__isDeleted = isDeleted;
  }

  // Note: Timing changes should go through edit operations, not direct setters

  // ==================== Editing Control ====================

  isEditable(): boolean {
    // Words are not directly editable in edit mode - only selectable for splitting
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true; // Allow keyboard selection for accessibility
  }

  // ==================== Lexical Methods ====================

  static importJSON(serializedNode: SerializedWordNodeV2): WordNodeV2 {
    const { text, startTime, endTime, originalStartTime, originalEndTime,
            clipId, segmentIndex, confidence, isActive, isDeleted } = serializedNode;

    const node = new WordNodeV2({
      word: text,
      start: startTime,
      end: endTime,
      originalStart: originalStartTime,
      originalEnd: originalEndTime,
      clipId,
      segmentIndex,
      confidence,
      isActive,
      isDeleted
    });

    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);

    return node;
  }

  exportJSON(): SerializedWordNodeV2 {
    return {
      ...super.exportJSON(),
      startTime: this.__startTime,
      endTime: this.__endTime,
      originalStartTime: this.__originalStartTime,
      originalEndTime: this.__originalEndTime,
      clipId: this.__clipId,
      segmentIndex: this.__segmentIndex,
      confidence: this.__confidence,
      isActive: this.__isActive,
      isDeleted: this.__isDeleted,
      type: 'word-v2',
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    element.classList.add('lexical-word-node');

    // Add segment-specific attributes
    element.setAttribute('data-clip-id', this.__clipId);
    element.setAttribute('data-segment-index', this.__segmentIndex.toString());
    element.setAttribute('data-start-time', this.__startTime.toString());
    element.setAttribute('data-end-time', this.__endTime.toString());
    element.setAttribute('data-confidence', this.__confidence.toString());

    // Add state classes
    if (this.__isActive) {
      element.classList.add('word-active');
    }

    if (this.__isDeleted) {
      element.classList.add('word-deleted');
    }

    // Add confidence-based styling
    if (this.__confidence < 0.7) {
      element.classList.add('word-low-confidence');
    }

    // Make words non-editable by default
    element.contentEditable = 'false';
    element.setAttribute('data-lexical-text', 'false');

    return element;
  }

  updateDOM(prevNode: WordNodeV2, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config);

    // Update attributes if they changed
    if (this.__startTime !== prevNode.__startTime) {
      dom.setAttribute('data-start-time', this.__startTime.toString());
    }
    if (this.__endTime !== prevNode.__endTime) {
      dom.setAttribute('data-end-time', this.__endTime.toString());
    }

    // Update active state
    if (this.__isActive !== prevNode.__isActive) {
      if (this.__isActive) {
        dom.classList.add('word-active');
      } else {
        dom.classList.remove('word-active');
      }
    }

    // Update deleted state
    if (this.__isDeleted !== prevNode.__isDeleted) {
      if (this.__isDeleted) {
        dom.classList.add('word-deleted');
      } else {
        dom.classList.remove('word-deleted');
      }
    }

    return updated;
  }

  // ==================== Word-specific Methods ====================

  /**
   * Check if this word contains a specific time
   */
  containsTime(time: number): boolean {
    return time >= this.__startTime && time < this.__endTime;
  }

  /**
   * Get relative time within this word (0-1)
   */
  getRelativeTime(time: number): number {
    if (!this.containsTime(time)) return 0;
    return (time - this.__startTime) / this.getDuration();
  }

  /**
   * Check if this word overlaps with a time range
   */
  overlapsRange(start: number, end: number): boolean {
    return this.__startTime < end && this.__endTime > start;
  }

  /**
   * Get debugging info
   */
  getDebugInfo(): string {
    return `WordNode "${this.__text}" [${this.__startTime.toFixed(2)}-${this.__endTime.toFixed(2)}s] ` +
           `clip:${this.__clipId.slice(-6)} seg:${this.__segmentIndex} conf:${this.__confidence.toFixed(2)}`;
  }
}

// ==================== Utility Functions ====================

export function $createWordNodeV2(props: WordNodeProps): WordNodeV2 {
  return new WordNodeV2(props);
}

export function $isWordNodeV2(node: LexicalNode | null | undefined): node is WordNodeV2 {
  return node instanceof WordNodeV2;
}

// Backward compatibility
export const $createWordNode = $createWordNodeV2;
export const $isWordNode = $isWordNodeV2;
export const WordNode = WordNodeV2;