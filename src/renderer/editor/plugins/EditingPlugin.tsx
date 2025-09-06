/**
 * EditingPlugin - Handles word editing operations and context menus
 * Manages word insertion, deletion, editing, and paragraph breaks
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getRoot, 
  $getSelection, 
  $isRangeSelection,
  $createTextNode,
  $setSelection,
  $createRangeSelection,
  $isElementNode,
  LexicalNode,
  ElementNode,
} from 'lexical';
import { WordNode, $isWordNode, $createWordNode } from '../nodes/WordNode';
import { SegmentNode, $isSegmentNode } from '../nodes/SegmentNode';

interface EditingPluginProps {
  onWordEdit?: (segmentIndex: number, wordIndex: number, oldWord: string, newWord: string) => void;
  onWordInsert?: (segmentIndex: number, wordIndex: number, newWord: string) => void;
  onWordDelete?: (segmentIndex: number, wordIndex: number) => void;
  onParagraphBreak?: (segmentIndex: number) => void;
  readOnly?: boolean;
}

export default function EditingPlugin({
  onWordEdit,
  onWordInsert,
  onWordDelete,
  onParagraphBreak,
  readOnly = false,
}: EditingPluginProps) {
  const [editor] = useLexicalComposerContext();
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const editingStateRef = useRef<{
    isEditing: boolean;
    editingNode: WordNode | null;
    originalText: string;
  }>({
    isEditing: false,
    editingNode: null,
    originalText: ''
  });

  // Handle double-click to edit words
  // Disable custom double-click editing to allow native Lexical editing behavior
  const handleDoubleClick = useCallback((event: MouseEvent) => {
    // no-op: let Lexical handle selection/editing
  }, [readOnly]);

  // Start editing a word
  // Remove inline replacement editor in favor of native Lexical text editing

  // Create inline input for word editing
  const createInlineEditor = (element: HTMLElement, originalText: string) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'inline-word-editor border-b-2 border-blue-500 bg-transparent focus:outline-none px-1';
    input.style.width = `${Math.max(originalText.length * 8 + 16, 60)}px`;
    input.style.fontSize = window.getComputedStyle(element).fontSize;
    input.style.fontFamily = window.getComputedStyle(element).fontFamily;

    // Handle input events
    const handleSave = () => {
      const newText = input.value.trim();
      finishWordEdit(newText);
    };

    const handleCancel = () => {
      finishWordEdit(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleSave();
        // Could implement tab to next word functionality here
      }
    };

    input.addEventListener('blur', handleSave);
    input.addEventListener('keydown', handleKeyDown);

    // Replace element content
    const parent = element.parentNode;
    if (parent) {
      parent.replaceChild(input, element);
      input.focus();
      input.select();
    }
  };

  // Finish word editing
  const finishWordEdit = (newText: string | null) => {
    const editingState = editingStateRef.current;
    
    if (!editingState.isEditing || !editingState.editingNode) {
      return;
    }

    editor.update(() => {
      const wordNode = editingState.editingNode!;
      
      if (newText && newText !== editingState.originalText) {
        // Update the word node
        wordNode.setTextContent(newText);
        
        // Call the callback with segment and word indices
        // This requires finding the position within the transcript structure
        const { segmentIndex, wordIndex } = findWordPosition(wordNode);
        onWordEdit?.(segmentIndex, wordIndex, editingState.originalText, newText);
      }
    });

    // Reset editing state
    editingStateRef.current = {
      isEditing: false,
      editingNode: null,
      originalText: ''
    };
  };

  // Find word position within transcript structure
  const findWordPosition = (targetWordNode: WordNode): { segmentIndex: number; wordIndex: number } => {
    let segmentIndex = 0;
    let wordIndex = 0;

    editor.getEditorState().read(() => {
      const root = $getRoot();
      
      const traverseForPosition = (node: any, currentSegmentIndex: number): boolean => {
        if ($isSegmentNode(node)) {
          const words = node.getWordNodes();
          const wordNodeIndex = words.findIndex(word => 
            $isWordNode(word) && word.getKey() === targetWordNode.getKey()
          );
          
          if (wordNodeIndex !== -1) {
            segmentIndex = currentSegmentIndex;
            wordIndex = wordNodeIndex;
            return true;
          }
          
          currentSegmentIndex++;
        }

        const children = node.getChildren();
        for (const child of children) {
          if (traverseForPosition(child, currentSegmentIndex)) {
            return true;
          }
        }
        return false;
      };

      traverseForPosition(root, 0);
    });

    return { segmentIndex, wordIndex };
  };

  // Handle right-click context menu for words
  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (readOnly) return;

    const target = event.target as HTMLElement;
    
    if (target.classList.contains('lexical-word-node')) {
      event.preventDefault();
      event.stopPropagation();
      
      showWordContextMenu(event.clientX, event.clientY, target);
    }
  }, [readOnly]);

  // Show word context menu
  const showWordContextMenu = (x: number, y: number, element: HTMLElement) => {
    // Remove any existing context menu
    if (contextMenuRef.current) {
      document.body.removeChild(contextMenuRef.current);
    }

    const menu = document.createElement('div');
    menu.className = 'editing-context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.minWidth = '160px';

    const menuItems = [
      {
        label: 'Edit Word',
        action: () => startWordEdit(element),
        icon: '✏️'
      },
      {
        label: 'Insert Word Before',
        action: () => insertWord(element, 'before'),
        icon: '⬅️'
      },
      {
        label: 'Insert Word After',
        action: () => insertWord(element, 'after'),
        icon: '➡️'
      },
      {
        type: 'separator'
      },
      {
        label: 'Delete Word',
        action: () => deleteWord(element),
        icon: '🗑️',
        className: 'text-red-600'
      },
      {
        type: 'separator'
      },
      {
        label: 'Split Paragraph Here',
        action: () => splitParagraph(element),
        icon: '✂️'
      }
    ];

    menuItems.forEach(item => {
      if (item.type === 'separator') {
        const separator = document.createElement('hr');
        separator.className = 'border-gray-200 my-1';
        menu.appendChild(separator);
      } else if (item.label && item.action) {
        const menuItem = document.createElement('button');
        menuItem.className = `w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${item.className || ''}`;
        menuItem.innerHTML = `<span>${item.icon}</span> ${item.label}`;
        
        menuItem.addEventListener('click', () => {
          item.action();
          document.body.removeChild(menu);
          contextMenuRef.current = null;
        });
        
        menu.appendChild(menuItem);
      }
    });

    document.body.appendChild(menu);
    contextMenuRef.current = menu;

    // Handle clicks outside menu
    const handleClickOutside = (e: MouseEvent) => {
      if (menu && !menu.contains(e.target as Node)) {
        document.body.removeChild(menu);
        contextMenuRef.current = null;
        document.removeEventListener('click', handleClickOutside);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  };

  // Insert word before or after the target element
  const insertWord = (element: HTMLElement, position: 'before' | 'after') => {
    const newWord = window.prompt(`Enter new word to insert ${position}:`);
    if (!newWord || !newWord.trim()) return;

    editor.update(() => {
      const root = $getRoot();
      let targetWordNode: WordNode | null = null;
      
      // Find the target word node
      const findWordNode = (node: LexicalNode): WordNode | null => {
        if ($isWordNode(node)) {
          const nodeElement = editor.getElementByKey(node.getKey());
          if (nodeElement === element) {
            return node;
          }
        }

        if ($isElementNode(node)) {
          const children = (node as ElementNode).getChildren();
          for (const child of children) {
            const found = findWordNode(child);
            if (found) return found;
          }
        }
        return null;
      };

      targetWordNode = findWordNode(root);

      if (targetWordNode) {
        // Create new word node with timing interpolation
        const startTime = position === 'before' ? 
          Math.max(0, targetWordNode.getStart() - 0.5) : 
          targetWordNode.getEnd();
        
        const endTime = position === 'before' ? 
          targetWordNode.getStart() : 
          targetWordNode.getEnd() + 0.5;

        const newWordNode = $createWordNode(
          newWord.trim(),
          startTime,
          endTime,
          targetWordNode.getSpeakerId(),
          1.0
        );

        // Insert the new word node
        if (position === 'before') {
          targetWordNode.insertBefore(newWordNode);
          targetWordNode.insertBefore($createTextNode(' '));
        } else {
          targetWordNode.insertAfter($createTextNode(' '));
          targetWordNode.insertAfter(newWordNode);
        }

        // Call the callback
        const { segmentIndex, wordIndex } = findWordPosition(targetWordNode);
        const insertIndex = position === 'before' ? wordIndex : wordIndex + 1;
        onWordInsert?.(segmentIndex, insertIndex, newWord.trim());
      }
    });
  };

  // Delete word
  const deleteWord = (element: HTMLElement) => {
    if (!window.confirm('Are you sure you want to delete this word?')) {
      return;
    }

    editor.update(() => {
      const root = $getRoot();
      let targetWordNode: WordNode | null = null;
      
      // Find and remove the word node
      const findAndDeleteWordNode = (node: LexicalNode): boolean => {
        if ($isWordNode(node)) {
          const nodeElement = editor.getElementByKey(node.getKey());
          if (nodeElement === element) {
            // Get position before deletion
            const { segmentIndex, wordIndex } = findWordPosition(node);
            
            // Remove the node
            node.remove();
            
            // Call the callback
            onWordDelete?.(segmentIndex, wordIndex);
            return true;
          }
        }

        if ($isElementNode(node)) {
          const children = (node as ElementNode).getChildren();
          for (const child of children) {
            if (findAndDeleteWordNode(child)) {
              return true;
            }
          }
        }
        return false;
      };

      findAndDeleteWordNode(root);
    });
  };

  // Split paragraph at word
  const splitParagraph = (element: HTMLElement) => {
    editor.update(() => {
      // Implementation for paragraph splitting
      // This would involve finding the segment and splitting it
      const { segmentIndex } = findWordPosition(editingStateRef.current.editingNode!);
      onParagraphBreak?.(segmentIndex);
    });
  };

  // Set up event listeners
  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('dblclick', handleDoubleClick);
      editorElement.addEventListener('contextmenu', handleContextMenu);
      // Enter key to split at cursor into a new segment (Edit mode only)
      const handleKeyDown = (event: KeyboardEvent) => {
        if (readOnly) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

            // Find containing SegmentNode
            let node: LexicalNode | null = selection.anchor.getNode();
            let segment: LexicalNode | null = node;
            while (segment && !$isSegmentNode(segment)) {
              segment = (segment.getParent && segment.getParent()) as LexicalNode | null;
            }
            if (!segment || !$isSegmentNode(segment)) return;
            const segmentNode = segment as SegmentNode;

            const children = segmentNode.getChildren();

            // Compute split index relative to children[]
            const anchorNode = selection.anchor.getNode();
            let splitIndex = -1;

            // If anchor is a WordNode, split before it
            if ($isWordNode(anchorNode as any)) {
              splitIndex = children.findIndex((c) => c.getKey() === (anchorNode as WordNode).getKey());
            } else {
              // If anchor is a TextNode (likely a space) or other child, split at that position
              const anchorKey = anchorNode.getKey();
              const idx = children.findIndex((c) => c.getKey() === anchorKey);
              if (idx !== -1) {
                splitIndex = idx;
              } else {
                // Fallback: find the next WordNode in order; otherwise split at end
                const firstWordIdx = children.findIndex((c) => ($isWordNode(c as any)));
                splitIndex = firstWordIdx !== -1 ? firstWordIdx : children.length;
              }
            }

            // Guard bounds
            if (splitIndex < 1) {
              // Avoid creating empty segment at the very start
              return;
            }
            if (splitIndex >= children.length) {
              return;
            }

            const newSegmentId = `segment_${Date.now()}`;
            const newSegment = new SegmentNode(
              newSegmentId,
              segmentNode.getStartTime(),
              segmentNode.getEndTime(),
              segmentNode.getSpeakerId(),
              true // show paragraph break indicator
            );

            // Move trailing nodes from splitIndex onward (use a snapshot array)
            const tail = children.slice(splitIndex);
            tail.forEach((child) => newSegment.append(child));

            // Insert new segment after current
            segmentNode.insertAfter(newSegment);

            // Recompute timings based on word nodes
            const updateTiming = (seg: SegmentNode) => {
              const words = seg.getWordNodes().filter($isWordNode) as WordNode[];
              if (words.length > 0) {
                seg.setTiming(words[0].getStart(), words[words.length - 1].getEnd());
              }
            };
            updateTiming(segmentNode);
            updateTiming(newSegment);

            onParagraphBreak?.(0);
          });
        }
      };
      editorElement.addEventListener('keydown', handleKeyDown);
      
      return () => {
        editorElement.removeEventListener('dblclick', handleDoubleClick);
        editorElement.removeEventListener('contextmenu', handleContextMenu);
        editorElement.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [editor, handleDoubleClick, handleContextMenu, readOnly, onParagraphBreak]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (contextMenuRef.current) {
        document.body.removeChild(contextMenuRef.current);
        contextMenuRef.current = null;
      }
    };
  }, []);

  // This plugin doesn't render anything
  return null;
}
