/**
 * ClipSettingsPlugin - Manages clip settings dropdowns
 * Injects dropdown components into clip containers and handles operations
 */

import React, { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getNodeByKey } from 'lexical';
import ClipSettingsDropdown from '../components/ClipSettingsDropdown';
import { ClipContainerNode, $isClipContainerNode } from '../nodes/ClipContainerNode';
import { useClipEditor } from '../../hooks/useClipEditor';
import type { AudioEditorState, AudioEditorActions } from '../../hooks/useAudioEditor';

interface Speaker {
  id: string;
  name: string;
}

interface ClipSettingsPluginProps {
  availableSpeakers: Speaker[];
  audioState: AudioEditorState;
  audioActions: AudioEditorActions;
  onSpeakerChange?: (clipId: string, speakerId: string) => void;
}

export default function ClipSettingsPlugin({
  availableSpeakers,
  audioState,
  audioActions,
  onSpeakerChange,
}: ClipSettingsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const clipEditor = useClipEditor(audioState, audioActions);
  const rootsRef = useRef<Map<string, Root>>(new Map());

  // Get clips from audioState for indexing
  const clips = audioState.clips || [];
  
  console.log('[ClipSettingsPlugin] Plugin created with:', {
    availableSpeakers: availableSpeakers.length,
    clips: clips.length,
    audioStateError: audioState.error,
    audioStateInitialized: audioState.isInitialized
  });
  

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    let isUnmounted = false;
    let pendingCleanup: Set<string> = new Set();

    const updateDropdowns = () => {
      if (isUnmounted) return;
      
      const containers = rootElement.querySelectorAll('.lexical-clip-container');
      const currentClipIds = new Set<string>();
      
      if (containers.length === 0) {
        console.warn('[ClipSettingsPlugin] No clip containers found in DOM');
        return;
      }
      
      console.log(`[ClipSettingsPlugin] Found ${containers.length} clip containers`);
      

      containers.forEach((container, index) => {
        if (isUnmounted) return;
        
        const clipId = container.getAttribute('data-clip-id');
        const speakerId = container.getAttribute('data-speaker-id');
        
        if (!clipId || !speakerId) {
          console.warn('Missing clipId or speakerId:', { clipId, speakerId, container });
          return;
        }
        
        currentClipIds.add(clipId);

        // Check if we already have a container and root for this clip
        let dropdownContainer = container.querySelector('.clip-settings-dropdown-container') as HTMLElement;
        let root = rootsRef.current.get(clipId);
        
        // Only create new container and root if they don't exist
        if (!dropdownContainer && !isUnmounted) {
          // Create dropdown container
          dropdownContainer = document.createElement('div');
          dropdownContainer.classList.add('clip-settings-dropdown-container');
          dropdownContainer.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            z-index: 10;
            pointer-events: auto;
          `;
          
          // Make the dropdown container non-editable
          dropdownContainer.contentEditable = 'false';
          dropdownContainer.setAttribute('data-lexical-editor-ignore', 'true');
          dropdownContainer.setAttribute('data-clip-id', clipId);
          
          // Insert at the beginning of the container
          container.insertBefore(dropdownContainer, container.firstChild);
        }

        // Create root only if it doesn't exist and we have a container
        if (!root && dropdownContainer && !isUnmounted) {
          try {
            root = createRoot(dropdownContainer);
            rootsRef.current.set(clipId, root);
          } catch (error) {
            console.warn('Failed to create root for clip:', clipId, error);
            return;
          }
        }

        // Only render if we have a valid root and aren't unmounted
        if (root && dropdownContainer && !isUnmounted) {
          // Calculate clip index
          const clipIndex = clips.findIndex(c => c.id === clipId);
          const totalClips = clips.length;

          try {
            root.render(
              <ClipSettingsDropdown
                clipId={clipId}
                speakerId={speakerId}
                availableSpeakers={availableSpeakers}
                clipIndex={clipIndex}
                totalClips={totalClips}
                onSpeakerChange={handleSpeakerChange}
                onMergeAbove={handleMergeAbove}
                onMergeBelow={handleMergeBelow}
                onDeleteClip={handleDeleteClip}
              />
            );
          } catch (error) {
            console.warn('Failed to render dropdown for clip:', clipId, error);
          }
        }
      });

      // Schedule cleanup of roots that are no longer needed
      rootsRef.current.forEach((root, clipId) => {
        if (!currentClipIds.has(clipId)) {
          pendingCleanup.add(clipId);
        }
      });

      // Cleanup stale roots after a delay to avoid race conditions
      if (pendingCleanup.size > 0 && !isUnmounted) {
        setTimeout(() => {
          if (isUnmounted) return;
          
          pendingCleanup.forEach(clipId => {
            const root = rootsRef.current.get(clipId);
            if (root) {
              try {
                root.unmount();
                rootsRef.current.delete(clipId);
                
                // Also remove the DOM container if it exists
                const containers = rootElement.querySelectorAll(`[data-clip-id="${clipId}"] .clip-settings-dropdown-container`);
                containers.forEach(container => {
                  try {
                    container.remove();
                  } catch (error) {
                    console.warn('Failed to remove container for clip:', clipId, error);
                  }
                });
              } catch (error) {
                console.warn('Failed to unmount root for clip:', clipId, error);
              }
            }
          });
          pendingCleanup.clear();
        }, 100);
      }
    };

    // Handle speaker change
    const handleSpeakerChange = (clipId: string, newSpeakerId: string) => {
      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        
        for (const child of children) {
          if ($isClipContainerNode(child) && child.getClipId() === clipId) {
            child.setSpeaker(newSpeakerId);
            break;
          }
        }
      }, { tag: 'history-merge' });

      // Also call external handler if provided
      onSpeakerChange?.(clipId, newSpeakerId);
    };

    // Handle merge above
    const handleMergeAbove = (clipId: string) => {
      const clipIndex = clips.findIndex(c => c.id === clipId);
      if (clipIndex > 0) {
        const prevClip = clips[clipIndex - 1];
        clipEditor.mergeClips(prevClip.id, clipId);
      }
    };

    // Handle merge below
    const handleMergeBelow = (clipId: string) => {
      const clipIndex = clips.findIndex(c => c.id === clipId);
      if (clipIndex < clips.length - 1) {
        const nextClip = clips[clipIndex + 1];
        clipEditor.mergeClips(clipId, nextClip.id);
      }
    };

    // Handle delete clip
    const handleDeleteClip = (clipId: string) => {
      clipEditor.deleteClip(clipId);
    };

    // Initial update
    updateDropdowns();

    // Listen for editor updates
    const unregisterListener = editor.registerUpdateListener(() => {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(updateDropdowns);
    });

    // Cleanup
    return () => {
      isUnmounted = true;
      unregisterListener();
      
      // Cleanup all roots with error handling
      rootsRef.current.forEach((root) => {
        try {
          root.unmount();
        } catch (error) {
          console.warn('Failed to unmount root during cleanup:', error);
        }
      });
      rootsRef.current.clear();
    };
  }, [editor, clips, availableSpeakers, clipEditor, onSpeakerChange]);

  return null;
}