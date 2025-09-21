/**
 * TranscriptionProject v2.0 Type Definitions
 * Segment-based architecture with canonical state management
 */

// ==================== Core Segment Types ====================

/**
 * Word segment containing original transcription data
 * NEVER modify start/end times after creation
 */
export interface WordSegment {
  type: 'word';
  id: string;
  start: number;     // Clip-relative time
  end: number;       // Clip-relative time
  text: string;
  confidence: number;
  originalStart: number;  // Original transcription time (preserved)
  originalEnd: number;    // Original transcription time (preserved)
}

/**
 * Spacer segment for gaps between speech
 * Created from explicit gap detection, not timestamp stretching
 */
export interface SpacerSegment {
  type: 'spacer';
  id: string;
  start: number;     // Clip-relative time
  end: number;       // Clip-relative time
  duration: number;  // Gap duration
  label?: string;    // Optional label (e.g., "2.5 sec")
}

/**
 * Union type for all segment types
 */
export type Segment = WordSegment | SpacerSegment;

/**
 * Legacy segment interface for backward compatibility during migration
 * @deprecated Use Segment union type instead
 */
export interface LegacySegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker: string;
  words: Word[];
  paragraphBreak?: boolean;
}

/**
 * Legacy word interface for backward compatibility
 * @deprecated Use WordSegment instead
 */
export interface Word {
  start: number;
  end: number;
  word: string;
  score: number;
  speaker?: string;
}

export interface SpeakerSegmentSummary {
  speaker: string;
  start: number;
  end: number;
  text: string;
  segmentIds: (number | string)[];
  wordCount: number;
}

export interface TranscriptionResult {
  segments: LegacySegment[];     // Raw transcription segments
  language: string;
  word_segments?: Word[];        // Raw word data
  speakers?: { [key: string]: string };
  speakerSegments?: SpeakerSegmentSummary[];
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
  normalizedAt?: string | null;
  speakerSegments?: SpeakerSegmentSummary[];
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

/**
 * V2.0 Clip with segment-based architecture
 * Each clip contains ordered segments that cover [0, duration] exactly
 */
export interface Clip {
  id: string;
  speaker: string;
  startTime: number;            // Absolute timeline position
  endTime: number;              // Absolute timeline position
  duration: number;             // endTime - startTime
  segments: Segment[];          // Ordered segments covering [0, duration]
  type: 'speaker-change' | 'paragraph-break' | 'user-created' | 'transcribed';
  createdAt: number;
  modifiedAt: number;
  order: number;                // For clip reordering
  status: 'active' | 'deleted'; // For clip deletion/restoration
  style?: ClipStyle;            // Optional styling for the clip
}

/**
 * Legacy token type - REMOVED in v2.0
 * @deprecated Replaced by Segment union type
 */
export type Token =
  | { kind: 'word'; id: string; text: string; start: number; end: number; speaker?: string; score?: number }
  | { kind: 'gap'; id: string; start: number; end: number; label?: string };

/**
 * Legacy clip interface for migration purposes
 * @deprecated Use new Clip interface
 */
export interface LegacyClip {
  id: string;
  speaker: string;
  startTime: number;
  endTime: number;
  startWordIndex: number;
  endWordIndex: number;
  words: Word[];
  tokens?: Token[];
  type: 'speaker-change' | 'paragraph-break' | 'user-created' | 'initial' | 'transcribed' | 'audio-only';
  text: string;
  duration: number;
  createdAt: number;
  modifiedAt: number;
  order: number;
  status: 'active' | 'deleted';
  style?: ClipStyle;
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
  version: string;               // Project format version (v2.0)
  project: ProjectMetadata;
  transcription: {
    version: string;
    originalSegments: LegacySegment[];  // Raw transcription data (preserved)
    speakers: { [key: string]: string };
    speakerSegments?: SpeakerSegmentSummary[];
    globalMetadata: {
      totalSegments: number;
      totalWords: number;
      averageConfidence: number;
      processingTime: number;
      editCount: number;
    };
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
  editedClips: Clip[];           // Current clip state with segments
  isLoading: boolean;
  error: string | null;
}

export interface TranscriptionState {
  jobs: TranscriptionJob[];
  selectedJob: TranscriptionJob | null;
  currentTranscriptionId: string | null;
  progressData: ProgressData;
  isProcessing: boolean;
  speakerDirectory: { [key: string]: string };
  speakerSegments?: SpeakerSegmentSummary[];
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
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'MARK_JOB_NORMALIZED'; payload: { id: string; normalizedAt?: string | null } };

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
    errorJob: (id: string, error: string) => void;
    selectJob: (job: TranscriptionJob | null) => void;
    removeJob: (id: string) => void;
    setProgressData: (progressData: ProgressData) => void;
    setProcessing: (isProcessing: boolean) => void;
    markJobNormalized: (id: string, normalizedAt?: string | null) => void;
    startTranscription: (filePath: string, modelSize: string) => Promise<TranscriptionJob>;
  };
}

// ==================== V2.0 Edit Operations ====================

/**
 * Atomic edit operation for project state changes
 * All edits go through main process for validation
 */
export interface EditOperation {
  id: string;
  type: EditOperationType;
  timestamp: number;
  data: EditOperationData;
}

export type EditOperationType =
  | 'splitClip'
  | 'mergeClips'
  | 'deleteClip'
  | 'reorderClips'
  | 'insertSpacer'
  | 'nudgeBoundary'
  | 'editWord'
  | 'changeSpeaker';

export type EditOperationData =
  | SplitClipData
  | MergeClipsData
  | DeleteClipData
  | ReorderClipsData
  | InsertSpacerData
  | NudgeBoundaryData
  | EditWordData
  | ChangeSpeakerData;

export interface SplitClipData {
  clipId: string;
  segmentIndex: number;  // Split before this segment
}

export interface MergeClipsData {
  clipIds: string[];     // Clips to merge (must be contiguous)
}

export interface DeleteClipData {
  clipId: string;
}

export interface ReorderClipsData {
  clipId: string;
  newOrder: number;
}

export interface InsertSpacerData {
  clipId: string;
  segmentIndex: number;  // Insert before this segment
  duration: number;
}

export interface NudgeBoundaryData {
  clipId: string;
  boundary: 'start' | 'end';
  deltaSeconds: number;
}

export interface EditWordData {
  clipId: string;
  segmentIndex: number;
  newText: string;
}

export interface ChangeSpeakerData {
  clipId: string;
  newSpeaker: string;
}

// ==================== Segment Validation ====================

/**
 * Invariants that must be maintained for all clips
 */
export interface SegmentInvariants {
  /** Segments must cover [0, clip.duration] exactly */
  completeCoverage: boolean;
  /** No overlaps between segments */
  noOverlaps: boolean;
  /** Segments in chronological order */
  chronologicalOrder: boolean;
  /** All times are finite numbers */
  finiteTimes: boolean;
}

/**
 * Result of segment validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  invariants: SegmentInvariants;
}
