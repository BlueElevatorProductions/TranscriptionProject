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
}

// Commands sent to the JUCE backend (JSON lines over stdio)
export type JuceCommand =
  | { type: 'load'; id: TransportId; path: string }
  | { type: 'updateEdl'; id: TransportId; clips: EdlClip[] }
  | { type: 'play'; id: TransportId }
  | { type: 'pause'; id: TransportId }
  | { type: 'stop'; id: TransportId }
  | { type: 'seek'; id: TransportId; timeSec: number } // edited timeline time
  | { type: 'setRate'; id: TransportId; rate: number }
  | { type: 'setVolume'; id: TransportId; value: number }
  | { type: 'queryState'; id: TransportId };

// Events emitted by the JUCE backend
export type JuceEvent =
  | { type: 'loaded'; id: TransportId; durationSec: number; sampleRate: number; channels: number }
  | { type: 'state'; id: TransportId; playing: boolean }
  | { type: 'position'; id: TransportId; editedSec: number; originalSec: number }
  | { type: 'ended'; id: TransportId }
  | { type: 'error'; id?: TransportId; code?: string | number; message: string };

// Renderer-facing transport interface (to be bridged via preload)
export interface TransportEvents {
  onLoaded?: (e: Extract<JuceEvent, { type: 'loaded' }>) => void;
  onState?: (e: Extract<JuceEvent, { type: 'state' }>) => void;
  onPosition?: (e: Extract<JuceEvent, { type: 'position' }>) => void;
  onEnded?: (e: Extract<JuceEvent, { type: 'ended' }>) => void;
  onError?: (e: Extract<JuceEvent, { type: 'error' }>) => void;
}

export interface Transport {
  load(id: TransportId, path: string): Promise<void>;
  updateEdl(id: TransportId, clips: EdlClip[]): Promise<void>;
  play(id: TransportId): Promise<void>;
  pause(id: TransportId): Promise<void>;
  stop(id: TransportId): Promise<void>;
  seek(id: TransportId, timeSec: number): Promise<void>;
  setRate(id: TransportId, rate: number): Promise<void>;
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
    case 'play':
    case 'pause':
    case 'stop':
    case 'queryState':
      return typeof obj.id === 'string';
    case 'seek':
      return typeof obj.id === 'string' && typeof obj.timeSec === 'number';
    case 'setRate':
      return typeof obj.id === 'string' && typeof obj.rate === 'number';
    case 'setVolume':
      return typeof obj.id === 'string' && typeof obj.value === 'number';
    default:
      return false;
  }
}

