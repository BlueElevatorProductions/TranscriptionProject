/**
 * ClipCreationPlugin - Handles clip creation and management
 * Allows users to select text ranges and create clips with Material Tailwind components
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getRoot, 
  $getSelection, 
  $isRangeSelection,
  $setSelection
} from 'lexical';
import { WordNode, $isWordNode } from '../nodes/WordNode';
import { ClipNode, $createClipNode } from '../nodes/ClipNode';
import { Button, Input, Textarea, Dialog, DialogHeader, DialogBody, DialogFooter, Typography } from '@material-tailwind/react';
import { PlusIcon } from '@heroicons/react/24/outline';

interface ClipCreationPluginProps {
  onClipCreate?: (clip: {
    id: string;
    title: string;
    text: string;
    startTime: number;
    endTime: number;
    speakerId: string;
    type: 'user-created' | 'auto-generated' | 'highlight';
  }) => void;
  onClipEdit?: (clipId: string, updates: Partial<{
    title: string;
    text: string;
    startTime: number;
    endTime: number;
  }>) => void;
  onClipDelete?: (clipId: string) => void;
  onClipPlay?: (startTime: number) => void;
}

interface ClipCreationState {
  isDialogOpen: boolean;
  selectedText: string;
  startTime: number;
  endTime: number;
  speakerId: string;
  title: string;
  clipType: 'user-created' | 'auto-generated' | 'highlight';
}

export default function ClipCreationPlugin({
  onClipCreate,
  onClipEdit,
  onClipDelete,
  onClipPlay,
}: ClipCreationPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [creationState, setCreationState] = useState<ClipCreationState>({
    isDialogOpen: false,
    selectedText: '',
    startTime: 0,
    endTime: 0,
    speakerId: '',
    title: '',
    clipType: 'user-created'
  });

  // Handle text selection for clip creation
  const handleSelectionChange = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        const nodes = selection.getNodes();
        const wordNodes = nodes.filter($isWordNode);
        
        if (wordNodes.length > 0) {
          // Enable clip creation button or show selection indicator
          const firstWord = wordNodes[0] as WordNode;
          const lastWord = wordNodes[wordNodes.length - 1] as WordNode;
          
          // Add visual indicator for selected text range
          addSelectionIndicator(firstWord.getStart(), lastWord.getEnd());
        }
      } else {
        // Remove selection indicator
        removeSelectionIndicator();
      }
    });
  }, [editor]);

  // Add visual indicator for clip-able selection
  const addSelectionIndicator = (startTime: number, endTime: number) => {
    // Add floating button or indicator near selection
    const indicator = document.getElementById('clip-creation-indicator');
    if (!indicator) {
      const button = document.createElement('button');
      button.id = 'clip-creation-indicator';
      button.className = 'fixed z-50 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg transition-all duration-200 flex items-center gap-1';
      button.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Create Clip
      `;
      
      button.addEventListener('click', () => {
        createClipFromSelection();
      });
      
      // Position near mouse cursor or selection
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        button.style.left = `${rect.left + rect.width / 2 - 50}px`;
        button.style.top = `${rect.top - 40}px`;
      }
      
      document.body.appendChild(button);
      
      // Auto-remove after delay if not used
      setTimeout(() => {
        if (document.getElementById('clip-creation-indicator')) {
          removeSelectionIndicator();
        }
      }, 5000);
    }
  };

  // Remove selection indicator
  const removeSelectionIndicator = () => {
    const indicator = document.getElementById('clip-creation-indicator');
    if (indicator) {
      document.body.removeChild(indicator);
    }
  };

  // Create clip from current selection
  const createClipFromSelection = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        const nodes = selection.getNodes();
        const wordNodes = nodes.filter($isWordNode);
        
        if (wordNodes.length > 0) {
          const firstWord = wordNodes[0] as WordNode;
          const lastWord = wordNodes[wordNodes.length - 1] as WordNode;
          const selectedText = selection.getTextContent();
          
          setCreationState({
            isDialogOpen: true,
            selectedText,
            startTime: firstWord.getStart(),
            endTime: lastWord.getEnd(),
            speakerId: firstWord.getSpeakerId(),
            title: generateClipTitle(selectedText),
            clipType: 'user-created'
          });
        }
      }
    });
    
    removeSelectionIndicator();
  };

  // Generate automatic clip title
  const generateClipTitle = (text: string): string => {
    const words = text.trim().split(/\s+/);
    if (words.length <= 6) {
      return text.trim();
    } else {
      return words.slice(0, 6).join(' ') + '...';
    }
  };

  // Handle clip creation confirmation
  const handleClipCreate = () => {
    const clipId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newClip = {
      id: clipId,
      title: creationState.title,
      text: creationState.selectedText,
      startTime: creationState.startTime,
      endTime: creationState.endTime,
      speakerId: creationState.speakerId,
      type: creationState.clipType
    };

    // Insert clip node into the editor
    editor.update(() => {
      const clipNode = $createClipNode(
        clipId,
        newClip.title,
        newClip.text,
        newClip.startTime,
        newClip.endTime,
        newClip.speakerId,
        newClip.type
      );

      // Find insertion point (after the last selected word)
      const root = $getRoot();
      const lastChild = root.getLastChild();
      if (lastChild) {
        lastChild.insertAfter(clipNode);
      } else {
        root.append(clipNode);
      }
    });

    // Call the callback
    onClipCreate?.(newClip);

    // Close dialog
    setCreationState(prev => ({ ...prev, isDialogOpen: false }));
  };

  // Handle keyboard shortcut for clip creation
  const handleKeyboardShortcut = useCallback((event: KeyboardEvent) => {
    // Ctrl+Shift+C to create clip from selection
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyC') {
      event.preventDefault();
      createClipFromSelection();
    }
    
    // Escape to remove selection indicator
    if (event.code === 'Escape') {
      removeSelectionIndicator();
    }
  }, []);

  // Handle clip operations from ClipNode components
  useEffect(() => {
    const handleClipPlay = (event: CustomEvent) => {
      const { startTime } = event.detail;
      onClipPlay?.(startTime);
    };

    const handleClipEdit = (event: CustomEvent) => {
      const { clipId } = event.detail;
      // Open edit dialog for clip
      openClipEditDialog(clipId);
    };

    const handleClipDelete = (event: CustomEvent) => {
      const { clipId } = event.detail;
      
      // Remove clip node from editor
      editor.update(() => {
        const root = $getRoot();
        
        const findAndRemoveClip = (node: any): boolean => {
          if (node instanceof ClipNode && node.getClipId() === clipId) {
            node.remove();
            return true;
          }

          const children = node.getChildren();
          for (const child of children) {
            if (findAndRemoveClip(child)) {
              return true;
            }
          }
          return false;
        };

        findAndRemoveClip(root);
      });

      onClipDelete?.(clipId);
    };

    window.addEventListener('clip-play', handleClipPlay as EventListener);
    window.addEventListener('clip-edit', handleClipEdit as EventListener);
    window.addEventListener('clip-delete', handleClipDelete as EventListener);

    return () => {
      window.removeEventListener('clip-play', handleClipPlay as EventListener);
      window.removeEventListener('clip-edit', handleClipEdit as EventListener);
      window.removeEventListener('clip-delete', handleClipDelete as EventListener);
    };
  }, [editor, onClipPlay, onClipEdit, onClipDelete]);

  // Open edit dialog for existing clip
  const openClipEditDialog = (clipId: string) => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      
      const findClip = (node: any): ClipNode | null => {
        if (node instanceof ClipNode && node.getClipId() === clipId) {
          return node;
        }

        const children = node.getChildren();
        for (const child of children) {
          const found = findClip(child);
          if (found) return found;
        }
        return null;
      };

      const clipNode = findClip(root);
      if (clipNode) {
        setCreationState({
          isDialogOpen: true,
          selectedText: clipNode.getText(),
          startTime: clipNode.getStartTime(),
          endTime: clipNode.getEndTime(),
          speakerId: clipNode.getSpeakerId(),
          title: clipNode.getTitle(),
          clipType: clipNode.getClipType()
        });
      }
    });
  };

  // Set up event listeners
  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (editorElement) {
      // Listen for selection changes
      const handleSelectionChangeEvent = () => {
        setTimeout(handleSelectionChange, 0);
      };

      editorElement.addEventListener('selectionchange', handleSelectionChangeEvent);
      editorElement.addEventListener('mouseup', handleSelectionChangeEvent);
      editorElement.addEventListener('keyup', handleSelectionChangeEvent);
      editorElement.addEventListener('keydown', handleKeyboardShortcut);
      
      return () => {
        editorElement.removeEventListener('selectionchange', handleSelectionChangeEvent);
        editorElement.removeEventListener('mouseup', handleSelectionChangeEvent);
        editorElement.removeEventListener('keyup', handleSelectionChangeEvent);
        editorElement.removeEventListener('keydown', handleKeyboardShortcut);
      };
    }
  }, [editor, handleSelectionChange, handleKeyboardShortcut]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      removeSelectionIndicator();
    };
  }, []);

  // Render clip creation dialog
  return (
    <Dialog
      open={creationState.isDialogOpen}
      handler={() => setCreationState(prev => ({ ...prev, isDialogOpen: false }))}
      size="md"
    >
      <DialogHeader className="flex items-center justify-between">
        <Typography variant="h5" color="blue-gray">
          Create New Clip
        </Typography>
      </DialogHeader>
      
      <DialogBody className="space-y-4">
        <div>
          <Typography variant="h6" color="blue-gray" className="mb-2">
            Clip Title
          </Typography>
          <Input
            value={creationState.title}
            onChange={(e) => setCreationState(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter clip title..."
            crossOrigin={undefined}
          />
        </div>

        <div>
          <Typography variant="h6" color="blue-gray" className="mb-2">
            Selected Text
          </Typography>
          <Textarea
            value={creationState.selectedText}
            onChange={(e) => setCreationState(prev => ({ ...prev, selectedText: e.target.value }))}
            placeholder="Selected transcript text..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Typography variant="h6" color="blue-gray" className="mb-2">
              Start Time
            </Typography>
            <Input
              type="number"
              step="0.1"
              value={creationState.startTime}
              onChange={(e) => setCreationState(prev => ({ 
                ...prev, 
                startTime: parseFloat(e.target.value) || 0 
              }))}
              crossOrigin={undefined}
            />
          </div>
          <div>
            <Typography variant="h6" color="blue-gray" className="mb-2">
              End Time
            </Typography>
            <Input
              type="number"
              step="0.1"
              value={creationState.endTime}
              onChange={(e) => setCreationState(prev => ({ 
                ...prev, 
                endTime: parseFloat(e.target.value) || 0 
              }))}
              crossOrigin={undefined}
            />
          </div>
        </div>

        <div>
          <Typography variant="h6" color="blue-gray" className="mb-2">
            Speaker
          </Typography>
          <Input
            value={creationState.speakerId}
            onChange={(e) => setCreationState(prev => ({ ...prev, speakerId: e.target.value }))}
            placeholder="Speaker ID"
            crossOrigin={undefined}
          />
        </div>
      </DialogBody>

      <DialogFooter className="space-x-2">
        <Button
          variant="text"
          color="red"
          onClick={() => setCreationState(prev => ({ ...prev, isDialogOpen: false }))}
        >
          Cancel
        </Button>
        <Button
          variant="gradient"
          color="blue"
          onClick={handleClipCreate}
          disabled={!creationState.title.trim() || !creationState.selectedText.trim()}
        >
          Create Clip
        </Button>
      </DialogFooter>
    </Dialog>
  );
}