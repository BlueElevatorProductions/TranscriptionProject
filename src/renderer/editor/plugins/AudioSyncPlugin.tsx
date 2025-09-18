/**
 * AudioSyncPlugin - Handles precise word-level audio synchronization
 * Updates word highlighting based on actual audio playback time
 */

import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, $isElementNode, LexicalNode, ElementNode } from 'lexical';
import { WordNode, $isWordNode } from '../nodes/WordNode';

interface AudioSyncPluginProps {
  // Edited timeline time for highlighting
  currentTime?: number;
  isPlaying: boolean;
  onSeekAudio?: (timestamp: number) => void;
  // Enable simple click-to-seek in listen mode.
  // When false (edit mode), allow modified-click (Cmd/Ctrl/Alt) to seek.
  enableClickSeek?: boolean;
  // Prefer seeking by identity so backend maps to edited time
  onSeekWord?: (clipId: string, wordIndex: number) => void;
  // Deleted word IDs to suppress highlighting (text-only deletions)
  deletedWordIds?: Set<string>;
}

export default function AudioSyncPlugin({
  currentTime,
  isPlaying,
  onSeekAudio,
  enableClickSeek = false,
  onSeekWord,
  deletedWordIds,
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
      // 1) Update spacer (gap pill) highlighting regardless of word minStart
      try {
        const editorRootEl = editor.getRootElement();
        if (editorRootEl && typeof currentTime === 'number' && currentTime >= 0) {
          const spacers = editorRootEl.querySelectorAll<HTMLElement>('.lexical-spacer-node');
          spacers.forEach((el) => {
            const s = parseFloat(el.getAttribute('data-edited-start-sec') || el.getAttribute('data-start-sec') || 'NaN');
            const e = parseFloat(el.getAttribute('data-edited-end-sec') || el.getAttribute('data-end-sec') || 'NaN');
            if (!Number.isFinite(s) || !Number.isFinite(e)) return;
            if (currentTime >= s && currentTime <= e) {
              el.classList.add('playing');
            } else {
              el.classList.remove('playing');
            }
          });
        }
      } catch {}

      // 2) Word highlighting within editor state
      editor.update(() => {
        const root = $getRoot();
        const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
        let hasUpdates = false;
        let currentlyPlayingWord = null as null | { word: string; startTime: number; endTime: number; currentTime: number };
        let highlightedCount = 0;
        let blockedClipId: string | null = null;
        const lastNonDeletedBeforeTByClip = new Map<string, WordNode>();
        
        // Only process when we have valid time data
        if (typeof currentTime !== 'number' || currentTime < 0) {
          // Skip if time is invalid - this is normal during state transitions
          return;
        }
        
        if (AUDIO_DEBUG && isPlaying) {
          console.log('[AudioSyncPlugin] Processing time update:', {
            currentTime,
            isPlaying
          });
        }
        const t = currentTime;

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
              const start = (n as any).getEditedStart?.();
              if (typeof start === 'number' && start < minStart) minStart = start;
            }
          }
        });
        if (!isFinite(minStart)) minStart = 0;
        if (t < minStart) {
          // Early stage (e.g., music intro) — avoid word highlighting (but spacers already handled)
          return;
        }

        // Traverse all nodes to find WordNodes
        const getWordDomInfo = (node: WordNode): { clipId: string | null; localIndex: number } => {
          const el = editor.getElementByKey(node.getKey()) as HTMLElement | null;
          if (!el) return { clipId: null, localIndex: -1 };
          const container = el.closest('.lexical-clip-container') as HTMLElement | null;
          const clipId = container?.getAttribute('data-clip-id') || null;
          if (!container || !clipId) return { clipId: null, localIndex: -1 };
          const allWords = Array.from(container.querySelectorAll<HTMLElement>('.lexical-word-node'));
          const idx = allWords.indexOf(el);
          return { clipId, localIndex: idx };
        };

        const updateWordNode = (node: WordNode) => {
          let shouldHighlight = node.isCurrentlyPlaying(t);
          const currentlyHighlighted = node.getLatest().__isCurrentlyPlaying;

          // Candidate tracking for fallback: remember last non-deleted word in this clip before t
          const editedStart = node.getEditedStart();
          const { clipId, localIndex } = getWordDomInfo(node);
          if (clipId && editedStart <= t) {
            const isDeleted = !!(deletedWordIds && localIndex >= 0 && deletedWordIds.has(`${clipId}-word-${localIndex}`));
            if (!isDeleted) {
              lastNonDeletedBeforeTByClip.set(clipId, node);
            }
          }

          // Suppress highlight for deleted words
          if (shouldHighlight && deletedWordIds) {
            const { clipId, localIndex } = getWordDomInfo(node);
            if (clipId && localIndex >= 0 && deletedWordIds.has(`${clipId}-word-${localIndex}`)) {
              shouldHighlight = false;
              blockedClipId = clipId;
            }
          }

          if (shouldHighlight !== currentlyHighlighted) {
            node.setCurrentlyPlaying(shouldHighlight);
            hasUpdates = true;
            if (shouldHighlight) {
              highlightedCount++;
              currentlyPlayingWord = {
                word: node.getTextContent(),
                startTime: node.getEditedStart(),
                endTime: node.getEditedEnd(),
                currentTime: t,
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

        // If we blocked a deleted word highlight and nothing else was highlighted, prefer
        // the nearest previous non-deleted word in the same clip.
        if (highlightedCount === 0 && blockedClipId) {
          const candidate = lastNonDeletedBeforeTByClip.get(blockedClipId);
          if (candidate) {
            const was = candidate.getLatest().__isCurrentlyPlaying;
            if (!was) {
              candidate.setCurrentlyPlaying(true);
              hasUpdates = true;
            }
          }
        }

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

    // Update word highlighting whenever currentTime changes
    updateWordHighlights();
  }, [currentTime, isPlaying, deletedWordIds, editor]);
  
  // Debug useEffect to track prop changes
  React.useEffect(() => {
    const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    if (AUDIO_DEBUG) {
      console.log('[AudioSyncPlugin] Props changed:', {
        currentTime,
        type: typeof currentTime,
        isPlaying
      });
    }
  }, [currentTime, isPlaying]);

  // Handle word clicks for seeking
  useEffect(() => {
    const handleWordClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const modified = (event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey || (event as MouseEvent).altKey;

      // Only seek when enabled, or when user holds a modifier in edit mode
      if (!enableClickSeek && !modified) {
        const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
        if (AUDIO_DEBUG) console.log('[AudioSyncPlugin] Click ignored (edit mode, no modifier)');
        return;
      }
      
      // Check if clicked element is (or is within) a word node
      const wordEl = (target.closest && target.closest('.lexical-word-node')) as HTMLElement | null;
      if (wordEl && wordEl.classList.contains('lexical-word-node')) {
        // Try identity-based seek first: find enclosing clip and word index
        const container = wordEl.closest('.lexical-clip-container') as HTMLElement | null;
        const clipId = container?.getAttribute('data-clip-id') || undefined;
        if (clipId && onSeekWord) {
          const allWords = Array.from(container!.querySelectorAll<HTMLElement>('.lexical-word-node'));
          const idx = allWords.indexOf(wordEl);
          if (idx >= 0) {
            const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
            if (AUDIO_DEBUG) {
              console.log('[AudioSyncPlugin] Identity seek click:', {
                clipId,
                wordIndex: idx,
                totalWordsInClip: allWords.length,
                modifiedClick: modified,
                enableClickSeek,
              });
            }
            onSeekWord(clipId, idx);
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }

        // Fallback to edited timeline timestamp if identity path unavailable
        const editedStart = wordEl.getAttribute('data-start-time');
        if (editedStart && onSeekAudio) {
          const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
          if (AUDIO_DEBUG) {
            console.log('[AudioSyncPlugin] Fallback edited-time seek click:', {
              editedStart,
              modifiedClick: modified,
              enableClickSeek,
            });
          }
          const timestamp = parseFloat(editedStart);
          onSeekAudio(timestamp);
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
  }, [editor, onSeekAudio, onSeekWord, enableClickSeek]);

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
        const newTime = Math.max(0, (currentTime || 0) + seekAmount);
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
