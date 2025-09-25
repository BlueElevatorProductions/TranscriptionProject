// Shared transport interfaces and IPC schemas for the JUCE backend

export type TransportId = string;

// Edited timeline clip description sent to JUCE
export interface EdlClip {
  id: string;
  startSec: number; // in edited timeline seconds (may be contiguous for reordered clips)
  endSec: number;   // in edited timeline seconds (may be contiguous for reordered clips)
  order: number;    // ordering within the edited timeline
  deleted?: number[]; // optional word indexes deleted in this clip
  // For reordered clips with contiguous timeline, include original audio positions
  originalStartSec?: number; // original audio file position
  originalEndSec?: number;   // original audio file position
  // Segments array for JUCE backend word-level playback
  segments?: Array<{
    type: 'word' | 'spacer';
    startSec: number; // relative to clip start
    endSec: number;   // relative to clip start
    text?: string;    // word text (empty for spacers)
    originalStartSec?: number; // original audio file position
    originalEndSec?: number;   // original audio file position
  }>;
}

// Commands sent to the JUCE backend (JSON lines over stdio)
export type JuceCommand =
  | { type: 'load'; id: TransportId; path: string }
  | { type: 'updateEdl'; id: TransportId; revision?: number; clips: EdlClip[] }
  | { type: 'updateEdlFromFile'; id: TransportId; revision?: number; path: string }
  | { type: 'play'; id: TransportId }
  | { type: 'pause'; id: TransportId }
  | { type: 'stop'; id: TransportId }
  | { type: 'seek'; id: TransportId; timeSec: number } // edited timeline time
  | { type: 'setRate'; id: TransportId; rate: number } // Legacy: changes both speed and pitch
  | { type: 'setTimeStretch'; id: TransportId; ratio: number } // New: changes speed while preserving pitch
  | { type: 'setVolume'; id: TransportId; value: number }
  | { type: 'queryState'; id: TransportId };

// Events emitted by the JUCE backend
export type JuceEvent =
  | { type: 'loaded'; id: TransportId; durationSec: number; sampleRate: number; channels: number }
  | { type: 'state'; id: TransportId; playing: boolean }
  | { type: 'position'; id: TransportId; editedSec: number; originalSec: number; revision?: number }
  | { type: 'edlApplied'; id: TransportId; revision: number; wordCount?: number; spacerCount?: number; totalSegments?: number }
  | { type: 'ended'; id: TransportId }
  | { type: 'error'; id?: TransportId; code?: string | number; message: string };

// Renderer-facing transport interface (to be bridged via preload)
export interface TransportEvents {
  onLoaded?: (e: Extract<JuceEvent, { type: 'loaded' }>) => void;
  onState?: (e: Extract<JuceEvent, { type: 'state' }>) => void;
  onPosition?: (e: Extract<JuceEvent, { type: 'position' }>) => void;
  onEnded?: (e: Extract<JuceEvent, { type: 'ended' }>) => void;
  onError?: (e: Extract<JuceEvent, { type: 'error' }>) => void;
  onEdlApplied?: (e: Extract<JuceEvent, { type: 'edlApplied' }>) => void;
}

export interface Transport {
  load(id: TransportId, path: string): Promise<{success: boolean, error?: string}>;
  updateEdl(
    id: TransportId,
    revision: number,
    clips: EdlClip[]
  ): Promise<{ success: boolean; revision?: number; counts?: { words: number; spacers: number; spacersWithOriginal?: number; total: number } }>;
  play(id: TransportId): Promise<void>;
  pause(id: TransportId): Promise<void>;
  stop(id: TransportId): Promise<void>;
  seek(id: TransportId, timeSec: number): Promise<void>;
  setRate(id: TransportId, rate: number): Promise<void>; // Legacy: changes both speed and pitch
  setTimeStretch(id: TransportId, ratio: number): Promise<void>; // New: changes speed while preserving pitch
  setVolume(id: TransportId, value: number): Promise<void>;
  queryState(id: TransportId): Promise<void>;
  dispose(): Promise<void>;
  // event subscription - concrete implementations may offer EventEmitter as well
  setEventHandlers(handlers: TransportEvents): void;
}

// Type guards for basic validation of events from JUCE
export function isJuceEvent(obj: any): obj is JuceEvent {
  if (!obj || typeof obj !== 'object' || typeof obj.type !== 'string') return false;
  switch (obj.type) {
    case 'loaded':
      return (
        typeof obj.id === 'string' &&
        typeof obj.durationSec === 'number' &&
        typeof obj.sampleRate === 'number' &&
        typeof obj.channels === 'number'
      );
    case 'state':
      return typeof obj.id === 'string' && typeof obj.playing === 'boolean';
    case 'position':
      return (
        typeof obj.id === 'string' &&
        typeof obj.editedSec === 'number' &&
        typeof obj.originalSec === 'number'
      );
    case 'edlApplied':
      return (
        typeof obj.id === 'string' &&
        typeof obj.revision === 'number' &&
        (obj.wordCount === undefined || typeof obj.wordCount === 'number') &&
        (obj.spacerCount === undefined || typeof obj.spacerCount === 'number') &&
        (obj.totalSegments === undefined || typeof obj.totalSegments === 'number')
      );
    case 'ended':
      return typeof obj.id === 'string';
    case 'error':
      return typeof obj.message === 'string';
    default:
      return false;
  }
}

export function isJuceCommand(obj: any): obj is JuceCommand {
  if (!obj || typeof obj !== 'object' || typeof obj.type !== 'string') return false;
  switch (obj.type) {
    case 'load':
      return typeof obj.id === 'string' && typeof obj.path === 'string';
    case 'updateEdl':
      return (
        typeof obj.id === 'string' &&
        Array.isArray(obj.clips) &&
        obj.clips.every((c: any) =>
          c && typeof c.id === 'string' && typeof c.startSec === 'number' && typeof c.endSec === 'number' && typeof c.order === 'number'
        )
      );
    case 'updateEdlFromFile':
      return typeof obj.id === 'string' && typeof obj.path === 'string';
    case 'play':
    case 'pause':
    case 'stop':
    case 'queryState':
      return typeof obj.id === 'string';
    case 'seek':
      return typeof obj.id === 'string' && typeof obj.timeSec === 'number';
    case 'setRate':
      return typeof obj.id === 'string' && typeof obj.rate === 'number';
    case 'setTimeStretch':
      return typeof obj.id === 'string' && typeof obj.ratio === 'number';
    case 'setVolume':
      return typeof obj.id === 'string' && typeof obj.value === 'number';
    default:
      return false;
  }
}
