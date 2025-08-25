/**
 * useKeyboardManager.ts - React hook for handling keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';
import { KeyboardCommandContext } from '../types/keyboard';
import { findMatchingCommand, isInputElement } from '../config/keyboardCommands';

export const useKeyboardManager = (context: KeyboardCommandContext) => {
  const handleKeyDown = useCallback((event: globalThis.KeyboardEvent) => {
    console.log('[useKeyboardManager] KeyDown event:', event.key, 'mode:', context.mode);
    
    // Skip if user is typing in an input field
    if (isInputElement(event.target)) {
      console.log('[useKeyboardManager] Skipping - input element detected');
      return;
    }
    
    // Immediately prevent default for spacebar to stop browser scroll
    if (event.key === ' ') {
      console.log('[useKeyboardManager] Preventing spacebar default behavior');
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Skip if modal or dialog is open (could be enhanced later)
    if (document.querySelector('[role="dialog"]')) {
      console.log('[useKeyboardManager] Skipping - dialog is open');
      return;
    }
    
    // Find matching command for current mode
    const command = findMatchingCommand(event, context.mode);
    console.log('[useKeyboardManager] Command found:', command?.description || 'none');
    
    if (command) {
      // Check if command is enabled (optional condition check)
      if (command.enabled && !command.enabled(context)) {
        console.log('[useKeyboardManager] Command disabled by condition');
        return;
      }
      
      // Prevent default browser behavior if specified (for non-spacebar keys)
      if (command.preventDefault !== false && event.key !== ' ') {
        event.preventDefault();
        event.stopPropagation();
      }
      
      try {
        console.log('[useKeyboardManager] Executing command:', command.description);
        // Execute the command
        command.action(context);
        console.log('[useKeyboardManager] Command executed successfully');
      } catch (error) {
        console.error(`Keyboard command failed: ${command.description}`, error);
      }
    }
  }, [context]);
  
  useEffect(() => {
    // Add global keydown listener using capture phase to intercept events before they bubble
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown]);
  
  // This hook doesn't return anything - it just sets up the keyboard handling
};

// Helper hook to get available shortcuts for UI display
export const useKeyboardShortcuts = (mode: 'listen' | 'edit') => {
  return useCallback(() => {
    const { getCommandsForContext } = require('../config/keyboardCommands');
    return getCommandsForContext(mode);
  }, [mode]);
};