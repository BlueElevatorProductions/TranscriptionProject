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
type JuceCommandBase = {
  id: TransportId;
  generationId?: number;
};

export type JuceCommand =
  | ({ type: 'load'; path: string } & JuceCommandBase)
  | ({ type: 'updateEdl'; revision?: number; clips: EdlClip[] } & JuceCommandBase)
  | ({ type: 'updateEdlFromFile'; revision?: number; path: string } & JuceCommandBase)
  | ({ type: 'play' } & JuceCommandBase)
  | ({ type: 'pause' } & JuceCommandBase)
  | ({ type: 'stop' } & JuceCommandBase)
  | ({ type: 'seek'; timeSec: number } & JuceCommandBase) // edited timeline time
  | ({ type: 'setRate'; rate: number } & JuceCommandBase) // Legacy: changes both speed and pitch
  | ({ type: 'setTimeStretch'; ratio: number } & JuceCommandBase) // New: changes speed while preserving pitch
  | ({ type: 'setVolume'; value: number } & JuceCommandBase)
  | ({ type: 'queryState' } & JuceCommandBase);

// Events emitted by the JUCE backend
type JuceEventBase = {
  id: TransportId;
  generationId?: number;
};

export type BackendStatusEvent = {
  type: 'backendStatus';
  status: 'alive' | 'dead';
  pid?: number | null;
  code?: number | null;
  signal?: NodeJS.Signals | null;
  stderrTail?: string[];
  timestamp?: number;
};

export type JuceEvent =
  | ({ type: 'loaded'; durationSec: number; sampleRate: number; channels: number } & JuceEventBase)
  | ({ type: 'state'; playing: boolean } & JuceEventBase)
  | ({ type: 'position'; editedSec: number; originalSec: number; revision?: number } & JuceEventBase)
  | ({
        type: 'edlApplied';
        revision: number;
        wordCount?: number;
        spacerCount?: number;
        totalSegments?: number;
        mode?: 'contiguous' | 'standard' | string;
      } & JuceEventBase)
  | ({ type: 'ended' } & JuceEventBase)
  | { type: 'error'; id?: TransportId; code?: string | number; message: string; generationId?: number }
  | BackendStatusEvent;

// Renderer-facing transport interface (to be bridged via preload)
export interface TransportEvents {
  onLoaded?: (e: Extract<JuceEvent, { type: 'loaded' }>) => void;
  onState?: (e: Extract<JuceEvent, { type: 'state' }>) => void;
  onPosition?: (e: Extract<JuceEvent, { type: 'position' }>) => void;
  onEnded?: (e: Extract<JuceEvent, { type: 'ended' }>) => void;
  onError?: (e: Extract<JuceEvent, { type: 'error' }>) => void;
  onEdlApplied?: (e: Extract<JuceEvent, { type: 'edlApplied' }>) => void;
  onBackendStatus?: (e: Extract<JuceEvent, { type: 'backendStatus' }>) => void;
}

export interface Transport {
  load(id: TransportId, path: string, generationId?: number): Promise<{success: boolean, error?: string}>;
  updateEdl(
    id: TransportId,
    revision: number,
    clips: EdlClip[],
    generationId?: number
  ): Promise<{ success: boolean; revision?: number; counts?: { words: number; spacers: number; spacersWithOriginal?: number; total: number } }>;
  play(id: TransportId, generationId?: number): Promise<void>;
  pause(id: TransportId, generationId?: number): Promise<void>;
  stop(id: TransportId, generationId?: number): Promise<void>;
  seek(id: TransportId, timeSec: number, generationId?: number): Promise<void>;
  setRate(id: TransportId, rate: number, generationId?: number): Promise<void>; // Legacy: changes both speed and pitch
  setTimeStretch(id: TransportId, ratio: number, generationId?: number): Promise<void>; // New: changes speed while preserving pitch
  setVolume(id: TransportId, value: number, generationId?: number): Promise<void>;
  queryState(id: TransportId, generationId?: number): Promise<void>;
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
        (obj.totalSegments === undefined || typeof obj.totalSegments === 'number') &&
        (obj.mode === undefined || typeof obj.mode === 'string')
      );
    case 'ended':
      return typeof obj.id === 'string';
    case 'error':
      return typeof obj.message === 'string';
    case 'backendStatus':
      return obj.status === 'alive' || obj.status === 'dead';
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
