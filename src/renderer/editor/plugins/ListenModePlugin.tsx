/**
 * ListenModePlugin - Implements Listen Mode specific features
 *
 * Features:
 * - Playback highlighting synchronized with audio
 * - Seamless text flow (hidden clip boundaries)
 * - Click-to-seek functionality
 * - Read-only enforcement
 * - Continuous text rendering without visual breaks
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection } from 'lexical';

export interface ListenModePluginProps {
  isListenMode: boolean;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export default function ListenModePlugin({
  isListenMode,
  currentTime = 0,
  onSeek,
  onPlaybackStateChange
}: ListenModePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [highlightedWordId, setHighlightedWordId] = useState<string | null>(null);
  const highlightIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ==================== CSS Injection for Listen Mode ====================

  useEffect(() => {
    if (!isListenMode) return;

    // Inject CSS for seamless text flow and highlighting
    const styleId = 'listen-mode-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      /* Listen Mode: Hide clip boundaries for seamless flow */
      .lexical-editor-v2[data-listen-mode="true"] .lexical-clip-container {
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      /* Hide speaker labels in listen mode */
      .lexical-editor-v2[data-listen-mode="true"] .clip-speaker-label {
        display: none !important;
      }

      /* Remove visual separations between clips */
      .lexical-editor-v2[data-listen-mode="true"] .lexical-clip-container + .lexical-clip-container {
        margin-top: 0 !important;
      }

      /* Seamless paragraph flow */
      .lexical-editor-v2[data-listen-mode="true"] .lexical-clip-container p {
        display: inline !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Add subtle space between words from different clips */
      .lexical-editor-v2[data-listen-mode="true"] .lexical-clip-container + .lexical-clip-container .lexical-word-node:first-child::before {
        content: " ";
        white-space: pre;
      }

      /* Playback highlighting */
      .lexical-word-node.highlighted-word {
        background-color: hsl(var(--accent)) !important;
        color: hsl(var(--accent-foreground)) !important;
        border-radius: 3px;
        padding: 1px 2px;
        transition: all 0.2s ease;
        box-shadow: 0 0 0 1px hsl(var(--accent));
      }

      /* Spacer highlighting */
      .lexical-spacer-node.highlighted-spacer {
        background-color: hsl(var(--muted)) !important;
        border-radius: 3px;
        padding: 1px 2px;
        transition: all 0.2s ease;
      }

      /* Smooth scroll for highlighted elements */
      .highlighted-word,
      .highlighted-spacer {
        scroll-margin-top: 100px;
      }

      /* Cursor changes for clickable text in listen mode */
      .lexical-editor-v2[data-listen-mode="true"] .lexical-word-node {
        cursor: pointer;
      }

      .lexical-editor-v2[data-listen-mode="true"] .lexical-spacer-node {
        cursor: pointer;
      }

      /* Disable text selection in listen mode */
      .lexical-editor-v2[data-listen-mode="true"] {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      /* Smooth transitions for all highlighting */
      .lexical-word-node,
      .lexical-spacer-node {
        transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
      }
    `;

    return () => {
      // Cleanup styles when exiting listen mode
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [isListenMode]);

  // ==================== Editor DOM Updates ====================

  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    // Set data attribute for CSS targeting
    if (isListenMode) {
      editorElement.setAttribute('data-listen-mode', 'true');
    } else {
      editorElement.removeAttribute('data-listen-mode');
    }

    // Clear highlighting when exiting listen mode
    if (!isListenMode) {
      clearAllHighlighting();
    }

    return () => {
      if (editorElement) {
        editorElement.removeAttribute('data-listen-mode');
      }
    };
  }, [isListenMode, editor]);

  // ==================== Playback Highlighting ====================

  useEffect(() => {
    if (!isListenMode) {
      clearAllHighlighting();
      return;
    }

    // Update highlighting based on current playback time
    updateHighlighting(currentTime);
  }, [isListenMode, currentTime]);

  const updateHighlighting = (time: number) => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    // Find the word or spacer that should be highlighted at current time
    const targetElement = findElementAtTime(editorElement, time);

    // Clear previous highlighting
    clearAllHighlighting();

    if (targetElement) {
      const elementId = targetElement.getAttribute('data-word-id') ||
                       targetElement.getAttribute('data-spacer-id');

      if (elementId) {
        setHighlightedWordId(elementId);

        // Add highlighting class
        if (targetElement.classList.contains('lexical-word-node')) {
          targetElement.classList.add('highlighted-word');
        } else if (targetElement.classList.contains('lexical-spacer-node')) {
          targetElement.classList.add('highlighted-spacer');
        }

        // Smooth scroll to highlighted element
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  };

  const findElementAtTime = (container: HTMLElement, time: number): HTMLElement | null => {
    // Find word nodes first (they have precise timing)
    const wordNodes = container.querySelectorAll('.lexical-word-node[data-start-time]');

    for (const wordNode of wordNodes) {
      const element = wordNode as HTMLElement;
      const startTime = parseFloat(element.getAttribute('data-start-time') || '0');
      const endTime = parseFloat(element.getAttribute('data-end-time') || '0');

      if (time >= startTime && time < endTime) {
        return element;
      }
    }

    // If no word found, check spacers
    const spacerNodes = container.querySelectorAll('.lexical-spacer-node[data-start-time]');

    for (const spacerNode of spacerNodes) {
      const element = spacerNode as HTMLElement;
      const startTime = parseFloat(element.getAttribute('data-start-time') || '0');
      const endTime = parseFloat(element.getAttribute('data-end-time') || '0');

      if (time >= startTime && time < endTime) {
        return element;
      }
    }

    return null;
  };

  const clearAllHighlighting = () => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    // Remove highlighting classes from all elements
    const highlightedWords = editorElement.querySelectorAll('.highlighted-word');
    highlightedWords.forEach(el => el.classList.remove('highlighted-word'));

    const highlightedSpacers = editorElement.querySelectorAll('.highlighted-spacer');
    highlightedSpacers.forEach(el => el.classList.remove('highlighted-spacer'));

    setHighlightedWordId(null);
  };

  // ==================== Click-to-Seek ====================

  useEffect(() => {
    if (!isListenMode) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is on a word or spacer
      if (target.classList.contains('lexical-word-node') ||
          target.classList.contains('lexical-spacer-node')) {

        const startTime = target.getAttribute('data-start-time');
        if (startTime && onSeek) {
          const time = parseFloat(startTime);
          onSeek(time);

          // Provide visual feedback
          target.style.transform = 'scale(1.05)';
          setTimeout(() => {
            target.style.transform = '';
          }, 150);
        }
      }
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('click', handleClick);
      return () => editorElement.removeEventListener('click', handleClick);
    }
  }, [isListenMode, editor, onSeek]);

  // ==================== Disable Text Selection ====================

  useEffect(() => {
    if (!isListenMode) return;

    const preventSelection = (event: Event) => {
      event.preventDefault();
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('selectstart', preventSelection);
      editorElement.addEventListener('dragstart', preventSelection);

      return () => {
        editorElement.removeEventListener('selectstart', preventSelection);
        editorElement.removeEventListener('dragstart', preventSelection);
      };
    }
  }, [isListenMode, editor]);

  // ==================== Auto-scroll During Playback ====================

  useEffect(() => {
    if (!isListenMode) return;

    // Set up interval for smooth auto-scrolling during playback
    highlightIntervalRef.current = setInterval(() => {
      const highlightedElement = document.querySelector('.highlighted-word, .highlighted-spacer');

      if (highlightedElement) {
        // Check if element is out of view and scroll if needed
        const rect = highlightedElement.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        if (rect.top < 100 || rect.bottom > windowHeight - 100) {
          highlightedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }, 1000); // Check every second

    return () => {
      if (highlightIntervalRef.current) {
        clearInterval(highlightIntervalRef.current);
      }
    };
  }, [isListenMode]);

  // ==================== Performance Optimization ====================

  // Debounce highlighting updates to prevent excessive DOM manipulation
  const [debouncedTime, setDebouncedTime] = useState(currentTime);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTime(currentTime);
    }, 100); // 100ms debounce

    return () => clearTimeout(timer);
  }, [currentTime]);

  // ==================== Debug Information ====================

  useEffect(() => {
    if (isListenMode) {
      console.log('🎧 Listen Mode activated');
      console.log('Current time:', currentTime.toFixed(2), 'seconds');
      console.log('Highlighted element ID:', highlightedWordId);
    } else {
      console.log('🎧 Listen Mode deactivated');
    }
  }, [isListenMode, currentTime, highlightedWordId]);

  return null; // This plugin doesn't render anything
}

// ==================== Utility Functions ====================

/**
 * Check if an element is currently visible in the viewport
 */
function isElementInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Get smooth scroll position for an element
 */
function getSmoothScrollPosition(element: Element): number {
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  return window.scrollY + rect.top - (windowHeight / 2);
}