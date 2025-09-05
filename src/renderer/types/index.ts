/**
 * Comprehensive type definitions for TranscriptionProject
 * Enables strict typing throughout the application
 */

// ==================== Core Data Types ====================

export interface Word {
  start: number;
  end: number;
  word: string;
  score: number;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker: string;
  words: Word[];
  paragraphBreak?: boolean;
}

export interface TranscriptionResult {
  segments: Segment[];
  language: string;
  word_segments?: Word[];
  speakers?: { [key: string]: string };
}

export interface TranscriptionJob {
  id: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: TranscriptionResult;
  error?: string;
  speakerNames?: { [key: string]: string };
  speakerMerges?: { [key: string]: string };
}

export interface ProgressData {
  fileName: string;
  progress: number;
  status: string;
}

// ==================== Audio State ====================

export interface SharedAudioState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
}

export interface AudioMetadata {
  originalFile: string;  // For compatibility and reference
  originalName: string;
  embeddedPath?: string; // Path to audio file within package (e.g., "audio/original.wav")
  duration: number;
  format: string;
  size: number;
  embedded: boolean;     // Always true for package format
}

// ==================== Project Data Structure ====================

export interface ProjectMetadata {
  projectId: string;
  name: string;
  created: string;
  lastModified: string;
  version: string;
  audio: AudioMetadata;
  transcription: TranscriptionMetadata;
  ui: UISettings;
}

export interface TranscriptionMetadata {
  service: 'openai' | 'assemblyai' | 'whisperx' | 'local';
  model: string;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  completedAt?: string;
  duration?: number;
}

export interface UISettings {
  currentMode: 'playback' | 'transcript-edit';
  sidebarWidth: number;
  playbackSpeed: number;
  volume: number;
  currentTime: number;
  selectedSegmentId?: string | null;
}

export interface SpeakerData {
  version: string;
  speakers: { [key: string]: string };
  speakerMappings: { [key: string]: string };
  defaultSpeaker: string;
}

export interface ClipData {
  version: string;
  clips: Clip[];
  clipSettings: ClipSettings;
}

export interface ClipStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  highlightColor?: string;
}

export interface Clip {
  id: string;
  speaker: string;
  startTime: number;
  endTime: number;
  startWordIndex: number;
  endWordIndex: number;
  words: Word[];
  type: 'speaker-change' | 'paragraph-break' | 'user-created' | 'initial' | 'transcribed';
  text: string;
  duration: number;
  createdAt: number;
  modifiedAt: number;
  order: number;                // For clip reordering
  status: 'active' | 'deleted'; // For clip deletion/restoration
  style?: ClipStyle;            // Optional styling for the clip
}

export interface ClipSettings {
  defaultDuration: number;
  autoExport: boolean;
  exportFormat: 'mp3' | 'wav' | 'flac';
  
  // Segment grouping settings for natural clip creation
  grouping: {
    pauseThreshold: number;    // seconds - break on long pauses
    maxClipDuration: number;   // seconds - max duration per clip
    minWordsPerClip: number;   // minimum words to form a clip
    maxWordsPerClip: number;   // maximum words per clip
    sentenceTerminators: string[]; // punctuation that can end clips
  };
}

export interface ProjectData {
  project: ProjectMetadata;
  transcription: {
    version: string;
    segments: Segment[];
    speakers: { [key: string]: string };
    globalMetadata: {
      totalSegments: number;
      totalWords: number;
      averageConfidence: number;
      processingTime: number;
      editCount: number;
    };
  };
  originalTranscription?: {
    version: string;
    segments: Segment[];
    speakers: { [key: string]: string };
  };
  speakers: SpeakerData;
  clips: ClipData;
}

// ==================== Context State Types ====================

export interface AudioState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
  currentAudioPath: string | null;
  duration: number;
  isReady: boolean;
}

export interface ProjectState {
  projectData: ProjectData | null;
  hasUnsavedChanges: boolean;
  currentProjectPath: string | null;
  globalSpeakers: { [key: string]: string };
  editedSegments: Segment[];
  isLoading: boolean;
  error: string | null;
}

export interface TranscriptionState {
  jobs: TranscriptionJob[];
  selectedJob: TranscriptionJob | null;
  currentTranscriptionId: string | null;
  progressData: ProgressData;
  isProcessing: boolean;
}

export interface UIState {
  currentView: ViewType;
  playbackMode: PlaybackModeType;
  dialogs: DialogState;
  sidebarWidth: number;
  theme: 'light' | 'dark';
}

// ==================== Enums and Union Types ====================

export type ViewType = 
  | 'home' 
  | 'transcription-progress' 
  | 'speaker-identification' 
  | 'playback';

