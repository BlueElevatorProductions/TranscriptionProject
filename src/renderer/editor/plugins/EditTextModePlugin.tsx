/**
 * EditTextModePlugin - Implements Edit Text Mode specific features
 *
 * Features:
 * - Visible clip boxes with speaker labels and controls
 * - Enter key clip splitting at cursor position
 * - Drag & drop clip reordering
 * - Clip selection and multi-select
 * - Visual editing affordances and hints
 * - Word-level editing with immediate feedback
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $getNodeByKey,
  $getRoot
} from 'lexical';

import { $isWordNodeV2 } from '../nodes/WordNodeV2';
import { $isSpacerNodeV2 } from '../nodes/SpacerNodeV2';
import { $isClipNodeV2 } from '../nodes/ClipNodeV2';

export interface EditTextModePluginProps {
  isEditTextMode: boolean;
  onClipSplit?: (clipId: string, segmentIndex: number) => void;
  onClipReorder?: (clipId: string, newOrder: number) => void;
  onClipSelect?: (clipId: string | null) => void;
  selectedClipId?: string | null;
}

export default function EditTextModePlugin({
  isEditTextMode,
  onClipSplit,
  onClipReorder,
  onClipSelect,
  selectedClipId
}: EditTextModePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dragOverClipId, setDragOverClipId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);

  // ==================== CSS Injection for Edit Text Mode ====================

  useEffect(() => {
    if (!isEditTextMode) return;

    const styleId = 'edit-text-mode-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      /* Edit Text Mode: Visible clip boxes */
      .lexical-editor-v2[data-edit-text-mode="true"] .lexical-clip-container {
        margin: 16px 0;
        padding: 16px;
        border: 2px solid hsl(var(--border));
        border-radius: 8px;
        background: hsl(var(--card));
        box-shadow: 0 2px 4px hsl(var(--border) / 0.1);
        position: relative;
        transition: all 0.2s ease;
      }

      /* Clip hover effects */
      .lexical-editor-v2[data-edit-text-mode="true"] .lexical-clip-container:hover {
        border-color: hsl(var(--accent));
        box-shadow: 0 4px 8px hsl(var(--border) / 0.2);
      }

      /* Selected clip highlighting */
      .lexical-clip-container.selected {
        border-color: hsl(var(--primary)) !important;
        background: hsl(var(--primary) / 0.05);
        box-shadow: 0 0 0 1px hsl(var(--primary)), 0 4px 12px hsl(var(--primary) / 0.3);
      }

      /* Speaker label styling */
      .clip-speaker-label {
        position: absolute;
        top: -12px;
        left: 12px;
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        z-index: 10;
        cursor: pointer;
      }

      /* Clip controls */
      .clip-controls {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .lexical-clip-container:hover .clip-controls {
        opacity: 1;
      }

      .clip-control-btn {
        background: hsl(var(--secondary));
        color: hsl(var(--secondary-foreground));
        border: none;
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .clip-control-btn:hover {
        background: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
      }

      /* Drag and drop styling */
      .lexical-clip-container.dragging {
        opacity: 0.7;
        transform: rotate(2deg);
        z-index: 1000;
        cursor: grabbing;
      }

      .lexical-clip-container.drag-over {
        border-color: hsl(var(--primary));
        background: hsl(var(--primary) / 0.1);
      }

      .lexical-clip-container.drag-target::before {
        content: "";
        position: absolute;
        top: -8px;
        left: 0;
        right: 0;
        height: 4px;
        background: hsl(var(--primary));
        border-radius: 2px;
      }

      /* Word selection enhancements (editing disabled) */
      .lexical-word-node {
        cursor: pointer !important;
        border-radius: 3px !important;
        padding: 2px 4px !important;
        transition: all 0.2s ease !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }

      .lexical-word-node:hover {
        font-weight: bold !important;
        /* Clean hover effect without boxes */
      }

      .lexical-word-node.word-selected {
        background: hsl(var(--primary) / 0.15) !important;
        outline: none !important;
        font-weight: bold !important;
        border-radius: 3px !important;
        /* Subtle selection without heavy borders */
      }

      .lexical-word-node:focus {
        outline: 2px solid hsl(var(--ring)) !important;
        outline-offset: 2px !important;
      }

      /* Spacer enhancements for editing */
      .lexical-spacer-node {
        background: hsl(var(--muted)) !important;
        color: hsl(var(--muted-foreground)) !important;
        padding: 4px 8px !important;
        border-radius: 12px !important;
        margin: 0 3px !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        min-width: 40px !important;
        text-align: center !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        border: 1px solid hsl(var(--border)) !important;
        transition: all 0.2s ease !important;
        opacity: 1 !important;
        visibility: visible !important;
        position: relative !important;
        z-index: 1 !important;
      }

      .lexical-spacer-node:hover {
        background: hsl(var(--accent)) !important;
        color: hsl(var(--accent-foreground)) !important;
        transform: scale(1.05) !important;
        /* Clean hover effect for spacers */
      }

      .lexical-spacer-node:focus {
        outline: 2px solid hsl(var(--ring)) !important;
        outline-offset: 2px !important;
      }

      .lexical-spacer-node.spacer-selected {
        background: hsl(var(--primary) / 0.25) !important;
        color: hsl(var(--primary-foreground)) !important;
        font-weight: bold !important;
        transform: scale(1.05) !important;
        box-shadow: 0 2px 6px hsl(var(--primary) / 0.2) !important;
        /* Consistent with word selection styling */
      }

      /* Ensure spacer children are visible */
      .lexical-spacer-node svg {
        display: inline-block !important;
        margin-right: 4px !important;
        opacity: 0.7 !important;
      }

      /* Make sure spacers show up in different contexts */
      .lexical-editor-v2[data-edit-text-mode="true"] .lexical-spacer-node {
        display: inline-flex !important;
        visibility: visible !important;
      }

      /* Selection indicators and hints */
      .word-selected::after,
      .spacer-selected::after {
        content: "Press Enter to split";
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        background: hsl(var(--popover));
        color: hsl(var(--popover-foreground));
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        white-space: nowrap;
        border: 1px solid hsl(var(--border));
        z-index: 100;
        pointer-events: none;
      }

      /* Split indicator */
      .split-indicator {
        position: absolute;
        width: 2px;
        height: 100%;
        background: hsl(var(--primary));
        z-index: 100;
        pointer-events: none;
        animation: splitIndicatorPulse 1s ease-in-out infinite;
      }

      @keyframes splitIndicatorPulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }

      /* Editing hints */
      .edit-hint {
        position: absolute;
        bottom: -24px;
        left: 0;
        font-size: 11px;
        color: hsl(var(--muted-foreground));
        background: hsl(var(--popover));
        padding: 2px 6px;
        border-radius: 3px;
        border: 1px solid hsl(var(--border));
        white-space: nowrap;
        z-index: 10;
      }

      /* Multi-select indicators */
      .lexical-clip-container.multi-selected {
        border-color: hsl(var(--accent));
        background: hsl(var(--accent) / 0.1);
      }

      .lexical-clip-container.multi-selected::after {
        content: "✓";
        position: absolute;
        top: 8px;
        left: 8px;
        background: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      }

      /* Responsive clip layout */
      @media (max-width: 768px) {
        .lexical-clip-container {
          margin: 12px 0;
          padding: 12px;
        }

        .clip-controls {
          position: static;
          opacity: 1;
          margin-top: 8px;
        }
      }

      /* Enhanced focus states */
      .lexical-clip-container:focus-within {
        border-color: hsl(var(--ring));
        box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
      }

      /* Time indicators */
      .clip-time-indicator {
        position: absolute;
        bottom: 8px;
        right: 8px;
        font-size: 10px;
        color: hsl(var(--muted-foreground));
        background: hsl(var(--muted));
        padding: 2px 4px;
        border-radius: 2px;
      }
    `;

    return () => {
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [isEditTextMode]);

  // ==================== Editor DOM Updates ====================

  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    if (isEditTextMode) {
      editorElement.setAttribute('data-edit-text-mode', 'true');
    } else {
      editorElement.removeAttribute('data-edit-text-mode');
    }

    return () => {
      if (editorElement) {
        editorElement.removeAttribute('data-edit-text-mode');
      }
    };
  }, [isEditTextMode, editor]);

  // ==================== Enter Key Splitting ====================

  useEffect(() => {
    if (!isEditTextMode) return;

    const removeEnterCommand = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        // Handle Enter key for clip splitting
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
          return handleEnterKeySplit();
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );

    return removeEnterCommand;
  }, [isEditTextMode, editor, onClipSplit, selectedElement]);

  const handleEnterKeySplit = (): boolean => {
    // Check if we have a selected word or spacer element
    if (!selectedElement) {
      console.log('🚫 No word or spacer selected for splitting');
      return false;
    }

    // Get the data attributes from the selected element
    const clipId = selectedElement.getAttribute('data-clip-id');
    const segmentIndex = selectedElement.getAttribute('data-segment-index');

    if (clipId && segmentIndex !== null && onClipSplit) {
      const segmentIndexNum = parseInt(segmentIndex);
      console.log('🎯 Splitting clip at selected element:', {
        clipId,
        segmentIndex: segmentIndexNum,
        elementType: selectedElement.classList.contains('lexical-word-node') ? 'word' : 'spacer'
      });

      onClipSplit(clipId, segmentIndexNum);

      // Clear selection after split
      setSelectedElement(null);
      selectedElement.classList.remove('word-selected', 'spacer-selected');

      return true;
    }

    console.log('🚫 Selected element missing required data for splitting:', { clipId, segmentIndex });
    return false;
  };

  // ==================== Clip Selection ====================

  useEffect(() => {
    if (!isEditTextMode) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clipContainer = target.closest('.lexical-clip-container') as HTMLElement;

      if (clipContainer) {
        const clipId = clipContainer.getAttribute('data-clip-id');

        if (clipId && onClipSelect) {
          // Handle multi-select with Ctrl/Cmd key
          if (event.ctrlKey || event.metaKey) {
            // Toggle selection
            onClipSelect(selectedClipId === clipId ? null : clipId);
          } else {
            onClipSelect(clipId);
          }
        }
      }
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('click', handleClick);
      return () => editorElement.removeEventListener('click', handleClick);
    }
  }, [isEditTextMode, editor, onClipSelect, selectedClipId]);

  // ==================== Drag and Drop ====================

  useEffect(() => {
    if (!isEditTextMode) return;

    const handleDragStart = (event: DragEvent) => {
      const target = event.target as HTMLElement;
      const clipContainer = target.closest('.lexical-clip-container') as HTMLElement;

      if (clipContainer) {
        const clipId = clipContainer.getAttribute('data-clip-id');
        if (clipId) {
          setDraggedClipId(clipId);
          clipContainer.classList.add('dragging');

          // Set drag data
          event.dataTransfer?.setData('text/clip-id', clipId);
          event.dataTransfer!.effectAllowed = 'move';
        }
      }
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';

      const target = event.target as HTMLElement;
      const clipContainer = target.closest('.lexical-clip-container') as HTMLElement;

      if (clipContainer && draggedClipId) {
        const clipId = clipContainer.getAttribute('data-clip-id');
        if (clipId && clipId !== draggedClipId) {
          setDragOverClipId(clipId);
          clipContainer.classList.add('drag-over');
        }
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      const target = event.target as HTMLElement;
      const clipContainer = target.closest('.lexical-clip-container') as HTMLElement;

      if (clipContainer) {
        clipContainer.classList.remove('drag-over');
      }
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();

      const target = event.target as HTMLElement;
      const clipContainer = target.closest('.lexical-clip-container') as HTMLElement;

      if (clipContainer && draggedClipId) {
        const targetClipId = clipContainer.getAttribute('data-clip-id');
        const targetOrder = clipContainer.getAttribute('data-clip-order');

        if (targetClipId && targetOrder && onClipReorder) {
          console.log('🔄 Reordering clip:', { draggedClipId, targetOrder: parseInt(targetOrder) });
          onClipReorder(draggedClipId, parseInt(targetOrder));
        }
      }

      // Cleanup
      cleanup();
    };

    const handleDragEnd = () => {
      cleanup();
    };

    const cleanup = () => {
      // Remove all drag-related classes
      const editorElement = editor.getRootElement();
      if (editorElement) {
        const clips = editorElement.querySelectorAll('.lexical-clip-container');
        clips.forEach(clip => {
          clip.classList.remove('dragging', 'drag-over', 'drag-target');
        });
      }

      setDraggedClipId(null);
      setDragOverClipId(null);
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('dragstart', handleDragStart);
      editorElement.addEventListener('dragover', handleDragOver);
      editorElement.addEventListener('dragleave', handleDragLeave);
      editorElement.addEventListener('drop', handleDrop);
      editorElement.addEventListener('dragend', handleDragEnd);

      return () => {
        editorElement.removeEventListener('dragstart', handleDragStart);
        editorElement.removeEventListener('dragover', handleDragOver);
        editorElement.removeEventListener('dragleave', handleDragLeave);
        editorElement.removeEventListener('drop', handleDrop);
        editorElement.removeEventListener('dragend', handleDragEnd);
      };
    }
  }, [isEditTextMode, editor, draggedClipId, onClipReorder]);

  // ==================== Visual Enhancements ====================

  useEffect(() => {
    if (!isEditTextMode) return;

    // Add clip controls and labels to existing clips
    const addClipEnhancements = () => {
      const editorElement = editor.getRootElement();
      if (!editorElement) return;

      const clipContainers = editorElement.querySelectorAll('.lexical-clip-container');

      clipContainers.forEach((container) => {
        const clipElement = container as HTMLElement;
        const clipId = clipElement.getAttribute('data-clip-id');
        const speaker = clipElement.getAttribute('data-speaker');
        const startTime = clipElement.getAttribute('data-start-time');
        const endTime = clipElement.getAttribute('data-end-time');

        // Add draggable attribute
        clipElement.draggable = true;

        // Add speaker label if not exists
        if (speaker && !clipElement.querySelector('.clip-speaker-label')) {
          const speakerLabel = document.createElement('div');
          speakerLabel.className = 'clip-speaker-label';
          speakerLabel.textContent = speaker;
          speakerLabel.setAttribute('data-speaker', speaker);
          clipElement.appendChild(speakerLabel);
        }

        // Add clip controls if not exists
        if (!clipElement.querySelector('.clip-controls')) {
          const controls = document.createElement('div');
          controls.className = 'clip-controls';

          const splitBtn = document.createElement('button');
          splitBtn.className = 'clip-control-btn';
          splitBtn.textContent = '✂️';
          splitBtn.title = 'Split clip (Enter)';

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'clip-control-btn';
          deleteBtn.textContent = '🗑️';
          deleteBtn.title = 'Delete clip';

          controls.appendChild(splitBtn);
          controls.appendChild(deleteBtn);
          clipElement.appendChild(controls);
        }

        // Add time indicator if not exists
        if (startTime && endTime && !clipElement.querySelector('.clip-time-indicator')) {
          const timeIndicator = document.createElement('div');
          timeIndicator.className = 'clip-time-indicator';
          const start = parseFloat(startTime);
          const end = parseFloat(endTime);
          timeIndicator.textContent = `${start.toFixed(1)}s - ${end.toFixed(1)}s`;
          clipElement.appendChild(timeIndicator);
        }

        // Apply selection state
        if (selectedClipId === clipId) {
          clipElement.classList.add('selected');
        } else {
          clipElement.classList.remove('selected');
        }
      });
    };

    // Initial setup
    addClipEnhancements();

    // Setup observer for dynamic content
    const observer = new MutationObserver(addClipEnhancements);
    const editorElement = editor.getRootElement();

    if (editorElement) {
      observer.observe(editorElement, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [isEditTextMode, editor, selectedClipId]);

  // ==================== Word/Spacer Selection for Splitting ====================
  // Note: Word editing disabled - words and spacers are now only selectable for clip splitting

  useEffect(() => {
    if (!isEditTextMode) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Handle word/spacer selection (not editing)
      if (target.classList.contains('lexical-word-node') || target.classList.contains('lexical-spacer-node')) {
        // Clear previous selections
        const editorElement = editor.getRootElement();
        if (editorElement) {
          const allSelectables = editorElement.querySelectorAll('.word-selected, .spacer-selected');
          allSelectables.forEach(el => el.classList.remove('word-selected', 'spacer-selected'));
        }

        // Update selected element state
        setSelectedElement(target);

        // Add selection to current element
        if (target.classList.contains('lexical-word-node')) {
          target.classList.add('word-selected');
        } else if (target.classList.contains('lexical-spacer-node')) {
          target.classList.add('spacer-selected');
        }
      } else {
        // Click elsewhere clears selection
        setSelectedElement(null);
        const editorElement = editor.getRootElement();
        if (editorElement) {
          const allSelectables = editorElement.querySelectorAll('.word-selected, .spacer-selected');
          allSelectables.forEach(el => el.classList.remove('word-selected', 'spacer-selected'));
        }
      }
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('click', handleClick);
      return () => editorElement.removeEventListener('click', handleClick);
    }
  }, [isEditTextMode, editor]);

  // ==================== Debug Information ====================

  useEffect(() => {
    if (isEditTextMode) {
      console.log('✏️ Edit Text Mode activated');
      console.log('Selected clip:', selectedClipId);
      console.log('Dragged clip:', draggedClipId);
      console.log('Selected element:', selectedElement?.classList.toString() || 'none');
    } else {
      console.log('✏️ Edit Text Mode deactivated');
    }
  }, [isEditTextMode, selectedClipId, draggedClipId, selectedElement]);

  return null; // This plugin doesn't render anything
}

// ==================== Utility Functions ====================

/**
 * Find the clip container for a given element
 */
function findClipContainer(element: HTMLElement): HTMLElement | null {
  return element.closest('.lexical-clip-container') as HTMLElement;
}

/**
 * Get clip order from container
 */
function getClipOrder(container: HTMLElement): number | null {
  const orderAttr = container.getAttribute('data-clip-order');
  return orderAttr ? parseInt(orderAttr) : null;
}

/**
 * Check if element is within a clip
 */
function isWithinClip(element: HTMLElement): boolean {
  return !!element.closest('.lexical-clip-container');
}