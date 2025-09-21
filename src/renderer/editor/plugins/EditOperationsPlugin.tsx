/**
 * EditOperationsPlugin - Handles user interactions for atomic edit operations
 *
 * This plugin bridges user interactions (clicks, keyboard, context menu)
 * with the atomic edit operations system.
 *
 * Key features:
 * - Word double-click editing
 * - Keyboard shortcuts for split/merge/delete
 * - Context menu for edit operations
 * - Visual feedback during operations
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_BACKSPACE_COMMAND,
  CLICK_COMMAND,
  $getNodeByKey,
} from 'lexical';

import { $isWordNodeV2 } from '../nodes/WordNodeV2';
import { $isSpacerNodeV2 } from '../nodes/SpacerNodeV2';
import { $isClipNodeV2 } from '../nodes/ClipNodeV2';
import { useEditOperations } from '../../hooks/useEditOperations';
import { useProjectV2 } from '../../contexts/ProjectContextV2';

export interface EditOperationsPluginProps {
  isReadOnly?: boolean;
  onWordEdit?: (clipId: string, segmentIndex: number, oldText: string, newText: string) => void;
  onClipSplit?: (clipId: string, segmentIndex: number) => void;
  onOperationStart?: (operationType: string) => void;
  onOperationComplete?: (operationType: string, success: boolean) => void;
}

export default function EditOperationsPlugin({
  isReadOnly = false,
  onWordEdit,
  onClipSplit,
  onOperationStart,
  onOperationComplete
}: EditOperationsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const editOps = useEditOperations();
  const { state: projectState } = useProjectV2();

  // ==================== Word Editing ====================

  useEffect(() => {
    if (isReadOnly) return;

    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is on a word node
      if (target.classList.contains('lexical-word-node')) {
        event.preventDefault();
        handleWordDoubleClick(target);
      }
    };

    const handleWordDoubleClick = async (element: HTMLElement) => {
      const clipId = element.getAttribute('data-clip-id');
      const segmentIndex = element.getAttribute('data-segment-index');

      if (!clipId || !segmentIndex) return;

      const currentText = element.textContent || '';
      const newText = prompt('Edit word:', currentText);

      if (newText !== null && newText !== currentText) {
        onOperationStart?.('editWord');

        const result = await editOps.editWord(clipId, parseInt(segmentIndex), newText);

        onOperationComplete?.('editWord', result.success);

        if (result.success) {
          onWordEdit?.(clipId, parseInt(segmentIndex), currentText, newText);
        }
      }
    };

    // Add event listener for double-clicks
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('dblclick', handleDoubleClick);
      return () => editorElement.removeEventListener('dblclick', handleDoubleClick);
    }
  }, [editor, isReadOnly, editOps, onWordEdit, onOperationStart, onOperationComplete]);

  // ==================== Keyboard Shortcuts ====================

  useEffect(() => {
    if (isReadOnly) return;

    // Enter key - Split clip at cursor position
    const removeEnterCommand = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        if (event.shiftKey) {
          return handleClipSplit();
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    // Delete key - Delete selected clips or spacers
    const removeDeleteCommand = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey) {
          return handleDeleteSelection();
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    // Backspace key - Also handle deletion
    const removeBackspaceCommand = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey) {
          return handleDeleteSelection();
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      removeEnterCommand();
      removeDeleteCommand();
      removeBackspaceCommand();
    };
  }, [editor, isReadOnly]);

  // ==================== Click Handling ====================

  useEffect(() => {
    const removeClickCommand = editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        return handleClick(event);
      },
      COMMAND_PRIORITY_LOW
    );

    return removeClickCommand;
  }, [editor, isReadOnly]);

  // ==================== Operation Handlers ====================

  const handleClipSplit = (): boolean => {
    if (isReadOnly) return false;

    return editor.getEditorState().read(() => {
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        let clipId: string | null = null;
        let segmentIndex: number | null = null;

        // Find the word node or spacer node
        if ($isWordNodeV2(node)) {
          clipId = node.getClipId();
          segmentIndex = node.getSegmentIndex();
        } else if ($isSpacerNodeV2(node)) {
          clipId = node.getClipId();
          segmentIndex = node.getSegmentIndex();
        }

        if (clipId && segmentIndex !== null) {
          // Perform split operation
          performClipSplit(clipId, segmentIndex);
          return true;
        }
      }

      return false;
    });
  };

  const handleDeleteSelection = (): boolean => {
    if (isReadOnly) return false;

    return editor.getEditorState().read(() => {
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();

        // Find selected clips or spacers
        const clipsToDelete = new Set<string>();
        const spacersToDelete: Array<{ clipId: string; segmentIndex: number }> = [];

        for (const node of nodes) {
          if ($isClipNodeV2(node)) {
            clipsToDelete.add(node.getClipId());
          } else if ($isSpacerNodeV2(node)) {
            spacersToDelete.push({
              clipId: node.getClipId(),
              segmentIndex: node.getSegmentIndex()
            });
          }
        }

        // Perform deletions
        if (clipsToDelete.size > 0) {
          performClipDeletion(Array.from(clipsToDelete));
          return true;
        }

        if (spacersToDelete.length > 0) {
          performSpacerDeletion(spacersToDelete);
          return true;
        }
      }

      return false;
    });
  };

  const handleClick = (event: MouseEvent): boolean => {
    // In read-only mode, handle click-to-seek
    if (isReadOnly) {
      const target = event.target as HTMLElement;

      // Check for spacer click
      if (target.closest('.lexical-spacer-node')) {
        const spacerElement = target.closest('.lexical-spacer-node') as HTMLElement;
        const startTime = spacerElement.getAttribute('data-start-time');

        if (startTime) {
          // Seek to spacer time
          const time = parseFloat(startTime);
          handleSpacerSeek(time);
          return true;
        }
      }

      // Check for word click
      if (target.classList.contains('lexical-word-node')) {
        const startTime = target.getAttribute('data-start-time');

        if (startTime) {
          // Seek to word time
          const time = parseFloat(startTime);
          handleWordSeek(time);
          return true;
        }
      }
    }

    return false;
  };

  // ==================== Operation Implementations ====================

  const performClipSplit = async (clipId: string, segmentIndex: number) => {
    onOperationStart?.('splitClip');

    const result = await editOps.splitClip(clipId, segmentIndex);

    onOperationComplete?.('splitClip', result.success);

    if (result.success) {
      onClipSplit?.(clipId, segmentIndex);
    }
  };

  const performClipDeletion = async (clipIds: string[]) => {
    onOperationStart?.('deleteClip');

    const results = await Promise.all(
      clipIds.map(id => editOps.deleteClip(id))
    );

    const success = results.every(r => r.success);
    onOperationComplete?.('deleteClip', success);
  };

  const performSpacerDeletion = async (spacers: Array<{ clipId: string; segmentIndex: number }>) => {
    onOperationStart?.('deleteSpacer');

    const results = await Promise.all(
      spacers.map(({ clipId, segmentIndex }) => editOps.deleteSpacer(clipId, segmentIndex))
    );

    const success = results.every(r => r.success);
    onOperationComplete?.('deleteSpacer', success);
  };

  const handleSpacerSeek = (time: number) => {
    console.log(`🎯 Seeking to spacer time: ${time.toFixed(2)}s`);
    // This would integrate with the audio system
    // For now, just log the intention
  };

  const handleWordSeek = (time: number) => {
    console.log(`🎯 Seeking to word time: ${time.toFixed(2)}s`);
    // This would integrate with the audio system
    // For now, just log the intention
  };

  // ==================== Context Menu ====================

  useEffect(() => {
    if (isReadOnly) return;

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (target.classList.contains('lexical-word-node') ||
          target.closest('.lexical-spacer-node') ||
          target.closest('.lexical-clip-container')) {

        event.preventDefault();
        showContextMenu(event, target);
      }
    };

    const showContextMenu = (event: MouseEvent, target: HTMLElement) => {
      // This would show a context menu with edit operations
      // For now, just log what would be available

      const clipId = target.getAttribute('data-clip-id') ||
                    target.closest('[data-clip-id]')?.getAttribute('data-clip-id');

      if (clipId) {
        console.log('📋 Context menu for clip:', clipId);
        console.log('Available operations: Edit Word, Split Clip, Delete Clip, Change Speaker');
      }
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('contextmenu', handleContextMenu);
      return () => editorElement.removeEventListener('contextmenu', handleContextMenu);
    }
  }, [editor, isReadOnly]);

  // ==================== Operation Status Display ====================

  useEffect(() => {
    if (editOps.operationState.isLoading) {
      console.log('⏳ Edit operation in progress...');
    }

    if (editOps.operationState.error) {
      console.error('❌ Edit operation error:', editOps.operationState.error);
    }

    if (editOps.operationState.lastOperation) {
      console.log('✅ Last operation:', editOps.operationState.lastOperation.type);
    }
  }, [editOps.operationState]);

  return null; // This plugin doesn't render anything
}

// ==================== Utility Functions ====================

/**
 * Extract clip and segment info from DOM element
 */
function getElementContext(element: HTMLElement): {
  clipId: string | null;
  segmentIndex: number | null;
} {
  const clipId = element.getAttribute('data-clip-id') ||
                 element.closest('[data-clip-id]')?.getAttribute('data-clip-id');

  const segmentIndexStr = element.getAttribute('data-segment-index') ||
                          element.closest('[data-segment-index]')?.getAttribute('data-segment-index');

  return {
    clipId: clipId || null,
    segmentIndex: segmentIndexStr ? parseInt(segmentIndexStr) : null
  };
}

/**
 * Check if an element represents an editable segment
 */
function isEditableSegment(element: HTMLElement): boolean {
  return element.classList.contains('lexical-word-node') ||
         element.closest('.lexical-spacer-node') !== null;
}