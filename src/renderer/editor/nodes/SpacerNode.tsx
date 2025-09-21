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
  clipId?: string;
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
  __clipId?: string;
  __durationSec: number;
  __startSec: number;
  __endSec: number;
  __editedStartSec: number;
  __editedEndSec: number;

  static getType(): string {
    return 'spacer';
  }

  static clone(node: SpacerNode): SpacerNode {
    const n: any = node as any;
    return new SpacerNode(
      n.__clipId,
      node.__durationSec,
      node.__startSec,
      node.__endSec,
      node.__editedStartSec,
      node.__editedEndSec,
      node.__key
    );
  }

  constructor(
    clipId: string | undefined,
    durationSec: number,
    startSec: number,
    endSec: number,
    editedStartSec?: number,
    editedEndSec?: number,
    key?: NodeKey
  ) {
    super(key);
    this.__clipId = clipId;
    this.__durationSec = durationSec;
    this.__startSec = startSec;
    this.__endSec = endSec;
    this.__editedStartSec = editedStartSec ?? startSec;
    this.__editedEndSec = editedEndSec ?? endSec;
  }

  static importJSON(json: SerializedSpacerNode): SpacerNode {
    return new SpacerNode(
      json.clipId,
      json.durationSec,
      json.startSec,
      json.endSec,
      json.editedStartSec,
      json.editedEndSec
    );
  }

  exportJSON(): SerializedSpacerNode {
    return {
      clipId: this.__clipId,
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
    // Tell Lexical to ignore selection/edit logic for this subtree
    el.setAttribute('data-lexical-editor-ignore', 'true');
    try { el.setAttribute('data-lexical-node-key', this.getKey()); } catch {}
    // Provide timing data for highlighting sync
    // Original time domain (for seeking purposes)
    el.setAttribute('data-start-sec', String(this.__startSec));
    el.setAttribute('data-end-sec', String(this.__endSec));
    // Edited time domain (for highlighting)
    el.setAttribute('data-edited-start-sec', String(this.__editedStartSec));
    el.setAttribute('data-edited-end-sec', String(this.__editedEndSec));
    if (this.__clipId) {
      el.setAttribute('data-clip-id', String(this.__clipId));
    }
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

    // Get node key safely
    const nodeKey = this.getKey();

    const handleClick = (e: React.MouseEvent) => {
      // Use global audio actions if available
      const actions = (globalThis as any).__LEXICAL_AUDIO_ACTIONS__;
      const state = (globalThis as any).__LEXICAL_AUDIO_STATE__;
      // Only trigger playback/seek in Listen Mode. In Edit Mode, let SpacerClickPlugin handle it.
      if (actions && state?.mode === 'listen') {
        e.preventDefault();
        e.stopPropagation();
        const bias = Math.max(0, start - 0.01);
        try {
          actions.seekToOriginalTime(bias);
          if (state?.mode === 'listen' && !state.isPlaying) {
            actions.play?.().catch(() => {});
          }
        } catch {}
      }
      // In Edit Mode, don't prevent default - let SpacerClickPlugin handle it
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        className="lexical-spacer-node inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-gray-200 text-gray-700 text-xs font-medium border border-gray-300 select-none"
        title={`Silent/music gap: ${label}`}
        style={{ pointerEvents: 'auto' }}
        tabIndex={0}
        data-lexical-editor-ignore="true"
        data-lexical-node-key={nodeKey}
        data-start-sec={String(this.__startSec)}
        data-end-sec={String(this.__endSec)}
        data-edited-start-sec={String(this.__editedStartSec)}
        data-edited-end-sec={String(this.__editedEndSec)}
        aria-label={`Gap ${label}`}
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
  editedEndSec?: number,
  clipId?: string
): SpacerNode {
  return new SpacerNode(clipId, durationSec, startSec, endSec, editedStartSec, editedEndSec);
}

export function $isSpacerNode(node: LexicalNode | null | undefined): node is SpacerNode {
  return node instanceof SpacerNode;
}
