/**
 * SpeakerPlugin - Manages speaker operations and context menus
 * Handles speaker color coding, name editing, and speaker changes
 */

import React, { useEffect, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, $isElementNode, LexicalNode, ElementNode } from 'lexical';
import { SpeakerNode, $isSpeakerNode, $createSpeakerNode } from '../nodes/SpeakerNode';
import { WordNode, $isWordNode } from '../nodes/WordNode';
import { SegmentNode, $isSegmentNode } from '../nodes/SegmentNode';

interface SpeakerPluginProps {
  speakers?: { [key: string]: string };
  onSpeakerChange?: (speakerId: string, newName: string) => void;
  onSpeakerAdd?: (speakerId: string, displayName: string) => void;
  getSpeakerDisplayName: (speakerId: string) => string;
  getSpeakerColor?: (speakerId: string) => string | undefined;
}

export default function SpeakerPlugin({
  speakers = {},
  onSpeakerChange,
  onSpeakerAdd,
  getSpeakerDisplayName,
  getSpeakerColor,
}: SpeakerPluginProps) {
  const [editor] = useLexicalComposerContext();

  // Handle speaker name changes from SpeakerNode components
  useEffect(() => {
    const handleSpeakerChange = (event: CustomEvent) => {
      const { speakerId, newName } = event.detail;
      
      if (onSpeakerChange) {
        onSpeakerChange(speakerId, newName);
      }

      // Update all speaker nodes and word nodes with this speaker ID
      editor.update(() => {
        const root = $getRoot();
        
        const updateNodes = (node: LexicalNode) => {
          if ($isSpeakerNode(node) && node.getSpeakerId() === speakerId) {
            node.setDisplayName(newName);
          } else if ($isWordNode(node) && node.getSpeakerId() === speakerId) {
            // Word nodes might need to be updated if they reference speaker names
            // This depends on your specific implementation needs
          } else if ($isSegmentNode(node) && node.getSpeakerId() === speakerId) {
            // Update segment speaker reference if needed
          }

          if ($isElementNode(node)) {
            const children = (node as ElementNode).getChildren();
            for (const child of children) {
              updateNodes(child);
            }
          }
        };

        updateNodes(root);
      });
    };

    window.addEventListener('speaker-name-change', handleSpeakerChange as EventListener);
    
    return () => {
      window.removeEventListener('speaker-name-change', handleSpeakerChange as EventListener);
    };
  }, [editor, onSpeakerChange]);

  // Update speaker display names when speakers prop changes
  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      let hasUpdates = false;

      const updateSpeakerNodes = (node: LexicalNode) => {
        if ($isSpeakerNode(node)) {
          const speakerId = node.getSpeakerId();
          const currentDisplayName = node.getDisplayName();
          const newDisplayName = getSpeakerDisplayName(speakerId);
          const speakerColor = getSpeakerColor?.(speakerId);

          if (currentDisplayName !== newDisplayName) {
            node.setDisplayName(newDisplayName);
            hasUpdates = true;
          }

          if (speakerColor && node.getColor() !== speakerColor) {
            node.setColor(speakerColor);
            hasUpdates = true;
          }
        }

        if ($isElementNode(node)) {
          const children = (node as ElementNode).getChildren();
          for (const child of children) {
            updateSpeakerNodes(child);
          }
        }
      };

      updateSpeakerNodes(root);
    });
  }, [editor, speakers, getSpeakerDisplayName, getSpeakerColor]);

  // Handle speaker context menu operations
  const handleSpeakerContextMenu = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Check if right-clicking on a speaker node
    if (target.closest('.lexical-speaker-node')) {
      event.preventDefault();
      event.stopPropagation();

      const speakerElement = target.closest('.lexical-speaker-node-container');
      const speakerId = speakerElement?.getAttribute('data-speaker-id');
      
      if (speakerId) {
        // Show speaker context menu
        showSpeakerContextMenu(event.clientX, event.clientY, speakerId);
      }
    }
  }, []);

  // Handle speaker operations from context menu
  const showSpeakerContextMenu = (x: number, y: number, speakerId: string) => {
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'speaker-context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.minWidth = '180px';

    const displayName = getSpeakerDisplayName(speakerId);
    
    // Menu items
    const menuItems = [
      {
        label: 'Edit Speaker Name',
        action: () => editSpeakerName(speakerId),
        icon: '✏️'
      },
      {
        label: 'Change Speaker Color',
        action: () => changeSpeakerColor(speakerId),
        icon: '🎨'
      },
      {
        label: 'Split at This Point',
        action: () => splitSpeakerSegment(speakerId),
        icon: '✂️'
      },
      {
        type: 'separator'
      },
      {
        label: 'Merge with Previous',
        action: () => mergeSpeakerSegments(speakerId, 'previous'),
        icon: '⬆️'
      },
      {
        label: 'Merge with Next',
        action: () => mergeSpeakerSegments(speakerId, 'next'),
        icon: '⬇️'
      }
    ];

    menuItems.forEach(item => {
      if (item.type === 'separator') {
        const separator = document.createElement('hr');
        separator.className = 'border-gray-200 my-1';
        menu.appendChild(separator);
      } else if (item.label && item.action) {
        const menuItem = document.createElement('button');
        menuItem.className = 'w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2';
        menuItem.innerHTML = `<span>${item.icon}</span> ${item.label}`;
        
        menuItem.addEventListener('click', () => {
          item.action();
          document.body.removeChild(menu);
        });
        
        menu.appendChild(menuItem);
      }
    });

    // Add to document and handle clicks outside
    document.body.appendChild(menu);

    const handleClickOutside = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        document.body.removeChild(menu);
        document.removeEventListener('click', handleClickOutside);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  };

  // Speaker operation functions
  const editSpeakerName = (speakerId: string) => {
    const currentName = getSpeakerDisplayName(speakerId);
    const newName = window.prompt('Enter new speaker name:', currentName);
    
    if (newName && newName.trim() && newName.trim() !== currentName) {
      onSpeakerChange?.(speakerId, newName.trim());
    }
  };

  const changeSpeakerColor = (speakerId: string) => {
    // Create a simple color picker dialog
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308',
      '#84cc16', '#22c55e', '#10b981', '#14b8a6',
      '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
      '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
    ];

    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    const content = document.createElement('div');
    content.className = 'bg-white rounded-lg p-4 max-w-sm';
    content.innerHTML = `
      <h3 class="text-lg font-medium mb-3">Choose Speaker Color</h3>
      <div class="grid grid-cols-4 gap-2 mb-4">
        ${colors.map(color => `
          <button 
            class="w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform"
            style="background-color: ${color}"
            data-color="${color}"
          ></button>
        `).join('')}
      </div>
      <div class="flex gap-2 justify-end">
        <button class="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300" data-action="cancel">Cancel</button>
        <button class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600" data-action="remove">Remove Color</button>
      </div>
    `;

    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // Handle color selection
    content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const color = target.getAttribute('data-color');
      const action = target.getAttribute('data-action');

      if (color) {
        // Update speaker color
        editor.update(() => {
          const root = $getRoot();
          const updateSpeakerColor = (node: LexicalNode) => {
            if ($isSpeakerNode(node) && node.getSpeakerId() === speakerId) {
              node.setColor(color);
            }
            if ($isElementNode(node)) {
              const children = (node as ElementNode).getChildren();
              for (const child of children) {
                updateSpeakerColor(child);
              }
            }
          };
          updateSpeakerColor(root);
        });
        document.body.removeChild(dialog);
      } else if (action === 'remove') {
        // Remove speaker color
        editor.update(() => {
          const root = $getRoot();
          const removeSpeakerColor = (node: LexicalNode) => {
            if ($isSpeakerNode(node) && node.getSpeakerId() === speakerId) {
              node.setColor(undefined);
            }
            if ($isElementNode(node)) {
              const children = (node as ElementNode).getChildren();
              for (const child of children) {
                removeSpeakerColor(child);
              }
            }
          };
          removeSpeakerColor(root);
        });
        document.body.removeChild(dialog);
      } else if (action === 'cancel') {
        document.body.removeChild(dialog);
      }
    });
  };

  const splitSpeakerSegment = (speakerId: string) => {
    // Implementation for splitting segments would go here
    console.log('Split speaker segment:', speakerId);
  };

  const mergeSpeakerSegments = (speakerId: string, direction: 'previous' | 'next') => {
    // Implementation for merging segments would go here
    console.log('Merge speaker segments:', speakerId, direction);
  };

  // Set up event listeners
  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('contextmenu', handleSpeakerContextMenu);
      
      return () => {
        editorElement.removeEventListener('contextmenu', handleSpeakerContextMenu);
      };
    }
  }, [editor, handleSpeakerContextMenu]);

  // The SpeakerNode component already handles inline editing via its own UI.
  // We avoid mutating node methods at runtime to keep Lexical stable.

  // This plugin doesn't render anything
  return null;
}
