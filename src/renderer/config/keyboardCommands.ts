/**
 * keyboardCommands.ts - Central registry of all keyboard commands
 */

import { KeyboardCommand, KeyboardCommandContext } from '../types/keyboard';
import { generateWordId } from '../audio/AudioAppState';

// Helper function to format time display
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Helper to show toast notification (we'll implement this later)
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  console.log(`Toast: ${message} (${type})`);
};

// Global Commands - Work in both Listen and Edit modes
const GLOBAL_COMMANDS: KeyboardCommand[] = [
  {
    key: ' ',
    context: 'global',
    category: 'Audio Control',
    description: 'Play/Pause',
    preventDefault: true,
    action: async ({ audioActions, audioState }) => {
      console.log('[keyboardCommands] Spacebar action triggered');
      console.log('[keyboardCommands] Current audioState.isPlaying:', audioState.isPlaying);
      console.log('[keyboardCommands] audioActions available:', !!audioActions);
      try {
        console.log('[keyboardCommands] Calling togglePlayPause...');
        await audioActions.togglePlayPause();
        console.log('[keyboardCommands] togglePlayPause completed, new state:', audioState.isPlaying);
        showToast(audioState.isPlaying ? 'Paused' : 'Playing');
      } catch (error) {
        console.error('[keyboardCommands] Playback error:', error);
        showToast('Playback error', 'error');
      }
    }
  },
  
  {
    key: 'ArrowLeft',
    context: 'global',
    category: 'Audio Control',
    description: 'Skip back 5 seconds',
    action: ({ audioActions, audioState }) => {
      const newTime = Math.max(0, audioState.currentTime - 5);
      audioActions.seekToTime(newTime);
      showToast(`Skipped to ${formatTime(newTime)}`);
    }
  },
  
  {
    key: 'ArrowRight',
    context: 'global',
    category: 'Audio Control', 
    description: 'Skip forward 5 seconds',
    action: ({ audioActions, audioState }) => {
      const newTime = Math.min(audioState.duration, audioState.currentTime + 5);
      audioActions.seekToTime(newTime);
      showToast(`Skipped to ${formatTime(newTime)}`);
    }
  },
  
  {
    key: 'ArrowLeft',
    modifiers: ['shift'],
    context: 'global',
    category: 'Audio Control',
    description: 'Skip back 15 seconds',
    action: ({ audioActions, audioState }) => {
      const newTime = Math.max(0, audioState.currentTime - 15);
      audioActions.seekToTime(newTime);
      showToast(`Skipped to ${formatTime(newTime)}`);
    }
  },
  
  {
    key: 'ArrowRight',
    modifiers: ['shift'],
    context: 'global',
    category: 'Audio Control',
    description: 'Skip forward 15 seconds',
    action: ({ audioActions, audioState }) => {
      const newTime = Math.min(audioState.duration, audioState.currentTime + 15);
      audioActions.seekToTime(newTime);
      showToast(`Skipped to ${formatTime(newTime)}`);
    }
  },
  
  {
    key: 'ArrowUp',
    context: 'global',
    category: 'Audio Control',
    description: 'Increase playback speed',
    action: ({ audioActions, audioState }) => {
      const newRate = Math.min(4.0, audioState.playbackRate + 0.1);
      audioActions.setPlaybackRate(newRate);
      showToast(`Speed: ${newRate.toFixed(1)}x`);
    }
  },
  
  {
    key: 'ArrowDown',
    context: 'global',
    category: 'Audio Control',
    description: 'Decrease playback speed',
    action: ({ audioActions, audioState }) => {
      const newRate = Math.max(0.25, audioState.playbackRate - 0.1);
      audioActions.setPlaybackRate(newRate);
      showToast(`Speed: ${newRate.toFixed(1)}x`);
    }
  },
  
  {
    key: 'Home',
    context: 'global',
    category: 'Navigation',
    description: 'Go to beginning',
    action: ({ audioActions, onGoToStart }) => {
      if (onGoToStart) {
        onGoToStart();
      } else {
        audioActions.seekToTime(0);
      }
      showToast('Jumped to beginning');
    }
  },
  
  {
    key: 'End',
    context: 'global',
    category: 'Navigation', 
    description: 'Go to end',
    action: ({ audioActions, audioState, onGoToEnd }) => {
      if (onGoToEnd) {
        onGoToEnd();
      } else {
        audioActions.seekToTime(audioState.duration - 1);
      }
      showToast('Jumped to end');
    }
  }
];

// Listen Mode Commands - Navigation and playback focused
const LISTEN_COMMANDS: KeyboardCommand[] = [
  {
    key: 'j',
    context: 'listen',
    category: 'Navigation',
    description: 'Jump to next clip',
    action: ({ onNextClip }) => {
      if (onNextClip) {
        onNextClip();
        showToast('Next clip');
      }
    },
    enabled: ({ onNextClip }) => !!onNextClip
  },
  
  {
    key: 'k', 
    context: 'listen',
    category: 'Navigation',
    description: 'Jump to previous clip',
    action: ({ onPreviousClip }) => {
      if (onPreviousClip) {
        onPreviousClip();
        showToast('Previous clip');
      }
    },
    enabled: ({ onPreviousClip }) => !!onPreviousClip
  },
  
  {
    key: 'Tab',
    context: 'listen',
    category: 'Mode',
    description: 'Switch to Edit mode',
    preventDefault: true,
    action: ({ onModeSwitch }) => {
      if (onModeSwitch) {
        onModeSwitch('edit');
        showToast('Switched to Edit mode');
      }
    },
    enabled: ({ onModeSwitch }) => !!onModeSwitch
  }
];

