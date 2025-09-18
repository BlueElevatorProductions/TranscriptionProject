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
  // Original audio timeline positions
  startSec: number;
  endSec: number;
  // Edited (contiguous) timeline positions for highlighting
  editedStartSec?: number;
  editedEndSec?: number;
  type: 'spacer';
  version: 1;
}

export class SpacerNode extends DecoratorNode<React.JSX.Element> {
  __durationSec: number;
  __startSec: number;
  __endSec: number;
  __editedStartSec: number;
  __editedEndSec: number;

  static getType(): string {
    return 'spacer';
  }

  static clone(node: SpacerNode): SpacerNode {
    return new SpacerNode(
      node.__durationSec,
      node.__startSec,
      node.__endSec,
      node.__editedStartSec,
      node.__editedEndSec,
      node.__key
    );
  }

  constructor(
    durationSec: number,
    startSec: number,
    endSec: number,
    editedStartSec?: number,
    editedEndSec?: number,
    key?: NodeKey
  ) {
    super(key);
    this.__durationSec = durationSec;
    this.__startSec = startSec;
    this.__endSec = endSec;
    this.__editedStartSec = editedStartSec ?? startSec;
    this.__editedEndSec = editedEndSec ?? endSec;
  }

  static importJSON(json: SerializedSpacerNode): SpacerNode {
    return new SpacerNode(
      json.durationSec,
      json.startSec,
      json.endSec,
      json.editedStartSec,
      json.editedEndSec
    );
  }

  exportJSON(): SerializedSpacerNode {
    return {
      durationSec: this.__durationSec,
      startSec: this.__startSec,
      endSec: this.__endSec,
      editedStartSec: this.__editedStartSec,
      editedEndSec: this.__editedEndSec,
      type: 'spacer',
      version: 1,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement('span');
    el.className = 'lexical-spacer-node';
    el.setAttribute('data-spacer', 'true');
    // Provide timing data for highlighting sync
    // Original time domain (for seeking purposes)
    el.setAttribute('data-start-sec', String(this.__startSec));
    el.setAttribute('data-end-sec', String(this.__endSec));
    // Edited time domain (for highlighting)
    el.setAttribute('data-edited-start-sec', String(this.__editedStartSec));
    el.setAttribute('data-edited-end-sec', String(this.__editedEndSec));
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

export function $createSpacerNode(
  durationSec: number,
  startSec: number,
  endSec: number,
  editedStartSec?: number,
  editedEndSec?: number
): SpacerNode {
  return new SpacerNode(durationSec, startSec, endSec, editedStartSec, editedEndSec);
}

export function $isSpacerNode(node: LexicalNode | null | undefined): node is SpacerNode {
  return node instanceof SpacerNode;
}
