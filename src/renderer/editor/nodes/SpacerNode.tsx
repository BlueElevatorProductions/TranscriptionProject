/**
 * SpacerNode - Inline visual token representing an audio-only gap
 * Renders a small pill with duration, clickable to seek in Listen Mode.
 */

import React from 'react';
import {
  DecoratorNode,
  NodeKey,
  LexicalNode,
  SerializedLexicalNode,
  EditorConfig,
} from 'lexical';

export interface SerializedSpacerNode extends SerializedLexicalNode {
  durationSec: number;
  startSec: number;
  endSec: number;
  type: 'spacer';
  version: 1;
}

export class SpacerNode extends DecoratorNode<React.JSX.Element> {
  __durationSec: number;
  __startSec: number;
  __endSec: number;

  static getType(): string {
    return 'spacer';
  }

  static clone(node: SpacerNode): SpacerNode {
    return new SpacerNode(node.__durationSec, node.__startSec, node.__endSec, node.__key);
  }

  constructor(durationSec: number, startSec: number, endSec: number, key?: NodeKey) {
    super(key);
    this.__durationSec = durationSec;
    this.__startSec = startSec;
    this.__endSec = endSec;
  }

  static importJSON(json: SerializedSpacerNode): SpacerNode {
    return new SpacerNode(json.durationSec, json.startSec, json.endSec);
  }

  exportJSON(): SerializedSpacerNode {
    return {
      durationSec: this.__durationSec,
      startSec: this.__startSec,
      endSec: this.__endSec,
      type: 'spacer',
      version: 1,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement('span');
    el.className = 'lexical-spacer-node';
    el.setAttribute('data-spacer', 'true');
    el.setAttribute('contenteditable', 'false');
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): React.JSX.Element {
    const secs = this.__durationSec;
    const start = this.__startSec;
    const label = `${secs.toFixed(Math.abs(secs - Math.round(secs)) < 0.005 ? 0 : 2)} sec`;

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Use global audio actions if available
      const actions = (globalThis as any).__LEXICAL_AUDIO_ACTIONS__;
      const state = (globalThis as any).__LEXICAL_AUDIO_STATE__;
      if (actions) {
        const bias = Math.max(0, start - 0.01);
        try {
          actions.seekToOriginalTime(bias);
          if (state?.mode === 'listen' && !state.isPlaying) {
            actions.play?.().catch(() => {});
          }
        } catch {}
      }
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        className="lexical-spacer-node inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-gray-200 text-gray-700 text-xs font-medium border border-gray-300 select-none"
        title={`Silent/music gap: ${label}`}
        style={{ pointerEvents: 'auto' }}
      >
        {label}
      </button>
    );
  }

  isInline(): boolean { return true; }
  isKeyboardSelectable(): boolean { return true; }
}

export function $createSpacerNode(durationSec: number, startSec: number, endSec: number): SpacerNode {
  return new SpacerNode(durationSec, startSec, endSec);
}

export function $isSpacerNode(node: LexicalNode | null | undefined): node is SpacerNode {
  return node instanceof SpacerNode;
}
