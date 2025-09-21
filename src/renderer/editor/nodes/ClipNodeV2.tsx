/**
 * ClipNode v2.0 - Container node for segment-based clips
 *
 * Updated for the new segment architecture:
 * - Contains WordNode and SpacerNode children
 * - Supports atomic edit operations
 * - Clean speaker display and controls
 * - Efficient re-rendering with segment awareness
 */

import React from 'react';
import {
  ElementNode,
  NodeKey,
  LexicalNode,
  SerializedElementNode,
  EditorConfig,
  LexicalEditor,
  RangeSelection,
} from 'lexical';

export interface SerializedClipNodeV2 extends SerializedElementNode {
  clipId: string;
  speaker: string;
  displayName?: string;
  color?: string;
  startTime: number;
  endTime: number;
  readOnly?: boolean;
  type: 'clip-v2';
  version: 1;
}

export interface ClipNodeProps {
  clipId: string;
  speaker: string;
  displayName?: string;
  color?: string;
  startTime: number;
  endTime: number;
  readOnly?: boolean;
}

export class ClipNodeV2 extends ElementNode {
  __clipId: string;
  __speaker: string;
  __displayName?: string;
  __color?: string;
  __startTime: number;
  __endTime: number;
  __readOnly: boolean;

  static getType(): string {
    return 'clip-v2';
  }

  static clone(node: ClipNodeV2): ClipNodeV2 {
    return new ClipNodeV2({
      clipId: node.__clipId,
      speaker: node.__speaker,
      displayName: node.__displayName,
      color: node.__color,
      startTime: node.__startTime,
      endTime: node.__endTime,
      readOnly: node.__readOnly
    }, node.__key);
  }

  constructor(props: ClipNodeProps, key?: NodeKey) {
    super(key);
    this.__clipId = props.clipId;
    this.__speaker = props.speaker;
    this.__displayName = props.displayName;
    this.__color = props.color;
    this.__startTime = props.startTime;
    this.__endTime = props.endTime;
    this.__readOnly = props.readOnly || false;
  }

  // ==================== Getters ====================

  getClipId(): string {
    return this.__clipId;
  }

  getSpeaker(): string {
    return this.__speaker;
  }

  getDisplayName(): string {
    return this.__displayName || this.__speaker;
  }

  getColor(): string | undefined {
    return this.__color;
  }

  getStartTime(): number {
    return this.__startTime;
  }

  getEndTime(): number {
    return this.__endTime;
  }

  getDuration(): number {
    return this.__endTime - this.__startTime;
  }

  isReadOnly(): boolean {
    return this.__readOnly;
  }

  // ==================== Setters ====================

  setSpeaker(speaker: string, displayName?: string): void {
    const writable = this.getWritable();
    writable.__speaker = speaker;
    if (displayName !== undefined) {
      writable.__displayName = displayName;
    }
  }

  setColor(color: string | undefined): void {
    const writable = this.getWritable();
    writable.__color = color;
  }

  // ==================== Lexical Methods ====================

  static importJSON(serializedNode: SerializedClipNodeV2): ClipNodeV2 {
    const { clipId, speaker, displayName, color, startTime, endTime, readOnly } = serializedNode;

    return new ClipNodeV2({
      clipId,
      speaker,
      displayName,
      color,
      startTime,
      endTime,
      readOnly
    });
  }