export type PlaybackModeType = 'playback' | 'transcript-edit' | 'audio-edit';

export interface DialogState {
  showImportDialog: boolean;
  showProjectImportDialog: boolean;
  showApiSettings: boolean;
  showExportDialog: boolean;
  showSettingsDialog: boolean;
}

// ==================== Action Types ====================

export type AudioAction =
  | { type: 'UPDATE_AUDIO_STATE'; payload: Partial<SharedAudioState> }
  | { type: 'SET_AUDIO_SOURCE'; payload: { path: string; duration: number } }
  | { type: 'SET_READY'; payload: boolean }
  | { type: 'RESET_AUDIO' };

export type ProjectAction =
  | { type: 'LOAD_PROJECT'; payload: ProjectData }
  | { type: 'UPDATE_PROJECT_DATA'; payload: Partial<ProjectData> }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'UPDATE_SPEAKERS'; payload: { [key: string]: string } }
  | { type: 'UPDATE_SEGMENTS'; payload: Segment[] }
  | { type: 'UPDATE_CLIPS'; payload: Clip[] }
  | { type: 'SET_PROJECT_PATH'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_PROJECT' };

export type TranscriptionAction =
  | { type: 'ADD_JOB'; payload: TranscriptionJob }
  | { type: 'UPDATE_JOB_PROGRESS'; payload: { id: string; progress: number; status?: string } }
  | { type: 'COMPLETE_JOB'; payload: { id: string; result: TranscriptionResult } }
  | { type: 'ERROR_JOB'; payload: { id: string; error: string } }
  | { type: 'SELECT_JOB'; payload: TranscriptionJob | null }
  | { type: 'REMOVE_JOB'; payload: string }
  | { type: 'SET_PROGRESS_DATA'; payload: ProgressData }
  | { type: 'SET_PROCESSING'; payload: boolean };

export type UIAction =
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SET_PLAYBACK_MODE'; payload: PlaybackModeType }
  | { type: 'TOGGLE_DIALOG'; payload: { dialog: keyof DialogState; show?: boolean } }
  | { type: 'SET_SIDEBAR_WIDTH'; payload: number }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' };

// ==================== Edit History Types ====================

export type EditActionType = 
  | 'word-edit' 
  | 'speaker-change' 
  | 'clip-create' 
  | 'word-insert' 
  | 'word-delete' 
  | 'paragraph-break'
  | 'selection-delete'   // Delete selected words (creates/marks clips as deleted)
  | 'clip-restore'      // Restore deleted clip
  | 'clip-reorder'      // Reorder clips
  | 'reset-to-original'; // Reset entire project to original state

export interface EditAction {
  type: EditActionType;
  data: any; // Specific to action type
  timestamp: number;
  description: string;
}

export interface EditHistoryState {
  history: EditAction[];
  currentIndex: number;
  maxHistorySize: number;
}

// ==================== Component Props Types ====================

export interface SpeakerInfo {
  id: string;
  name: string;
  segments: Segment[];
  totalDuration: number;
}

export interface Paragraph {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
  segments: Segment[];
}

// ==================== API Types ====================

export interface ApiKeys {
  [service: string]: string;
}

export interface TranscriptionServiceConfig {
  service: 'openai' | 'assemblyai' | 'whisperx';
  model: string;
  options?: {
    language?: string;
    prompt?: string;
    temperature?: number;
  };
}

// ==================== Error Types ====================

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

export interface ValidationError extends AppError {
  field: string;
  value: any;
}

// ==================== Utility Types ====================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ==================== Hook Return Types ====================

export interface UseAudioReturn {
  state: AudioState;
  actions: {
    updateAudioState: (updates: Partial<SharedAudioState>) => void;
    setAudioSource: (path: string, duration: number) => void;
    resetAudio: () => void;
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
  };
}

export interface UseProjectReturn {
  state: ProjectState;
  actions: {
    loadProject: (projectData: ProjectData) => void;
    updateProjectData: (updates: Partial<ProjectData>) => void;
    updateSpeakers: (speakers: { [key: string]: string }) => void;
    updateSegments: (segments: Segment[]) => void;
    updateClips: (clips: Clip[]) => void;
    setUnsavedChanges: (hasChanges: boolean) => void;
    setProjectPath: (path: string | null) => void;
    saveProject: () => Promise<void>;
    resetProject: () => void;
  };
}

export interface UseTranscriptionReturn {
  state: TranscriptionState;
  actions: {
    addJob: (job: TranscriptionJob) => void;
    updateJobProgress: (id: string, progress: number, status?: string) => void;
    completeJob: (id: string, result: TranscriptionResult) => void;
    selectJob: (job: TranscriptionJob | null) => void;
    removeJob: (id: string) => void;
  };
}