/**
 * SegmentNode - Container ElementNode for transcript segments
 * Manages paragraph breaks and segment-level operations
 */

import { 
  ElementNode, 
  LexicalNode, 
  NodeKey, 
  SerializedElementNode,
  RangeSelection,
  NodeSelection,
  GridSelection,
  Spread
} from 'lexical';

export interface SerializedSegmentNode extends SerializedElementNode {
  segmentId: string;
  startTime: number;
  endTime: number;
  speakerId: string;
  isParagraphBreak: boolean;
}

export class SegmentNode extends ElementNode {
  __segmentId: string;
  __startTime: number;
  __endTime: number;
  __speakerId: string;
  __isParagraphBreak: boolean;

  static getType(): string {
    return 'segment';
  }

  static clone(node: SegmentNode): SegmentNode {
    return new SegmentNode(
      node.__segmentId,
      node.__startTime,
      node.__endTime,
      node.__speakerId,
      node.__isParagraphBreak,
      node.__key
    );
  }

  constructor(
    segmentId: string,
    startTime: number,
    endTime: number,
    speakerId: string,
    isParagraphBreak: boolean = false,
    key?: NodeKey
  ) {
    super(key);
    this.__segmentId = segmentId;
    this.__startTime = startTime;
    this.__endTime = endTime;
    this.__speakerId = speakerId;
    this.__isParagraphBreak = isParagraphBreak;
  }

  createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.classList.add('lexical-segment-node');
    
    // Add paragraph break styling if needed
    if (this.__isParagraphBreak) {
      element.classList.add('paragraph-break', 'mt-8', 'pt-4', 'border-t', 'border-gray-200');
    } else {
      element.classList.add('mb-4');
    }

    // Add data attributes
    element.setAttribute('data-segment-id', this.__segmentId);
    element.setAttribute('data-start-time', this.__startTime.toString());
    element.setAttribute('data-end-time', this.__endTime.toString());
    element.setAttribute('data-speaker-id', this.__speakerId);

    return element;
  }

  updateDOM(prevNode: SegmentNode, element: HTMLElement): boolean {
    // Update paragraph break styling
    if (prevNode.__isParagraphBreak !== this.__isParagraphBreak) {
      if (this.__isParagraphBreak) {
        element.classList.add('paragraph-break', 'mt-8', 'pt-4', 'border-t', 'border-gray-200');
        element.classList.remove('mb-4');
      } else {
        element.classList.remove('paragraph-break', 'mt-8', 'pt-4', 'border-t', 'border-gray-200');
        element.classList.add('mb-4');
      }
    }

    // Update data attributes
    if (prevNode.__segmentId !== this.__segmentId) {
      element.setAttribute('data-segment-id', this.__segmentId);
    }
    if (prevNode.__startTime !== this.__startTime) {
      element.setAttribute('data-start-time', this.__startTime.toString());
    }
    if (prevNode.__endTime !== this.__endTime) {
      element.setAttribute('data-end-time', this.__endTime.toString());
    }
    if (prevNode.__speakerId !== this.__speakerId) {
      element.setAttribute('data-speaker-id', this.__speakerId);
    }

    return false;
  }

  // Getters
  getSegmentId(): string {
    return this.__segmentId;
  }

  getStartTime(): number {
    return this.__startTime;
  }

  getEndTime(): number {
    return this.__endTime;
  }

  getSpeakerId(): string {
    return this.__speakerId;
  }

  isParagraphBreak(): boolean {
    return this.__isParagraphBreak;
  }

  // Setters
  setSegmentId(segmentId: string): SegmentNode {
    const writable = this.getWritable();
    writable.__segmentId = segmentId;
    return writable;
  }

  setTiming(startTime: number, endTime: number): SegmentNode {
    const writable = this.getWritable();
    writable.__startTime = startTime;
    writable.__endTime = endTime;
    return writable;
  }

  setSpeaker(speakerId: string): SegmentNode {
    const writable = this.getWritable();
    writable.__speakerId = speakerId;
    return writable;
  }

  setParagraphBreak(isParagraphBreak: boolean): SegmentNode {
    const writable = this.getWritable();
    writable.__isParagraphBreak = isParagraphBreak;
    return writable;
  }

  // Check if current time falls within this segment
  containsTime(currentTime: number): boolean {
    return currentTime >= this.__startTime && currentTime <= this.__endTime;
  }

  // Selection handling
  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  // Indentation handling
  canIndent(): boolean {
    return false;
  }

  // Serialization
  exportJSON(): SerializedSegmentNode {
    return {
      ...super.exportJSON(),
      segmentId: this.__segmentId,
      startTime: this.__startTime,
      endTime: this.__endTime,
      speakerId: this.__speakerId,
      isParagraphBreak: this.__isParagraphBreak,
      type: 'segment',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedSegmentNode): SegmentNode {
    const {
      segmentId,
      startTime,
      endTime,
      speakerId,
      isParagraphBreak,
    } = serializedNode;
    const node = new SegmentNode(
      segmentId,
      startTime,
      endTime,
      speakerId,
      isParagraphBreak
    );
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  // Extract all word nodes from this segment
  getWordNodes(): Array<LexicalNode> {
    const wordNodes: Array<LexicalNode> = [];
    const children = this.getChildren();
    
    children.forEach(child => {
      if (child.getType() === 'word') {
        wordNodes.push(child);
      } else if (child.getType() === 'element') {
        // Recursively check element children
        const elementChildren = (child as ElementNode).getChildren();
        elementChildren.forEach(grandchild => {
          if (grandchild.getType() === 'word') {
            wordNodes.push(grandchild);
          }
        });
      }
    });
    
    return wordNodes;
  }

  // Get segment text content
  getTextContent(): string {
    return super.getTextContent().trim();
  }
}

export function $createSegmentNode(
  segmentId: string,
  startTime: number,
  endTime: number,
  speakerId: string,
  isParagraphBreak: boolean = false
): SegmentNode {
  return new SegmentNode(segmentId, startTime, endTime, speakerId, isParagraphBreak);
}

export function $isSegmentNode(node: LexicalNode | null | undefined): node is SegmentNode {
  return node instanceof SegmentNode;
}