  exportJSON(): SerializedClipNodeV2 {
    return {
      ...super.exportJSON(),
      clipId: this.__clipId,
      speaker: this.__speaker,
      displayName: this.__displayName,
      color: this.__color,
      startTime: this.__startTime,
      endTime: this.__endTime,
      readOnly: this.__readOnly,
      type: 'clip-v2',
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    element.classList.add('lexical-clip-container');

    // Add clip-specific attributes
    element.setAttribute('data-clip-id', this.__clipId);
    element.setAttribute('data-speaker', this.__speaker);
    element.setAttribute('data-start-time', this.__startTime.toString());
    element.setAttribute('data-end-time', this.__endTime.toString());

    // Add speaker color styling if available
    if (this.__color) {
      element.style.setProperty('--speaker-color', this.__color);
    }

    // Add read-only state
    if (this.__readOnly) {
      element.classList.add('clip-readonly');
    }

    return element;
  }

  updateDOM(prevNode: ClipNodeV2, dom: HTMLElement): boolean {
    let needsUpdate = false;

    // Update speaker if changed
    if (this.__speaker !== prevNode.__speaker) {
      dom.setAttribute('data-speaker', this.__speaker);
      needsUpdate = true;
    }

    // Update color if changed
    if (this.__color !== prevNode.__color) {
      if (this.__color) {
        dom.style.setProperty('--speaker-color', this.__color);
      } else {
        dom.style.removeProperty('--speaker-color');
      }
      needsUpdate = true;
    }

    // Update read-only state
    if (this.__readOnly !== prevNode.__readOnly) {
      if (this.__readOnly) {
        dom.classList.add('clip-readonly');
      } else {
        dom.classList.remove('clip-readonly');
      }
      needsUpdate = true;
    }

    return needsUpdate;
  }

  // ==================== Element Node Methods ====================

  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return true;
  }

  isInline(): boolean {
    return false;
  }

  // ==================== Clip-specific Methods ====================

  /**
   * Check if this clip contains a specific time
   */
  containsTime(time: number): boolean {
    return time >= this.__startTime && time < this.__endTime;
  }

  /**
   * Get all word nodes in this clip
   */
  getWordNodes(): LexicalNode[] {
    const wordNodes: LexicalNode[] = [];
    const children = this.getChildren();

    for (const child of children) {
      // Recursively find word nodes in paragraphs
      if (child.getType() === 'paragraph') {
        const grandChildren = child.getChildren();
        for (const grandChild of grandChildren) {
          if (grandChild.getType() === 'word-v2') {
            wordNodes.push(grandChild);
          }
        }
      }
    }

    return wordNodes;
  }

  /**
   * Get all spacer nodes in this clip
   */
  getSpacerNodes(): LexicalNode[] {
    const spacerNodes: LexicalNode[] = [];
    const children = this.getChildren();

    for (const child of children) {
      if (child.getType() === 'paragraph') {
        const grandChildren = child.getChildren();
        for (const grandChild of grandChildren) {
          if (grandChild.getType() === 'spacer-v2') {
            spacerNodes.push(grandChild);
          }
        }
      }
    }

    return spacerNodes;
  }

  /**
   * Get total word count in this clip
   */
  getWordCount(): number {
    return this.getWordNodes().length;
  }

  /**
   * Get debugging info
   */
  getDebugInfo(): string {
    const wordCount = this.getWordCount();
    const spacerCount = this.getSpacerNodes().length;

    return `ClipNode "${this.getDisplayName()}" [${this.__startTime.toFixed(2)}-${this.__endTime.toFixed(2)}s] ` +
           `words:${wordCount} spacers:${spacerCount} readonly:${this.__readOnly}`;
  }

  // ==================== Edit Operations ====================

  /**
   * Check if this clip can be split at a given time
   */
  canSplitAt(time: number): boolean {
    return this.containsTime(time) && time > this.__startTime && time < this.__endTime;
  }

  /**
   * Get segment index for a given time (for split operations)
   */
  getSegmentIndexAtTime(time: number): number | null {
    if (!this.containsTime(time)) return null;

    const allNodes = [...this.getWordNodes(), ...this.getSpacerNodes()];

    for (const node of allNodes) {
      if (node.getType() === 'word-v2' || node.getType() === 'spacer-v2') {
        const nodeAny = node as any;
        if (nodeAny.containsTime && nodeAny.containsTime(time)) {
          return nodeAny.getSegmentIndex();
        }
      }
    }

    return null;
  }
}

// ==================== Utility Functions ====================

export function $createClipNodeV2(props: ClipNodeProps): ClipNodeV2 {
  return new ClipNodeV2(props);
}

export function $isClipNodeV2(node: LexicalNode | null | undefined): node is ClipNodeV2 {
  return node instanceof ClipNodeV2;
}

// Backward compatibility
export const $createClipNode = $createClipNodeV2;
export const $isClipNode = $isClipNodeV2;
export const ClipNode = ClipNodeV2;