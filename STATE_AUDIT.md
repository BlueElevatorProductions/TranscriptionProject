# State Management Audit - App.tsx

## Current State Variables Analysis

### App Initialization State (Local to App)
- `isInitialized: boolean` - App initialization status
- `initError: string | null` - Initialization error message
- `version: string` - App version (from Electron)
- `platform: string` - Platform information (from Electron)

### Navigation & UI State (Candidate for Context)
- `currentView: 'home' | 'transcription-progress' | 'speaker-identification' | 'playback'` - Main view routing
- `showImportDialog: boolean` - Import dialog visibility
- `showProjectImportDialog: boolean` - Project import dialog visibility  
- `showApiSettings: boolean` - API settings dialog visibility
- `playbackMode: 'playback' | 'transcript-edit'` - Sub-mode within playback view

### Transcription Job Management (HIGH PRIORITY - Needs Context)
- `transcriptionJobs: TranscriptionJob[]` - Array of all transcription jobs
- `selectedJob: TranscriptionJob | null` - Currently selected job
- `currentTranscriptionId: string | null` - Active transcription ID
- `progressData: { fileName: string, progress: number, status: string }` - Current transcription progress

### Project File Management (HIGH PRIORITY - Needs Context)
- `projectData: any` - Current project data (needs proper typing)
- `hasUnsavedChanges: boolean` - Dirty state indicator
- `currentProjectPath: string | null` - Path to current project file

### Audio State Management (HIGH PRIORITY - Already Centralized, Needs Context)
- `sharedAudioState: { currentTime: number, isPlaying: boolean, volume: number, playbackSpeed: number }`
- `handleAudioStateUpdate: function` - Safe audio state updater with validation

### Content State (HIGH PRIORITY - Needs Context)
- `globalSpeakers: {[key: string]: string}` - Speaker name mappings
- `editedSegments: any[]` - Transcript segments with edits (needs proper typing)

### API & Settings State (Candidate for Context)
- `currentApiKeys: { [service: string]: string }` - Cached API keys

## Recommended Context Structure

### 1. AudioContext
**State:**
```typescript
interface AudioState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
  currentAudioPath: string | null;
}
```

**Actions:**
- `UPDATE_AUDIO_STATE`
- `SET_AUDIO_SOURCE`
- `RESET_AUDIO`

### 2. ProjectContext
**State:**
```typescript
interface ProjectState {
  projectData: ProjectData | null;
  hasUnsavedChanges: boolean;
  currentProjectPath: string | null;
  globalSpeakers: { [key: string]: string };
  editedSegments: Segment[];
}
```

**Actions:**
- `LOAD_PROJECT`
- `UPDATE_PROJECT_DATA`
- `SET_UNSAVED_CHANGES`
- `UPDATE_SPEAKERS`
- `UPDATE_SEGMENTS`
- `RESET_PROJECT`

### 3. TranscriptionContext
**State:**
```typescript
interface TranscriptionState {
  jobs: TranscriptionJob[];
  selectedJob: TranscriptionJob | null;
  currentTranscriptionId: string | null;
  progressData: ProgressData;
}
```

**Actions:**
- `ADD_JOB`
- `UPDATE_JOB_PROGRESS`
- `COMPLETE_JOB`
- `SELECT_JOB`
- `REMOVE_JOB`

### 4. UIContext (Optional - for smaller state)
**State:**
```typescript
interface UIState {
  currentView: ViewType;
  playbackMode: PlaybackMode;
  dialogs: {
    showImportDialog: boolean;
    showProjectImportDialog: boolean;
    showApiSettings: boolean;
  };
}
```

**Actions:**
- `SET_VIEW`
- `SET_PLAYBACK_MODE`
- `TOGGLE_DIALOG`

## Props Drilling Analysis

### Current Prop Drilling Issues:
1. **Audio State** - Passed through App → PlaybackModeContainer/TranscriptEditContainer → BottomAudioPlayer
2. **Speaker Data** - Passed through App → Multiple components → SpeakersPanel
3. **Segment Data** - Passed through App → Mode containers → Display components
4. **Edit Handlers** - Passed down 3-4 levels in component tree

### Components Receiving Many Props:
- `PlaybackModeContainer` - 8 props (transcriptionJob, editedSegments, speakers, etc.)
- `TranscriptEditContainer` - 9 props (similar to above plus editing handlers)
- `BottomAudioPlayer` - 4 props (audio state and handlers)

## TypeScript Interface Improvements Needed

### Current Issues:
1. `projectData: any` - Needs proper ProjectData interface
2. `editedSegments: any[]` - Needs proper Segment interface  
3. `TranscriptionJob.result?: any` - Needs proper TranscriptionResult interface

### Recommended Strict Interfaces:
```typescript
interface ProjectData {
  project: {
    projectId: string;
    name: string;
    created: string;
    lastModified: string;
    audio: AudioMetadata;
    transcription: TranscriptionMetadata;
    ui: UISettings;
  };
  transcription: TranscriptionData;
  speakers: SpeakerData;
  clips: ClipData;
}

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker: string;
  words: Word[];
  paragraphBreak?: boolean;
}

interface Word {
  start: number;
  end: number;
  word: string;
  score: number;
}
```

## Migration Priority

### Phase 1 (Immediate - High Impact)
1. **AudioContext** - Centralize audio state (currently most stable)
2. **ProjectContext** - Handle project data, speakers, segments
3. **Enable TypeScript strict mode** - Surface typing errors early

### Phase 2 (Medium Priority)  
1. **TranscriptionContext** - Handle job lifecycle
2. **Extract custom hooks** - useAudio, useProject, useTranscription
3. **Component modularization** - Break up App.tsx

### Phase 3 (Lower Priority - Polish)
1. **UIContext** - Handle dialog states and navigation
2. **Virtualization** - Performance improvements
3. **Testing infrastructure** - Jest setup and tests

## Files That Will Be Created/Modified

### New Files:
- `src/renderer/contexts/AudioContext.tsx`
- `src/renderer/contexts/ProjectContext.tsx` 
- `src/renderer/contexts/TranscriptionContext.tsx`
- `src/renderer/hooks/useAudio.ts`
- `src/renderer/hooks/useProject.ts`
- `src/renderer/hooks/useTranscription.ts`
- `src/renderer/types/index.ts` (comprehensive type definitions)
- `src/renderer/views/HomeView.tsx`
- `src/renderer/views/TranscriptionProgressView.tsx`
- `src/renderer/views/SpeakerIdentificationView.tsx`
- `src/renderer/views/PlaybackView.tsx`

### Modified Files:
- `src/renderer/App.tsx` (major refactor - remove most state)
- `src/renderer/components/PlaybackMode/PlaybackModeContainer.tsx`
- `src/renderer/components/TranscriptEdit/TranscriptEditContainer.tsx`
- `src/renderer/components/shared/BottomAudioPlayer.tsx`
- `tsconfig.json` (enable strict mode)

This audit provides the foundation for systematic refactoring according to your improvement plan.