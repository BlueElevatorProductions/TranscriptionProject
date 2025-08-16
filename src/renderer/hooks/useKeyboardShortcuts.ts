/**
 * useKeyboardShortcuts.ts - Comprehensive keyboard shortcuts for the application
 * 
 * Keyboard Shortcuts:
 * - Space: Play/Pause audio
 * - Tab: Switch between modes (Playback/Transcript Edit/Audio Edit)
 * - Cmd/Ctrl+S: Save project
 * - Cmd/Ctrl+P: Print transcript  
 * - Cmd/Ctrl+B: Bold selected text
 * - Cmd/Ctrl+I: Italicize selected text
 * - Cmd/Ctrl+H: Highlight selected text (or current sentence during playback)
 * - Cmd/Ctrl+N: New project
 * - Option/Alt+C: New clip (selection to clip or cursor position)
 * - Escape: Close modals/panels
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutHandlers {
  // Audio controls
  onPlayPause?: () => void;
  
  // Mode switching
  onSwitchMode?: () => void; // Tab key cycling
  
  // File operations
  onSave?: () => void;
  onPrint?: () => void;
  onNew?: () => void;
  
  // Text formatting
  onBold?: () => void;
  onItalic?: () => void;
  onHighlight?: () => void;
  
  // Clip operations
  onNewClip?: () => void;
  
  // Navigation
  onEscape?: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input, textarea, or contenteditable
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    const altKey = isMac ? event.altKey : event.altKey;

    // Handle different key combinations
    switch (event.key.toLowerCase()) {
      // Audio controls
      case ' ':
        // Spacebar: Play/Pause
        if (!event.shiftKey && !modKey && !altKey) {
          event.preventDefault();
          handlers.onPlayPause?.();
        }
        break;

      // Mode switching
      case 'tab':
        // Tab: Switch between modes
        if (!modKey && !altKey) {
          event.preventDefault();
          handlers.onSwitchMode?.();
        }
        break;

      // File operations
      case 's':
        if (modKey && !event.shiftKey && !altKey) {
          // Cmd/Ctrl+S: Save
          event.preventDefault();
          handlers.onSave?.();
        }
        break;

      case 'p':
        if (modKey && !event.shiftKey && !altKey) {
          // Cmd/Ctrl+P: Print
          event.preventDefault();
          handlers.onPrint?.();
        }
        break;

      case 'n':
        if (modKey && !event.shiftKey && !altKey) {
          // Cmd/Ctrl+N: New project
          event.preventDefault();
          handlers.onNew?.();
        }
        break;

      // Text formatting
      case 'b':
        if (modKey && !event.shiftKey && !altKey) {
          // Cmd/Ctrl+B: Bold
          event.preventDefault();
          handlers.onBold?.();
        }
        break;

      case 'i':
        if (modKey && !event.shiftKey && !altKey) {
          // Cmd/Ctrl+I: Italic
          event.preventDefault();
          handlers.onItalic?.();
        }
        break;

      case 'h':
        if (modKey && !event.shiftKey && !altKey) {
          // Cmd/Ctrl+H: Highlight
          event.preventDefault();
          handlers.onHighlight?.();
        }
        break;

      // Clip operations
      case 'c':
        if (altKey && !modKey && !event.shiftKey) {
          // Option/Alt+C: New clip
          event.preventDefault();
          handlers.onNewClip?.();
        }
        break;

      // Navigation
      case 'escape':
        handlers.onEscape?.();
        break;
    }
  }, [handlers]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default useKeyboardShortcuts;