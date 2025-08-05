/**
 * useKeyboardShortcuts.ts - Global keyboard shortcuts for the application
 * 
 * Provides keyboard shortcuts for common actions:
 * - Space: Play/Pause audio
 * - P: Toggle panels (future feature)
 * - Shift+P: Toggle audio player
 * - 1/2: Switch between Listen/Edit modes (future feature)
 * - Cmd/Ctrl+S: Save project
 * - Cmd/Ctrl+O: Open project
 * - Cmd/Ctrl+N: New project
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutHandlers {
  // Audio controls
  onPlayPause?: () => void;
  onToggleAudioPlayer?: () => void;
  
  // Layout controls (future features from Dev Preview)
  onTogglePanels?: () => void;
  onSwitchToListen?: () => void;
  onSwitchToEdit?: () => void;
  
  // File operations
  onSave?: () => void;
  onOpen?: () => void;
  onNew?: () => void;
  
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

    // Handle different key combinations
    switch (event.key.toLowerCase()) {
      // Audio controls
      case ' ':
        // Spacebar: Play/Pause
        if (!event.shiftKey && !modKey) {
          event.preventDefault();
          handlers.onPlayPause?.();
        }
        break;

      // Layout controls (from Dev Preview)
      case 'p':
        if (event.shiftKey) {
          // Shift+P: Toggle audio player
          event.preventDefault();
          handlers.onToggleAudioPlayer?.();
        } else if (!modKey) {
          // P: Toggle panels (future feature)
          event.preventDefault();
          handlers.onTogglePanels?.();
        }
        break;

      // Mode switching (future feature)
      case '1':
        if (!modKey && !event.shiftKey) {
          event.preventDefault();
          handlers.onSwitchToListen?.();
        }
        break;

      case '2':
        if (!modKey && !event.shiftKey) {
          event.preventDefault();
          handlers.onSwitchToEdit?.();
        }
        break;

      // File operations
      case 's':
        if (modKey) {
          // Cmd/Ctrl+S: Save
          event.preventDefault();
          handlers.onSave?.();
        }
        break;

      case 'o':
        if (modKey) {
          // Cmd/Ctrl+O: Open
          event.preventDefault();
          handlers.onOpen?.();
        }
        break;

      case 'n':
        if (modKey) {
          // Cmd/Ctrl+N: New
          event.preventDefault();
          handlers.onNew?.();
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