// Edit Mode Commands - Editing and manipulation focused  
const EDIT_COMMANDS: KeyboardCommand[] = [
  {
    key: 'Enter',
    context: 'edit',
    category: 'Editing',
    description: 'Split clip at cursor',
    preventDefault: true,
    action: ({ cursorPosition, onClipSplit }) => {
      if (cursorPosition && onClipSplit) {
        onClipSplit(cursorPosition.clipId, cursorPosition.localWordIndex);
        showToast('Clip split');
      }
    },
    enabled: ({ cursorPosition, onClipSplit }) => !!(cursorPosition && onClipSplit)
  },
  
  {
    key: 'Delete',
    context: 'edit',
    category: 'Editing',
    description: 'Delete selected words',
    action: ({ selectedWordIds, onWordDelete }) => {
      if (selectedWordIds.size > 0 && onWordDelete) {
        onWordDelete(Array.from(selectedWordIds));
        showToast(`Deleted ${selectedWordIds.size} word${selectedWordIds.size === 1 ? '' : 's'}`);
      }
    },
    enabled: ({ selectedWordIds, onWordDelete }) => selectedWordIds.size > 0 && !!onWordDelete
  },
  
  {
    key: 'Backspace',
    context: 'edit', 
    category: 'Editing',
    description: 'Delete selected words',
    action: ({ selectedWordIds, onWordDelete }) => {
      if (selectedWordIds.size > 0 && onWordDelete) {
        onWordDelete(Array.from(selectedWordIds));
        showToast(`Deleted ${selectedWordIds.size} word${selectedWordIds.size === 1 ? '' : 's'}`);
      }
    },
    enabled: ({ selectedWordIds, onWordDelete }) => selectedWordIds.size > 0 && !!onWordDelete
  },
  
  {
    key: 'z',
    modifiers: ['ctrl'],
    context: 'edit',
    category: 'Editing',
    description: 'Undo last action',
    action: ({ onUndo }) => {
      if (onUndo) {
        onUndo();
        showToast('Undo');
      }
    },
    enabled: ({ onUndo }) => !!onUndo
  },
  
  {
    key: 'z', 
    modifiers: ['ctrl', 'shift'],
    context: 'edit',
    category: 'Editing',
    description: 'Redo last action',
    action: ({ onRedo }) => {
      if (onRedo) {
        onRedo();
        showToast('Redo');
      }
    },
    enabled: ({ onRedo }) => !!onRedo
  },
  
  {
    key: 'Escape',
    context: 'edit',
    category: 'Mode',
    description: 'Switch to Listen mode',
    action: ({ onModeSwitch }) => {
      if (onModeSwitch) {
        onModeSwitch('listen');
        showToast('Switched to Listen mode');
      }
    },
    enabled: ({ onModeSwitch }) => !!onModeSwitch
  },
  
  {
    key: 'a',
    modifiers: ['ctrl'],
    context: 'edit',
    category: 'Selection',
    description: 'Select all words in current clip',
    preventDefault: true,
    action: ({ cursorPosition, audioState }) => {
      if (cursorPosition) {
        const clip = audioState.clips.find(c => c.id === cursorPosition.clipId);
        if (clip) {
          // This would need to be implemented in the component
          showToast(`Selected all words in clip`);
        }
      }
    },
    enabled: ({ cursorPosition }) => !!cursorPosition
  }
];

// Combine all commands
export const KEYBOARD_COMMANDS: KeyboardCommand[] = [
  ...GLOBAL_COMMANDS,
  ...LISTEN_COMMANDS, 
  ...EDIT_COMMANDS
];

// Helper to get commands for current context
export const getCommandsForContext = (mode: 'listen' | 'edit'): KeyboardCommand[] => {
  return KEYBOARD_COMMANDS.filter(cmd => 
    cmd.context === 'global' || cmd.context === mode
  );
};

// Helper to find matching command
export const findMatchingCommand = (
  event: KeyboardEvent, 
  mode: 'listen' | 'edit'
): KeyboardCommand | null => {
  const availableCommands = getCommandsForContext(mode);
  
  return availableCommands.find(cmd => {
    // Check key match
    if (cmd.key !== event.key) return false;
    
    // Check modifiers
    const hasCtrl = event.ctrlKey || event.metaKey;
    const hasShift = event.shiftKey;
    const hasAlt = event.altKey;
    
    const requiredModifiers = cmd.modifiers || [];
    const hasRequiredCtrl = requiredModifiers.includes('ctrl') || requiredModifiers.includes('cmd');
    const hasRequiredShift = requiredModifiers.includes('shift');
    const hasRequiredAlt = requiredModifiers.includes('alt');
    
    // All required modifiers must be present, and no extra ones
    if (hasRequiredCtrl !== hasCtrl) return false;
    if (hasRequiredShift !== hasShift) return false;
    if (hasRequiredAlt !== hasAlt) return false;
    
    return true;
  }) || null;
};

// Helper to check if target is an input element
export const isInputElement = (target: EventTarget | null): boolean => {
  if (!target) return false;
  
  const element = target as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.contentEditable === 'true'
  );
};