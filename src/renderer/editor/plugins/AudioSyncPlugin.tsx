/**
 * AudioSyncPlugin - Handles precise word-level audio synchronization
 * Updates word highlighting based on actual audio playback time
 */

import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, $isElementNode, LexicalNode, ElementNode } from 'lexical';
import { WordNode, $isWordNode } from '../nodes/WordNode';

interface AudioSyncPluginProps {
  // Use original audio time ONLY for highlighting to match WordNode timings
  currentOriginalTime?: number;
  isPlaying: boolean;
  onSeekAudio?: (timestamp: number) => void;
}

export default function AudioSyncPlugin({
  currentOriginalTime,
  isPlaying,
  onSeekAudio,
}: AudioSyncPluginProps) {
  const [editor] = useLexicalComposerContext();
  const animationFrameRef = useRef<number>();
  const lastUpdateTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Word highlighting synchronization - trigger on currentOriginalTime changes
  useEffect(() => {
    const updateWordHighlights = () => {
      editor.update(() => {
        const root = $getRoot();
        const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
        let hasUpdates = false;
        let currentlyPlayingWord = null;
        
        // Only process when we have valid time data
        if (typeof currentOriginalTime !== 'number' || currentOriginalTime < 0) {
          // Skip if time is invalid - this is normal during state transitions
          return;
        }
        
        if (AUDIO_DEBUG && isPlaying) {
          console.log('[AudioSyncPlugin] Processing time update:', { 
            currentOriginalTime, 
            isPlaying
          });
        }
        const t = currentOriginalTime;

        // Determine first actual word start; don't highlight before the first word
        let minStart = Number.POSITIVE_INFINITY;
        root.getChildren().forEach((node: any) => {
          const stack: any[] = [node];
          while (stack.length) {
            const n = stack.pop();
            if ((n as any).getChildren) {
              const children = (n as any).getChildren();
              for (const c of children) stack.push(c);
            }
            if ((n as any).getType && (n as any).getType() === 'word') {
              const start = (n as any).getStart?.();
              if (typeof start === 'number' && start < minStart) minStart = start;
            }
          }
        });
        if (!isFinite(minStart)) minStart = 0;
        if (t < minStart) {
          // Early stage (e.g., music intro) — avoid highlighting
          return;
        }

        // Traverse all nodes to find WordNodes
        const updateWordNode = (node: WordNode) => {
          const shouldHighlight = node.isCurrentlyPlaying(t);
          const currentlyHighlighted = node.getLatest().__isCurrentlyPlaying;

          if (shouldHighlight !== currentlyHighlighted) {
            node.setCurrentlyPlaying(shouldHighlight);
            hasUpdates = true;
            
            if (shouldHighlight) {
              currentlyPlayingWord = {
                word: node.getTextContent(),
                startTime: node.getStart(),
                endTime: node.getEnd(),
                currentTime: t
              };
            }
          }
        };

        const traverseNodes = (node: LexicalNode) => {
          if ($isWordNode(node as any)) {
            updateWordNode(node);
          }

          // Only descend into element nodes
          if ($isElementNode(node)) {
            const children = (node as ElementNode).getChildren();
            for (const child of children) {
              traverseNodes(child);
            }
          }
        };

        traverseNodes(root);

        // Debug logging every few updates
        if (AUDIO_DEBUG) {
          if (hasUpdates && currentlyPlayingWord) {
            console.log('🎵 Word highlighting:', currentlyPlayingWord);
          } else if (isPlaying && t > 0) {
            // Throttle 'no word highlighted' messages to reduce noise
            (AudioSyncPlugin as any)._lastNoWordLog = (AudioSyncPlugin as any)._lastNoWordLog || 0;
            const now = Date.now();
            if (now - (AudioSyncPlugin as any)._lastNoWordLog > 1000) {
              (AudioSyncPlugin as any)._lastNoWordLog = now;
              console.log('🔍 No word highlighted at time:', t, 'minStart:', minStart.toFixed(3));
            }
          }
        }
        
        // Additional debug logging for highlighting issues
        if (AUDIO_DEBUG && isPlaying && t > minStart) {
          let totalWords = 0;
          let wordsInTimeRange = 0;
          root.getChildren().forEach((node: any) => {
            const stack: any[] = [node];
            while (stack.length) {
              const n = stack.pop();
              if ((n as any).getChildren) {
                const children = (n as any).getChildren();
                for (const c of children) stack.push(c);
              }
              if ((n as any).getType && (n as any).getType() === 'word') {
                totalWords++;
                const start = (n as any).getStart?.();
                const end = (n as any).getEnd?.();
                if (typeof start === 'number' && typeof end === 'number' && t >= start && t <= end) {
                  wordsInTimeRange++;
                }
              }
            }
          });
          
          (AudioSyncPlugin as any)._lastWordCountLog = (AudioSyncPlugin as any)._lastWordCountLog || 0;
          const now = Date.now();
          if (now - (AudioSyncPlugin as any)._lastWordCountLog > 2000) {
            (AudioSyncPlugin as any)._lastWordCountLog = now;
            console.log('🔍 Word search debug:', {
              time: t.toFixed(3),
              totalWords,
              wordsInTimeRange,
              minStart: minStart.toFixed(3),
              hasUpdates,
              currentlyPlayingWord: currentlyPlayingWord ? 'yes' : 'no'
            });
          }
        }
      });
    };

    // Update word highlighting whenever currentOriginalTime changes
    updateWordHighlights();
  }, [currentOriginalTime, isPlaying, editor]);
  
  // Debug useEffect to track prop changes
  React.useEffect(() => {
    const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    if (AUDIO_DEBUG) {
      console.log('[AudioSyncPlugin] Props changed:', {
        currentOriginalTime,
        type: typeof currentOriginalTime,
        isPlaying
      });
    }
  }, [currentOriginalTime, isPlaying]);

  // Handle word clicks for seeking
  useEffect(() => {
    const handleWordClick = (event: MouseEvent) => {
      // In edit mode, allow Lexical to place the caret and handle editing
      if (editor.isEditable()) {
        return;
      }
      const target = event.target as HTMLElement;
      
      // Check if clicked element is a word node
      if (target.classList.contains('lexical-word-node')) {
        const startTime = target.getAttribute('data-start-time');
        if (startTime && onSeekAudio) {
          const timestamp = parseFloat(startTime);
          onSeekAudio(timestamp);
          
          // Prevent default text selection behavior
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    // Get the editor's root element
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('click', handleWordClick, true);
      
      return () => {
        editorElement.removeEventListener('click', handleWordClick, true);
      };
    }
  }, [editor, onSeekAudio]);

  // Auto-scroll to current word (optional feature)
  useEffect(() => {
    if (!isPlaying) return;

    const scrollToCurrentWord = () => {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        let currentWordElement: HTMLElement | null = null;

        const findCurrentWord = (node: LexicalNode): boolean => {
          if ($isWordNode(node as any)) {
            if (node.isCurrentlyPlaying(currentOriginalTime)) {
              // Find the DOM element for this node
              const key = node.getKey();
              const element = editor.getElementByKey(key);
              if (element) {
                currentWordElement = element as HTMLElement;
                return true;
              }
            }
          }

          if ($isElementNode(node)) {
            const children = (node as ElementNode).getChildren();
            for (const child of children) {
              if (findCurrentWord(child)) {
                return true;
              }
            }
          }
          return false;
        };

        findCurrentWord(root);

        // Scroll to the current word if found
        if (currentWordElement) {
          currentWordElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      });
    };

    // Throttle auto-scrolling to avoid excessive scrolling
    const scrollThrottleRef = { current: 0 };
    const throttledScroll = () => {
      const now = Date.now();
      if (now - scrollThrottleRef.current > 1000) { // Max once per second
        scrollThrottleRef.current = now;
        scrollToCurrentWord();
      }
    };

    // Only auto-scroll if user hasn't manually scrolled recently
    const timeoutId = setTimeout(throttledScroll, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentOriginalTime, isPlaying, editor]);

  // Handle keyboard shortcuts for audio control
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when editor has focus
      const editorElement = editor.getRootElement();
      if (!editorElement || !editorElement.contains(document.activeElement)) {
        return;
      }

      // Space bar to play/pause (when not editing text)
      if (event.code === 'Space' && event.target === editorElement) {
        const selection = $getSelection();
        if (!selection || selection.getNodes().length === 0) {
          // No text selection, treat as play/pause
          event.preventDefault();
          // Emit custom event for audio control
          window.dispatchEvent(new CustomEvent('audio-toggle-playback'));
        }
      }

      // Left/Right arrows for seeking (when holding Shift)
      if (event.shiftKey && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
        event.preventDefault();
        const seekAmount = event.code === 'ArrowLeft' ? -5 : 5;
        const newTime = Math.max(0, (currentOriginalTime || 0) + seekAmount);
        onSeekAudio?.(newTime);
      }
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('keydown', handleKeyDown);
      
      return () => {
        editorElement.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [editor, currentOriginalTime, onSeekAudio]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // This plugin doesn't render anything
  return null;
}
