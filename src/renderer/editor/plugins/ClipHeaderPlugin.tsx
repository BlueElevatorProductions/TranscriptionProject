/**
 * ClipHeaderPlugin - Adds dropdown controls to the top of clip containers
 * Renders dropdown outside editable content at the container level
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChevronDownIcon, UserIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon } from 'lucide-react';
import { useClipEditor } from '../../hooks/useClipEditor';
import type { AudioEditorState, AudioEditorActions } from '../../hooks/useAudioEditor';

interface Speaker {
  id: string;
  name: string;
}

interface ClipHeaderPluginProps {
  availableSpeakers: Speaker[];
  audioState: AudioEditorState;
  audioActions: AudioEditorActions;
  readOnly?: boolean;
  getSpeakerDisplayName: (speakerId: string) => string;
  onSpeakerChange?: (clipId: string, speakerId: string) => void;
}

interface ClipDropdownProps {
  clipId: string;
  speakerId: string;
  displayName: string;
  availableSpeakers: Speaker[];
  clipIndex: number;
  totalClips: number;
  onSpeakerChange: (speakerId: string) => void;
  onMergeAbove: () => void;
  onMergeBelow: () => void;
  onDeleteClip: () => void;
}

function ClipDropdown({
  speakerId,
  displayName,
  availableSpeakers,
  clipIndex,
  totalClips,
  onSpeakerChange,
  onMergeAbove,
  onMergeBelow,
  onDeleteClip,
}: ClipDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSpeakerSelect = useCallback((selectedSpeakerId: string) => {
    onSpeakerChange(selectedSpeakerId);
    setIsOpen(false);
  }, [onSpeakerChange]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        className="inline-flex w-full justify-between items-center gap-x-1.5 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-gray-700 inset-ring-1 inset-ring-white/5 hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <span>{displayName}</span>
        <ChevronDownIcon 
          className={`-mr-1 size-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`} 
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-10 mt-2 w-56 origin-top-left divide-y divide-white/10 rounded-md bg-gray-800 outline-1 -outline-offset-1 outline-white/10 transition">
          {/* Speaker Selection */}
          <div className="py-1">
            {availableSpeakers.map((speaker) => (
              <button
                key={speaker.id}
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white focus:outline-none flex items-center"
                onClick={() => handleSpeakerSelect(speaker.id)}
              >
                <UserIcon className="h-4 w-4 mr-2" />
                {speaker.name}
                {speaker.id === speakerId && <span className="ml-auto text-blue-400">✓</span>}
              </button>
            ))}
          </div>
          
          {/* Merge Operations */}
          <div className="py-1">
            <button
              className={`block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white focus:outline-none flex items-center ${
                clipIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={clipIndex > 0 ? onMergeAbove : undefined}
              disabled={clipIndex === 0}
            >
              <ArrowUpIcon className="h-4 w-4 mr-2" />
              Merge with Above
            </button>
            <button
              className={`block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white focus:outline-none flex items-center ${
                clipIndex >= totalClips - 1 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={clipIndex < totalClips - 1 ? onMergeBelow : undefined}
              disabled={clipIndex >= totalClips - 1}
            >
              <ArrowDownIcon className="h-4 w-4 mr-2" />
              Merge with Below
            </button>
          </div>
          
          {/* Delete */}
          <div className="py-1">
            <button
              className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 focus:outline-none flex items-center"
              onClick={onDeleteClip}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Clip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClipHeaderPlugin({
  availableSpeakers,
  audioState,
  audioActions,
  readOnly = false,
  getSpeakerDisplayName,
  onSpeakerChange,
}: ClipHeaderPluginProps) {
  const [editor] = useLexicalComposerContext();
  const clipEditor = useClipEditor(audioState, audioActions);
  const rootsRef = useRef<Map<string, Root>>(new Map());

  const clips = audioState.clips || [];

  console.log(`[ClipHeaderPlugin] Plugin initialized with ${clips.length} clips, readOnly=${readOnly}, availableSpeakers=${availableSpeakers.length}`);

  useEffect(() => {
    if (readOnly) return;

    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    let isUnmounted = false;

    const updateHeaders = () => {
      if (isUnmounted) return;
      
      const containers = rootElement.querySelectorAll('.lexical-clip-container');
      const currentClipIds = new Set<string>();
      
      console.log(`[ClipHeaderPlugin] Found ${containers.length} clip containers`);
      
      containers.forEach((container, index) => {
        if (isUnmounted) return;
        
        const clipId = container.getAttribute('data-clip-id');
        const speakerId = container.getAttribute('data-speaker-id');
        
        console.log(`[ClipHeaderPlugin] Container ${index}: clipId=${clipId}, speakerId=${speakerId}`);
        
        if (!clipId || !speakerId) {
          console.log(`[ClipHeaderPlugin] Skipping container ${index} - missing clipId or speakerId`);
          return;
        }
        
        currentClipIds.add(clipId);

        // Find existing header or create new one
        let headerContainer = container.querySelector('.clip-header-container') as HTMLElement;
        let root = rootsRef.current.get(clipId);
        
        if (!headerContainer) {
          console.log(`[ClipHeaderPlugin] Creating header container for clip ${clipId}`);
          headerContainer = document.createElement('div');
          headerContainer.classList.add('clip-header-container');
          headerContainer.style.cssText = `
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 10;
            pointer-events: auto;
          `;
          
          headerContainer.contentEditable = 'false';
          headerContainer.setAttribute('data-lexical-editor-ignore', 'true');
          
          container.insertBefore(headerContainer, container.firstChild);
        } else {
          console.log(`[ClipHeaderPlugin] Header container already exists for clip ${clipId}`);
        }

        if (!root) {
          try {
            root = createRoot(headerContainer);
            rootsRef.current.set(clipId, root);
          } catch (error) {
            console.warn('Failed to create root for clip header:', clipId, error);
            return;
          }
        }

        if (root && headerContainer) {
          const clipIndex = clips.findIndex(c => c.id === clipId);
          const displayName = getSpeakerDisplayName(speakerId);

          try {
            console.log(`[ClipHeaderPlugin] Rendering dropdown for clip ${clipId}, speaker ${speakerId}, display ${displayName}`);
            root.render(
              <ClipDropdown
                clipId={clipId}
                speakerId={speakerId}
                displayName={displayName}
                availableSpeakers={availableSpeakers}
                clipIndex={clipIndex}
                totalClips={clips.length}
                onSpeakerChange={(newSpeakerId) => {
                  clipEditor.changeSpeaker(clipId, newSpeakerId);
                }}
                onMergeAbove={() => {
                  const prevClip = clips[clipIndex - 1];
                  if (prevClip) {
                    clipEditor.mergeClips(prevClip.id, clipId);
                  }
                }}
                onMergeBelow={() => {
                  const nextClip = clips[clipIndex + 1];
                  if (nextClip) {
                    clipEditor.mergeClips(clipId, nextClip.id);
                  }
                }}
                onDeleteClip={() => {
                  clipEditor.deleteClip(clipId);
                }}
              />
            );
            console.log(`[ClipHeaderPlugin] Successfully rendered dropdown for clip ${clipId}`);
          } catch (error) {
            console.warn('Failed to render clip header:', clipId, error);
          }
        }
      });

      // Cleanup old roots
      rootsRef.current.forEach((root, clipId) => {
        if (!currentClipIds.has(clipId)) {
          try {
            root.unmount();
            rootsRef.current.delete(clipId);
          } catch (error) {
            console.warn('Failed to unmount root:', clipId, error);
          }
        }
      });
    };

    // Initial update
    updateHeaders();

    // Listen for editor updates
    const unregisterListener = editor.registerUpdateListener(() => {
      requestAnimationFrame(updateHeaders);
    });

    return () => {
      isUnmounted = true;
      unregisterListener();
      
      rootsRef.current.forEach((root) => {
        try {
          root.unmount();
        } catch (error) {
          console.warn('Failed to unmount root during cleanup:', error);
        }
      });
      rootsRef.current.clear();
    };
  }, [editor, clips, availableSpeakers, readOnly, getSpeakerDisplayName, onSpeakerChange, clipEditor]);

  return null;
}