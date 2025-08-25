/**
 * keyboard.ts - Type definitions for keyboard system
 */

import { AudioEditorActions, AudioEditorState } from '../hooks/useAudioEditor';
import { TimelinePosition } from '../audio/AudioAppState';

export type KeyboardModifier = 'ctrl' | 'cmd' | 'shift' | 'alt';

export type KeyboardContext = 'global' | 'listen' | 'edit';

export interface KeyboardCommandContext {
  // Audio system
  audioActions: AudioEditorActions;
  audioState: AudioEditorState;
  
  // Mode and UI state
  mode: 'listen' | 'edit';
  cursorPosition: TimelinePosition | null;
  selectedWordIds: Set<string>;
  
  // Edit operations
  onClipSplit?: (clipId: string, wordIndex: number) => void;
  onWordDelete?: (wordIds: string[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onModeSwitch?: (newMode: 'listen' | 'edit') => void;
  
  // Navigation helpers
  onNextClip?: () => void;
  onPreviousClip?: () => void;
  onGoToStart?: () => void;
  onGoToEnd?: () => void;
}

export interface KeyboardCommand {
  // Key identification
  key: string;
  modifiers?: KeyboardModifier[];
  
  // Context and behavior
  context: KeyboardContext;
  description: string;
  category: string;
  
  // Execution
  action: (context: KeyboardCommandContext) => void | Promise<void>;
  
  // Conditions
  enabled?: (context: KeyboardCommandContext) => boolean;
  preventDefault?: boolean;
}

export interface KeyboardEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

export interface KeyboardShortcut {
  key: string;
  modifiers?: KeyboardModifier[];
  description: string;
}

export interface KeyboardCategory {
  name: string;
  description: string;
  shortcuts: KeyboardShortcut[];
}