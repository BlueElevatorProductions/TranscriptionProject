/**
 * SpeakerNode - Lexical DecoratorNode for interactive speaker labels
 * Provides inline speaker editing and styling
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { 
  DecoratorNode, 
  NodeKey, 
  LexicalNode, 
  SerializedLexicalNode,
  EditorConfig
} from 'lexical';

export interface SerializedSpeakerNode extends SerializedLexicalNode {
  speakerId: string;
  displayName: string;
  color?: string;
}

export interface SpeakerComponentProps {
  speakerId: string;
  displayName: string;
  color?: string;
  onSpeakerChange?: (speakerId: string, newName: string) => void;
  nodeKey: NodeKey;
}

function SpeakerComponent({
  speakerId,
  displayName,
  color,
  onSpeakerChange,
  nodeKey
}: SpeakerComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditStart = useCallback(() => {
    setIsEditing(true);
    setEditValue(displayName);
  }, [displayName]);

  const handleEditSave = useCallback(() => {
    if (editValue.trim() && editValue.trim() !== displayName) {
      onSpeakerChange?.(speakerId, editValue.trim());
    }
    setIsEditing(false);
  }, [editValue, displayName, speakerId, onSpeakerChange]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(displayName);
  }, [displayName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  }, [handleEditSave, handleEditCancel]);

  const handleBlur = useCallback(() => {
    handleEditSave();
  }, [handleEditSave]);

  // Speaker color styling
  const colorStyles = color ? {
    color: color,
    borderColor: color + '40', // Add some transparency
    backgroundColor: color + '10' // Very light background
  } : {
    color: '#374151',
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb'
  };

  if (isEditing) {
    return (
      <span className="lexical-speaker-node-editing inline-block">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="inline-block px-2 py-1 text-sm font-medium rounded border-2 border-blue-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          style={{ 
            minWidth: '80px',
            width: `${Math.max(editValue.length * 8 + 16, 80)}px`
          }}
        />
      </span>
    );
  }

  return (
    <span 
      className="lexical-speaker-node inline-flex items-center px-2 py-1 text-sm font-medium rounded-md border cursor-pointer hover:opacity-80 transition-opacity select-none mr-2"
      style={colorStyles}
      onClick={handleEditStart}
      title={`Click to edit speaker name (${speakerId})`}
      contentEditable={false}
      suppressContentEditableWarning={true}
    >
      <span className="speaker-icon mr-1" role="img" aria-label="speaker">
        🎙️
      </span>
      {displayName}
    </span>
  );
}

export class SpeakerNode extends DecoratorNode<React.JSX.Element> {
  __speakerId: string;
  __displayName: string;
  __color?: string;

  static getType(): string {
    return 'speaker';
  }

  static clone(node: SpeakerNode): SpeakerNode {
    return new SpeakerNode(
      node.__speakerId,
      node.__displayName,
      node.__color,
      node.__key
    );
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
      />
    );
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  // Selection behavior
  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return true;
  }

  // Serialization
  exportJSON(): SerializedSpeakerNode {
    return {
      speakerId: this.__speakerId,
      displayName: this.__displayName,
      color: this.__color,
      type: 'speaker',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedSpeakerNode): SpeakerNode {
    const { speakerId, displayName, color } = serializedNode;
    return new SpeakerNode(speakerId, displayName, color);
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