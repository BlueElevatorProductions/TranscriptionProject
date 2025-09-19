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
  ParagraphNode,
} from 'lexical';
import { WordNode, $isWordNode, $createWordNode } from '../nodes/WordNode';
import { SegmentNode, $isSegmentNode } from '../nodes/SegmentNode';
import { $isSpeakerNode } from '../nodes/SpeakerNode';
import { ClipContainerNode } from '../nodes/ClipContainerNode';

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

  // Space-to-advance editing: when editor is editable and the user presses Space,
  // move selection to the next WordNode and select it fully so typing replaces it.
  useEffect(() => {
    if (readOnly) return;
    const root = editor.getRootElement();
    if (!root) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      // Only intercept when editor is editable (i.e., after double-click guard enabled it)
      if (!editor.isEditable()) return;
      e.preventDefault();
      e.stopPropagation();

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        // Ascend to WordNode from anchor
        let node: any = selection.anchor.getNode();
        const getType = (n: any) => (n && n.getType ? n.getType() : undefined);
        while (node && getType(node) !== 'word') {
          const p = node.getParent && node.getParent();
          if (!p) break;
          node = p;
        }
        if (!node || getType(node) !== 'word') return;

        // Find next WordNode in document order
        const nextWord = (() => {
          const isWord = (n: any) => n && getType(n) === 'word';
          // Depth-first forward traversal starting from node's nextSibling chain
          const forward = (start: any): any | null => {
            let cur: any = start;
            while (cur) {
              if (isWord(cur)) return cur;
              const children = cur.getChildren ? cur.getChildren() : null;
              if (children && children.length) {
                // descend to first child
                const found = forward(children[0]);
                if (found) return found;
              }
              const sib = cur.getNextSibling ? cur.getNextSibling() : null;
              if (sib) { cur = sib; continue; }
              // climb up until a next sibling is found
              let parent = cur.getParent && cur.getParent();
              while (parent && !(parent.getNextSibling && parent.getNextSibling())) {
                cur = parent;
                parent = parent.getParent && parent.getParent();
              }
              cur = parent ? parent.getNextSibling() : null;
            }
            return null;
          };
          const start = node.getNextSibling ? node.getNextSibling() : null;
          return forward(start);
        })();

        if (nextWord) {
          const size = nextWord.getTextContent ? nextWord.getTextContent().length : 0;
          if (typeof nextWord.select === 'function') {
            nextWord.select(0, size);
          } else {
            // Fallback: create a new range selection
            const range = $createRangeSelection();
            // @ts-ignore anchor/focus helpers exist in this version
            range.anchor.set(nextWord.getKey(), 0, 'text');
            // @ts-ignore
            range.focus.set(nextWord.getKey(), size, 'text');
            $setSelection(range);
          }
        }
      });
    };

    root.addEventListener('keydown', onKeyDown, true);
    return () => root.removeEventListener('keydown', onKeyDown, true);
  }, [editor, readOnly]);

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
          let handled = false;
          editor.update(() => {
            const target = event.target as HTMLElement;
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

            // Try to resolve ClipContainerNode via Lexical parent chain
            let node: LexicalNode | null = selection.anchor.getNode();
            let container: any = node;
            const chain: string[] = [];
            while (container && !(container instanceof ClipContainerNode)) {
              chain.push((container as any)?.getType?.() || (container as any)?.constructor?.name || 'unknown');
              container = container.getParent && container.getParent();
            }

            // Fallback: resolve via DOM selection
            if (!(container instanceof ClipContainerNode)) {
              const domSel = window.getSelection();
              const anchorNode = domSel?.anchorNode as Node | null;
              const anchorEl = (anchorNode as any)?.nodeType === 1
                ? (anchorNode as HTMLElement)
                : (anchorNode?.parentElement as HTMLElement | null);
              const containerEl = anchorEl?.closest?.('.lexical-clip-container') as HTMLElement | null;
              if (containerEl) {
                const clipId = containerEl.getAttribute('data-clip-id');
                // Find ClipContainerNode by matching clipId
                const root = $getRoot();
                const children = root.getChildren();
                for (const child of children) {
                  if (child instanceof ClipContainerNode) {
                    if ((child as ClipContainerNode).getClipId() === clipId) {
                      container = child;
                      break;
                    }
                  }
                }
                // If still not found, last resort: try to map via DOM element of children
                if (!(container instanceof ClipContainerNode)) {
                  for (const child of children) {
                    if (child instanceof ClipContainerNode) {
                      const el = editor.getElementByKey(child.getKey());
                      if (el === containerEl) {
                        container = child;
                        break;
                      }
                    }
                  }
                }
              }
            }

            if (!(container instanceof ClipContainerNode)) {
              console.log('[EditingPlugin] Enter: no ClipContainerNode found. chain=', chain);
              // Fallback: create a new clip after the nearest/last clip container
              const root = $getRoot();
              const topChildren = root.getChildren();
              const clipNodes = topChildren.filter((c) => c instanceof ClipContainerNode) as ClipContainerNode[];
              if (clipNodes.length === 0) {
                // Nothing to do; let default behavior run
                return;
              }
              // Choose nearest by DOM vertical distance if possible
              let chosen: ClipContainerNode | null = null;
              try {
                const domSel = window.getSelection();
                const anchorDomNode = domSel?.anchorNode as Node | null;
                const anchorElement = (anchorDomNode as any)?.nodeType === 1
                  ? (anchorDomNode as HTMLElement)
                  : (anchorDomNode?.parentElement as HTMLElement | null);
                const anchorTop = anchorElement?.getBoundingClientRect?.().top ?? Number.POSITIVE_INFINITY;
                let bestDist = Number.POSITIVE_INFINITY;
                clipNodes.forEach((n) => {
                  const el = editor.getElementByKey(n.getKey());
                  const top = el?.getBoundingClientRect?.().top ?? Number.NEGATIVE_INFINITY;
                  const dist = Math.abs((anchorTop as number) - (top as number));
                  if (dist < bestDist) {
                    bestDist = dist;
                    chosen = n;
                  }
                });
              } catch {
                // ignore and fallback to last clip
              }
              if (!chosen) chosen = clipNodes[clipNodes.length - 1];

              const newClipId = `clip_${Date.now()}`;
              const newContainer = new ClipContainerNode(
                newClipId,
                chosen.getSpeakerId(),
                chosen.getStatus?.() ?? 'active'
              );
              chosen.insertAfter(newContainer);
              const firstDesc: any = (newContainer as any).getFirstDescendant && (newContainer as any).getFirstDescendant();
              if (firstDesc && typeof firstDesc.select === 'function') {
                firstDesc.select();
              }
              handled = true;
              console.log('[EditingPlugin] Enter: created new empty clip after nearest container', { newClipId });
              return;
            }
            const containerNode: ClipContainerNode = container as ClipContainerNode;

            const children = containerNode.getChildren();
            console.log('[EditingPlugin] Enter: container clipId=', containerNode.getClipId?.(), 'children count:', children.length);

            // Prefer splitting within the first paragraph inside the container
            let paragraphNode: any = children.find((c) => (c as any).getType && (c as any).getType() === 'paragraph');
            if (!paragraphNode) {
              // Create a paragraph if missing and move existing children into it
              paragraphNode = new ParagraphNode();
              children.forEach((c) => paragraphNode.append(c));
              containerNode.append(paragraphNode);
            }
            const paraChildren = paragraphNode.getChildren();
            console.log('[EditingPlugin] Enter: paragraph children types:', paraChildren.map((c: any) => c.getType?.()));

            // Compute split index relative to children[]
            const anchorNode = selection.anchor.getNode();
            let splitIndex = -1;

            // Compute split index using Lexical ancestry + anchor offset
            {
              let child: any = anchorNode;
              while (child && child.getParent && child.getParent() !== paragraphNode) {
                child = child.getParent && child.getParent();
              }
              if (child && typeof child.getKey === 'function') {
                splitIndex = paraChildren.findIndex((c: any) => c.getKey() === child.getKey());
                // If caret at end of a word/text, split after it; otherwise split before
                const isWord = $isWordNode(child as any);
                const isText = (child as any).getType && (child as any).getType() === 'text';
                const textLen = (isWord || isText) ? ((child as any).getTextContent?.() || '').length : 0;
                const anchorOffset = selection.anchor.offset;
                if (textLen > 0 && anchorOffset >= textLen) {
                  splitIndex = splitIndex + 1;
                }
                console.log('[EditingPlugin] Enter: resolved child type=', (child as any).getType?.(), 'splitIndex(pre-boundary)=', splitIndex, 'anchorOffset=', anchorOffset, 'textLen=', textLen);
              }
              if (splitIndex === -1) {
                // Fallback: find first word or end
                const firstWordIdx = paraChildren.findIndex((c: any) => ($isWordNode(c as any)));
                splitIndex = firstWordIdx !== -1 ? firstWordIdx : paraChildren.length;
              }
              console.log('[EditingPlugin] Enter: splitIndex(final before guard)=', splitIndex);
            }

            // Ensure we don't split off the speaker label (keep at least it in the first part)
            const minIndex = (paraChildren.length > 0 && $isSpeakerNode(paraChildren[0] as any)) ? 1 : 0;
            if (splitIndex < minIndex) {
              const firstWordIdx = paraChildren.findIndex((c: any) => ($isWordNode(c as any)));
              splitIndex = firstWordIdx !== -1 ? Math.max(firstWordIdx, minIndex) : minIndex;
            }
            console.log('[EditingPlugin] Enter: splitIndex(after minIndex guard)=', splitIndex);
            if (splitIndex >= paraChildren.length) {
              console.log('[EditingPlugin] Enter: splitIndex >= children.length; abort split');
              return;
            }

            // Instead of mutating Lexical tree, request a project-level clip split
            // Prefer DOM-based word index from the actual caret position
            const clipId = containerNode.getClipId?.();
            let localWordIndex = 0;
            try {
              const domSel = window.getSelection();
              const anchorDomNode = domSel?.anchorNode as Node | null;
              const anchorEl = (anchorDomNode as any)?.nodeType === 1
                ? (anchorDomNode as HTMLElement)
                : (anchorDomNode?.parentElement as HTMLElement | null);
              const containerEl = anchorEl?.closest?.('.lexical-clip-container') as HTMLElement | null;
              const wordEls = containerEl ? Array.from(containerEl.querySelectorAll('.lexical-word-node')) as HTMLElement[] : [];
              const currentWordEl = anchorEl?.closest?.('.lexical-word-node') as HTMLElement | null;
              if (currentWordEl && wordEls.length > 0) {
                const idx = wordEls.findIndex((el) => el === currentWordEl);
                if (idx >= 0) localWordIndex = idx;
                // If caret is at end of the word element's text, split after it
                const textLen = currentWordEl.textContent?.length || 0;
                const anchorOffset = domSel?.anchorOffset || 0;
                if (textLen > 0 && anchorOffset >= textLen) localWordIndex = idx + 1;
              } else {
                // Fallback: count WordNodes before splitIndex
                for (let i = 0; i < splitIndex; i++) {
                  if ($isWordNode(paraChildren[i] as any)) localWordIndex++;
                }
              }
            } catch {}
            console.log('[EditingPlugin] Enter: dispatch clip-split', { clipId, localWordIndex });
            window.dispatchEvent(new CustomEvent('clip-split', {
              detail: { clipId, wordIndex: localWordIndex }
            }));
            handled = true;
          });
          if (handled) {
            event.preventDefault();
          }
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
