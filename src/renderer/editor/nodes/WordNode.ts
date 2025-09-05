/**
 * WordNode - Custom Lexical TextNode for transcript words with timing information
 * Enables precise audio synchronization and word-level highlighting
 */

import { NodeKey, TextNode, LexicalNode, SerializedTextNode, EditorConfig } from 'lexical';

export interface SerializedWordNode extends SerializedTextNode {
  startTime: number;
  endTime: number;
  speakerId: string;
  confidence?: number;
}

export class WordNode extends TextNode {
  __startTime: number;
  __endTime: number;
  __speakerId: string;
  __confidence?: number;
  __isCurrentlyPlaying: boolean = false;

  static getType(): string {
    return 'word';
  }

  static clone(node: WordNode): WordNode {
    return new WordNode(
      node.__text,
      node.__startTime,
      node.__endTime,
      node.__speakerId,
      node.__confidence,
      node.__key
    );
  }

  constructor(
    text: string,
    startTime: number,
    endTime: number,
    speakerId: string,
    confidence?: number,
    key?: NodeKey
  ) {
    super(text, key);
    this.__startTime = startTime;
    this.__endTime = endTime;
    this.__speakerId = speakerId;
    this.__confidence = confidence;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    element.classList.add('lexical-word-node');
    
    // Add timing data attributes for debugging/styling
    element.setAttribute('data-start-time', this.__startTime.toString());
    element.setAttribute('data-end-time', this.__endTime.toString());
    element.setAttribute('data-speaker-id', this.__speakerId);
    
    // Apply initial styling
    this.updatePlaybackState(element, false);
    
    return element;
  }

  updateDOM(prevNode: WordNode, element: HTMLElement): boolean {
    const updated = super.updateDOM(prevNode, element);
    
    // Update timing attributes if they changed
    if (prevNode.__startTime !== this.__startTime) {
      element.setAttribute('data-start-time', this.__startTime.toString());
    }
    if (prevNode.__endTime !== this.__endTime) {
      element.setAttribute('data-end-time', this.__endTime.toString());
    }
    if (prevNode.__speakerId !== this.__speakerId) {
      element.setAttribute('data-speaker-id', this.__speakerId);
    }
    
    // Update playback state if it changed
    if (prevNode.__isCurrentlyPlaying !== this.__isCurrentlyPlaying) {
      this.updatePlaybackState(element, this.__isCurrentlyPlaying);
    }
    
    return updated;
  }

  private updatePlaybackState(element: HTMLElement, isPlaying: boolean) {
    if (isPlaying) {
      element.classList.add('currently-playing');
      element.classList.add('bg-yellow-200', 'rounded', 'px-1', 'shadow-sm');
    } else {
      element.classList.remove('currently-playing');
      element.classList.remove('bg-yellow-200', 'rounded', 'px-1', 'shadow-sm');
    }
  }

  // Timing getters
  getStart(): number {
    return this.__startTime;
  }

  getEnd(): number {
    return this.__endTime;
  }

  getSpeakerId(): string {
    return this.__speakerId;
  }

  getConfidence(): number | undefined {
    return this.__confidence;
  }

  // Check if this word should be highlighted at the given time
  isCurrentlyPlaying(currentTime: number = 0): boolean {
    return currentTime >= this.__startTime && currentTime < this.__endTime;
  }

  // Update timing information
  setTiming(startTime: number, endTime: number): WordNode {
    const writable = this.getWritable();
    writable.__startTime = startTime;
    writable.__endTime = endTime;
    return writable;
  }

  // Update speaker information
  setSpeaker(speakerId: string): WordNode {
    const writable = this.getWritable();
    writable.__speakerId = speakerId;
    return writable;
  }

  // Update playback state for rendering
  setCurrentlyPlaying(isPlaying: boolean): WordNode {
    if (this.__isCurrentlyPlaying === isPlaying) {
      return this;
    }
    const writable = this.getWritable();
    writable.__isCurrentlyPlaying = isPlaying;
    return writable;
  }

  // Serialization
  exportJSON(): SerializedWordNode {
    return {
      ...super.exportJSON(),
      startTime: this.__startTime,
      endTime: this.__endTime,
      speakerId: this.__speakerId,
      confidence: this.__confidence,
      type: 'word',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedWordNode): WordNode {
    const { text, startTime, endTime, speakerId, confidence } = serializedNode;
    const node = new WordNode(text, startTime, endTime, speakerId, confidence);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  // Custom mutations
  insertAfter(nodeToInsert: LexicalNode, restoreSelection?: boolean): LexicalNode {
    // Ensure inserted nodes maintain speaker context
    if (nodeToInsert instanceof WordNode && !nodeToInsert.getSpeakerId()) {
      nodeToInsert.setSpeaker(this.__speakerId);
    }
    return super.insertAfter(nodeToInsert, restoreSelection);
  }

  insertBefore(nodeToInsert: LexicalNode, restoreSelection?: boolean): LexicalNode {
    // Ensure inserted nodes maintain speaker context
    if (nodeToInsert instanceof WordNode && !nodeToInsert.getSpeakerId()) {
      nodeToInsert.setSpeaker(this.__speakerId);
    }
    return super.insertBefore(nodeToInsert, restoreSelection);
  }
}

export function $createWordNode(
  text: string,
  startTime: number,
  endTime: number,
  speakerId: string,
  confidence?: number
): WordNode {
  return new WordNode(text, startTime, endTime, speakerId, confidence);
}

export function $isWordNode(node: LexicalNode | null | undefined): node is WordNode {
  return node instanceof WordNode;
}
