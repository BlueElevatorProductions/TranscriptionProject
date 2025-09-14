/**
 * SpeakerNode - Lexical DecoratorNode for speaker labels
 * Provides simple display of speaker names with styling
 * Interactive functionality is handled by ClipHeaderPlugin
 */

import React from 'react';
import { 
  DecoratorNode, 
  NodeKey, 
  LexicalNode, 
  SerializedLexicalNode,
  EditorConfig
} from 'lexical';
import SpeakerDropdown from '../../components/shared/SpeakerDropdown';
import { useClipEditor } from '../../hooks/useClipEditor';

export interface SerializedSpeakerNode extends SerializedLexicalNode {
  speakerId: string;
  displayName: string;
  color?: string;
  clipId?: string;
  clipIndex?: number;
  totalClips?: number;
}

export interface SpeakerComponentProps {
  speakerId: string;
  displayName: string;
  color?: string;
  availableSpeakers?: { id: string; name: string }[];
  nodeKey: NodeKey;
  // New props for advanced dropdown
  clipId?: string;
  clipIndex?: number;
  totalClips?: number;
  readOnly?: boolean;
}

function SpeakerComponent({
  speakerId,
  displayName,
  color,
  availableSpeakers = [],
  nodeKey,
  clipId,
  clipIndex = 0,
  totalClips = 0,
  readOnly = false
}: SpeakerComponentProps) {
  // Get available speakers and audio system from global context
  const speakers = (globalThis as any).__LEXICAL_AVAILABLE_SPEAKERS__ || [];
  const audioState = (globalThis as any).__LEXICAL_AUDIO_STATE__;
  const audioActions = (globalThis as any).__LEXICAL_AUDIO_ACTIONS__;
  const clips = (globalThis as any).__LEXICAL_CLIPS__ || [];
  
  // Find current clip and its index
  const currentClip = clips.find((clip: any) => clip.id === clipId);
  const currentClipIndex = clips.findIndex((clip: any) => clip.id === clipId);
  
  // Only show dropdown in edit mode
  const showDropdown = !readOnly && audioState?.mode === 'edit' && audioState && audioActions;
  
  // Use clip editor for operations
  const clipEditor = useClipEditor(audioState, audioActions);
  
  // Always render dropdown - no simple label fallback
  return (
    <div className="lexical-speaker-node-container" style={{
      position: 'absolute',
      top: '8px',
      left: '8px',
      zIndex: 10,
      pointerEvents: 'auto'
    }}>
      <SpeakerDropdown
        currentSpeakerId={speakerId}
        displayName={displayName}
        availableSpeakers={speakers}
        clipIndex={currentClipIndex >= 0 ? currentClipIndex : 0}
        totalClips={clips.length}
        onSpeakerChange={(newSpeakerId) => {
          console.log('[SpeakerNode] Speaker change:', newSpeakerId);
          if (clipId) {
            clipEditor.changeSpeaker(clipId, newSpeakerId);
            window.dispatchEvent(new CustomEvent('speaker-change-clip', {
              detail: { clipId, speakerId: newSpeakerId }
            }));
          }
        }}
        onMergeAbove={() => {
          console.log('[SpeakerNode] Merge above clicked');
          if (currentClipIndex > 0 && clipId) {
            const prevClip = clips[currentClipIndex - 1];
            if (prevClip) {
              clipEditor.mergeClips(prevClip.id, clipId);
            }
          }
        }}
        onMergeBelow={() => {
          console.log('[SpeakerNode] Merge below clicked');
          if (currentClipIndex < clips.length - 1 && clipId) {
            const nextClip = clips[currentClipIndex + 1];
            if (nextClip) {
              clipEditor.mergeClips(clipId, nextClip.id);
            }
          }
        }}
        onDeleteClip={() => {
          console.log('[SpeakerNode] Delete clip clicked');
          if (clipId) {
            clipEditor.deleteClip(clipId);
          }
        }}
      />
    </div>
  );
}

export class SpeakerNode extends DecoratorNode<React.JSX.Element> {
  __speakerId: string;
  __displayName: string;
  __color?: string;
  __clipId?: string;
  __clipIndex?: number;
  __totalClips?: number;

  static getType(): string {
    return 'speaker';
  }

  static clone(node: SpeakerNode): SpeakerNode {
    const cloned = new SpeakerNode(
      node.__speakerId,
      node.__displayName,
      node.__color,
      node.__key
    );
    cloned.__clipId = node.__clipId;
    cloned.__clipIndex = node.__clipIndex;
    cloned.__totalClips = node.__totalClips;
    return cloned;
  }

  constructor(
    speakerId: string,
    displayName: string,
    color?: string,
    key?: NodeKey
  ) {
    super(key);
    this.__speakerId = speakerId;
    this.__displayName = displayName;
    this.__color = color;
  }

  // Getters
  getSpeakerId(): string {
    return this.__speakerId;
  }

  getDisplayName(): string {
    return this.__displayName;
  }

  getColor(): string | undefined {
    return this.__color;
  }

  // Setters
  setSpeakerId(speakerId: string): SpeakerNode {
    const writable = this.getWritable();
    writable.__speakerId = speakerId;
    return writable;
  }

  setDisplayName(displayName: string): SpeakerNode {
    const writable = this.getWritable();
    writable.__displayName = displayName;
    return writable;
  }

  setColor(color?: string): SpeakerNode {
    const writable = this.getWritable();
    writable.__color = color;
    return writable;
  }

  setClipInfo(clipId: string, clipIndex: number, totalClips: number): SpeakerNode {
    const writable = this.getWritable();
    writable.__clipId = clipId;
    writable.__clipIndex = clipIndex;
    writable.__totalClips = totalClips;
    return writable;
  }

  // Clip getters
  getClipId(): string | undefined {
    return this.__clipId;
  }

  getClipIndex(): number | undefined {
    return this.__clipIndex;
  }

  getTotalClips(): number | undefined {
    return this.__totalClips;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    element.classList.add('lexical-speaker-node-container');
    element.setAttribute('data-speaker-id', this.__speakerId);
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): React.JSX.Element {
    return (
      <SpeakerComponent
        speakerId={this.__speakerId}
        displayName={this.__displayName}
        color={this.__color}
        nodeKey={this.__key}
        clipId={this.__clipId}
        clipIndex={this.__clipIndex}
        totalClips={this.__totalClips}
      />
    );
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return false; // Not selectable since it's positioned absolutely
  }

  // Selection behavior
  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false; // Don't allow text after since it's absolutely positioned
  }

  // Serialization
  exportJSON(): SerializedSpeakerNode {
    return {
      speakerId: this.__speakerId,
      displayName: this.__displayName,
      color: this.__color,
      clipId: this.__clipId,
      clipIndex: this.__clipIndex,
      totalClips: this.__totalClips,
      type: 'speaker',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedSpeakerNode): SpeakerNode {
    const { speakerId, displayName, color, clipId, clipIndex, totalClips } = serializedNode;
    const node = new SpeakerNode(speakerId, displayName, color);
    if (clipId !== undefined && clipIndex !== undefined && totalClips !== undefined) {
      node.setClipInfo(clipId, clipIndex, totalClips);
    }
    return node;
  }

  // Text representation for copy/paste and export
  getTextContent(): string {
    return `[${this.__displayName}]: `;
  }
}

export function $createSpeakerNode(
  speakerId: string,
  displayName: string,
  color?: string
): SpeakerNode {
  return new SpeakerNode(speakerId, displayName, color);
}

export function $isSpeakerNode(node: LexicalNode | null | undefined): node is SpeakerNode {
  return node instanceof SpeakerNode;
}
