/**
 * useLayoutKeyboard.ts - Keyboard shortcuts for layout management
 * 
 * Handles global keyboard shortcuts for:
 * - Toggle panels (P)
 * - Toggle audio sliders (Shift+P, Shift+E)
 * - Mode switching (1, 2)
 */

import { useEffect, useCallback } from 'react';

export interface LayoutKeyboardHandlers {
  onTogglePanels: () => void;
  onTogglePlayer: () => void;
  onToggleEditor: () => void;
  onSwitchToListen?: () => void;
  onSwitchToEdit?: () => void;
}

export const useLayoutKeyboard = (handlers: LayoutKeyboardHandlers) => {
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

    // Handle different key combinations
    switch (event.key.toLowerCase()) {
      case 'p':
        if (event.shiftKey) {
          // Shift+P: Toggle player
          event.preventDefault();
          handlers.onTogglePlayer();
        } else if (!event.metaKey && !event.ctrlKey) {
          // P: Toggle panels
          event.preventDefault();
          handlers.onTogglePanels();
        }
        break;

      case 'e':
        if (event.shiftKey) {
          // Shift+E: Toggle editor
          event.preventDefault();
          handlers.onToggleEditor();
        }
        break;

      case '1':
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
          // 1: Switch to listen mode
          event.preventDefault();
          handlers.onSwitchToListen?.();
        }
        break;

      case '2':
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
          // 2: Switch to edit mode
          event.preventDefault();
          handlers.onSwitchToEdit?.();
        }
        break;

      case 'escape':
        // TODO: Close active modals, panels, etc.
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

export default useLayoutKeyboard;