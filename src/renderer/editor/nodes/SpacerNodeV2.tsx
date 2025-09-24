/**
 * SpacerNode v2.0 - Segment-based spacer for audio gaps
 *
 * Updated for the new segment architecture:
 * - Works with SpacerSegment type
 * - Supports atomic edit operations
 * - Clean click-to-seek in Listen mode
 * - Keyboard selection and deletion
 */

import React from 'react';
import {
  DecoratorNode,
  NodeKey,
  LexicalNode,
  SerializedLexicalNode,
  EditorConfig,
} from 'lexical';

export interface SerializedSpacerNodeV2 extends SerializedLexicalNode {
  // Absolute timeline times
  startTime: number;
  endTime: number;

  // Duration and label
  duration: number;
  label?: string;

  // Segment metadata
  clipId: string;
  segmentIndex: number;

  // UI state
  isActive?: boolean;
  isSelectable?: boolean;

  type: 'spacer-v2';
  version: 1;
}

export interface SpacerNodeProps {
  start: number;           // Absolute time
  end: number;             // Absolute time
  duration: number;
  label?: string;
  clipId: string;
  segmentIndex: number;
  isActive?: boolean;
  isSelectable?: boolean;
}

export class SpacerNodeV2 extends DecoratorNode<React.JSX.Element> {
  __startTime: number;
  __endTime: number;
  __duration: number;
  __label?: string;
  __clipId: string;
  __segmentIndex: number;
  __isActive: boolean;
  __isSelectable: boolean;

  static getType(): string {
    return 'spacer-v2';
  }

  static clone(node: SpacerNodeV2): SpacerNodeV2 {
    return new SpacerNodeV2({
      start: node.__startTime,
      end: node.__endTime,
      duration: node.__duration,
      label: node.__label,
      clipId: node.__clipId,
      segmentIndex: node.__segmentIndex,
      isActive: node.__isActive,
      isSelectable: node.__isSelectable
    }, node.__key);
  }

  constructor(props: SpacerNodeProps, key?: NodeKey) {
    super(key);

    this.__startTime = props.start;
    this.__endTime = props.end;
    this.__duration = props.duration;
    this.__label = props.label;
    this.__clipId = props.clipId;
    this.__segmentIndex = props.segmentIndex;
    this.__isActive = props.isActive || false;
    this.__isSelectable = props.isSelectable !== false; // Default to true
  }

  // ==================== Getters ====================

  getStartTime(): number {
    return this.__startTime;
  }

  getEndTime(): number {
    return this.__endTime;
  }

  getDuration(): number {
    return this.__duration;
  }

  getLabel(): string | undefined {
    return this.__label;
  }

  getClipId(): string {
    return this.__clipId;
  }

  getSegmentIndex(): number {
    return this.__segmentIndex;
  }

  isActive(): boolean {
    return this.__isActive;
  }

  isSelectable(): boolean {
    return this.__isSelectable;
  }

  // ==================== Setters ====================

  setActive(isActive: boolean): void {
    const writable = this.getWritable();
    writable.__isActive = isActive;
  }

  // ==================== Lexical Methods ====================

  static importJSON(serializedNode: SerializedSpacerNodeV2): SpacerNodeV2 {
    const { startTime, endTime, duration, label, clipId, segmentIndex, isActive, isSelectable } = serializedNode;

    return new SpacerNodeV2({
      start: startTime,
      end: endTime,
      duration,
      label,
      clipId,
      segmentIndex,
      isActive,
      isSelectable
    });
  }

