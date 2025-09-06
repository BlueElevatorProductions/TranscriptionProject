/**
 * ClipContainerNode - Element node representing a single clip block
 * Holds speaker + words and renders a clear visual divider between clips.
 */

import {
  ElementNode,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  EditorConfig,
  $isElementNode,
} from 'lexical';

export interface SerializedClipContainerNode extends SerializedElementNode {
  clipId: string;
  speakerId: string;
}

export class ClipContainerNode extends ElementNode {
  __clipId: string;
  __speakerId: string;

  static getType(): string {
    return 'clip-container';
  }

  static clone(node: ClipContainerNode): ClipContainerNode {
    return new ClipContainerNode(node.__clipId, node.__speakerId, node.__key);
  }

  constructor(clipId: string, speakerId: string, key?: NodeKey) {
    super(key);
    this.__clipId = clipId;
    this.__speakerId = speakerId;
  }

  getClipId(): string {
    return this.__clipId;
  }

  getSpeakerId(): string {
    return this.__speakerId;
  }

  setSpeaker(speakerId: string): ClipContainerNode {
    const writable = this.getWritable();
    writable.__speakerId = speakerId;
    return writable;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    el.classList.add('lexical-clip-container');
    el.setAttribute('data-clip-id', this.__clipId);
    el.setAttribute('data-speaker-id', this.__speakerId);
    return el;
  }

  updateDOM(prevNode: ClipContainerNode, el: HTMLElement): boolean {
    if (prevNode.__clipId !== this.__clipId) {
      el.setAttribute('data-clip-id', this.__clipId);
    }
    if (prevNode.__speakerId !== this.__speakerId) {
      el.setAttribute('data-speaker-id', this.__speakerId);
    }
    return false;
  }

  isTopLevel(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return true;
  }

  canInsertTextAfter(): boolean {
    return true;
  }

  // Collect WordNodes contained directly/indirectly
  getWordNodes(): Array<LexicalNode> {
    const result: LexicalNode[] = [];
    const stack = this.getChildren();
    while (stack.length) {
      const n = stack.shift()!;
      if ((n as any).getType && (n as any).getType() === 'word') {
        result.push(n);
      } else if ($isElementNode(n)) {
        stack.push(...(n as any).getChildren());
      }
    }
    return result;
  }

  exportJSON(): SerializedClipContainerNode {
    return {
      ...super.exportJSON(),
      clipId: this.__clipId,
      speakerId: this.__speakerId,
      type: 'clip-container',
      version: 1,
    };
  }

  static importJSON(json: SerializedClipContainerNode): ClipContainerNode {
    const node = new ClipContainerNode(json.clipId, json.speakerId);
    node.setFormat(json.format);
    node.setIndent(json.indent);
    node.setDirection(json.direction);
    return node;
  }
}

export function $createClipContainerNode(clipId: string, speakerId: string): ClipContainerNode {
  return new ClipContainerNode(clipId, speakerId);
}

export function $isClipContainerNode(node: LexicalNode | null | undefined): node is ClipContainerNode {
  return node instanceof ClipContainerNode;
}

