/**
 * AudioSyncPlugin - Handles precise word-level audio synchronization
 * Updates word highlighting based on actual audio playback time
 */

import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, $isElementNode, LexicalNode, ElementNode } from 'lexical';
import { WordNode, $isWordNode } from '../nodes/WordNode';

interface AudioSyncPluginProps {
  currentTime: number;
  isPlaying: boolean;
  onSeekAudio?: (timestamp: number) => void;
}

export default function AudioSyncPlugin({
  currentTime,
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

  // Word highlighting synchronization - trigger on currentTime changes
  useEffect(() => {
    const updateWordHighlights = () => {
      editor.update(() => {
        const root = $getRoot();
        let hasUpdates = false;
        let currentlyPlayingWord = null;

        // Traverse all nodes to find WordNodes
        const updateWordNode = (node: WordNode) => {
          const shouldHighlight = node.isCurrentlyPlaying(currentTime);
          const currentlyHighlighted = node.getLatest().__isCurrentlyPlaying;

          if (shouldHighlight !== currentlyHighlighted) {
            node.setCurrentlyPlaying(shouldHighlight);
            hasUpdates = true;
            
            if (shouldHighlight) {
              currentlyPlayingWord = {
                word: node.getTextContent(),
                startTime: node.getStart(),
                endTime: node.getEnd(),
                currentTime
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
        if (hasUpdates && currentlyPlayingWord) {
          console.log('🎵 Word highlighting:', currentlyPlayingWord);
        } else if (isPlaying && currentTime > 0) {
          // Debug: show why no words are highlighted
          console.log('🔍 No word highlighted at time:', currentTime);
        }
      });
    };

    // Update word highlighting whenever currentTime changes
    updateWordHighlights();
  }, [currentTime, isPlaying, editor]);

  // Handle word clicks for seeking
  useEffect(() => {
    const handleWordClick = (event: MouseEvent) => {
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
            if (node.isCurrentlyPlaying(currentTime)) {
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
  }, [currentTime, isPlaying, editor]);

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
        const newTime = Math.max(0, currentTime + seekAmount);
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
  }, [editor, currentTime, onSeekAudio]);

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