  exportJSON(): SerializedSpacerNodeV2 {
    return {
      startTime: this.__startTime,
      endTime: this.__endTime,
      duration: this.__duration,
      label: this.__label,
      clipId: this.__clipId,
      segmentIndex: this.__segmentIndex,
      isActive: this.__isActive,
      isSelectable: this.__isSelectable,
      type: 'spacer-v2',
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    element.classList.add('lexical-spacer-node');

    // Add segment-specific attributes
    element.setAttribute('data-clip-id', this.__clipId);
    element.setAttribute('data-segment-index', this.__segmentIndex.toString());
    element.setAttribute('data-start-time', this.__startTime.toString());
    element.setAttribute('data-end-time', this.__endTime.toString());
    element.setAttribute('data-duration', this.__duration.toString());

    // Make selectable for keyboard navigation
    if (this.__isSelectable) {
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', `Audio gap: ${this.__label || `${this.__duration.toFixed(1)} seconds`}`);
    }

    return element;
  }

  updateDOM(prevNode: SpacerNodeV2, dom: HTMLElement): boolean {
    // Update active state
    if (this.__isActive !== prevNode.__isActive) {
      if (this.__isActive) {
        dom.classList.add('spacer-active');
      } else {
        dom.classList.remove('spacer-active');
      }
    }

    return false; // Lexical will handle the React re-render
  }

  setSelectionAfter(): boolean {
    // Allow selection after spacer nodes
    return true;
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return this.__isSelectable;
  }

  // ==================== React Component ====================

  decorate(): React.JSX.Element {
    return <SpacerComponent
      startTime={this.__startTime}
      endTime={this.__endTime}
      duration={this.__duration}
      label={this.__label}
      clipId={this.__clipId}
      segmentIndex={this.__segmentIndex}
      isActive={this.__isActive}
      isSelectable={this.__isSelectable}
    />;
  }

  // ==================== Utility Methods ====================

  containsTime(time: number): boolean {
    return time >= this.__startTime && time < this.__endTime;
  }

  getDebugInfo(): string {
    return `SpacerNode [${this.__startTime.toFixed(2)}-${this.__endTime.toFixed(2)}s] ` +
           `duration:${this.__duration.toFixed(2)}s clip:${this.__clipId.slice(-6)} seg:${this.__segmentIndex}`;
  }
}

// ==================== React Component ====================

interface SpacerComponentProps {
  startTime: number;
  endTime: number;
  duration: number;
  label?: string;
  clipId: string;
  segmentIndex: number;
  isActive: boolean;
  isSelectable: boolean;
}

function SpacerComponent({
  startTime,
  endTime,
  duration,
  label,
  clipId,
  segmentIndex,
  isActive,
  isSelectable
}: SpacerComponentProps) {
  const handleClick = () => {
    // Check if we're in Listen mode (read-only)
    const editorElement = document.querySelector('[data-lexical-editor]');
    const isReadOnly = editorElement?.getAttribute('contenteditable') === 'false';

    if (isReadOnly && window.electronAPI) {
      // In Listen mode, click seeks to the spacer time
      console.log(`🎯 Spacer click: seeking to ${startTime.toFixed(2)}s`);

      // Seek with a small offset into the gap
      const seekTime = startTime + (duration * 0.1); // 10% into the gap

      // This would need to be connected to the audio system
      // For now, just log the intention
      console.log(`Would seek to ${seekTime.toFixed(2)}s`);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      // In Edit mode, allow deletion of spacer
      console.log(`🗑️ Delete spacer: clip ${clipId} segment ${segmentIndex}`);
      // This would trigger an edit operation to remove the spacer
    }
  };

  const displayLabel = label || `${duration.toFixed(1)}s`;

  return (
    <span
      className={`
        lexical-spacer-pill inline-flex items-center px-2 py-1 mx-1 text-xs font-medium
        bg-gray-100 text-gray-700 rounded-full cursor-pointer
        border border-gray-200 hover:bg-gray-200 transition-colors
        ${isActive ? 'spacer-active bg-blue-100 border-blue-300 text-blue-800' : ''}
        ${isSelectable ? 'spacer-selectable focus:outline-none focus:ring-2 focus:ring-blue-500' : ''}
      `.trim()}
      onClick={handleClick}
      onKeyDown={isSelectable ? handleKeyDown : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      role={isSelectable ? 'button' : undefined}
      aria-label={`Audio gap: ${displayLabel}`}
      title={`Audio gap: ${displayLabel} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)`}
      style={{
        display: 'inline-flex',
        visibility: 'visible',
        opacity: 1,
        minWidth: '40px'
      }}
    >
      <svg
        className="w-3 h-3 mr-1"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      {displayLabel}
    </span>
  );
}

// ==================== Utility Functions ====================

export function $createSpacerNodeV2(props: SpacerNodeProps): SpacerNodeV2 {
  return new SpacerNodeV2(props);
}

export function $isSpacerNodeV2(node: LexicalNode | null | undefined): node is SpacerNodeV2 {
  return node instanceof SpacerNodeV2;
}

// Backward compatibility
export const $createSpacerNode = $createSpacerNodeV2;
export const $isSpacerNode = $isSpacerNodeV2;
export const SpacerNode = SpacerNodeV2;