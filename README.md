# TranscriptionProject

A professional desktop transcription application built with Electron, React, and TypeScript. Features a modern interface with cloud transcription services, advanced audio synchronization, and professional editing tools.

## Overview

TranscriptionProject is a desktop application designed for content creators, journalists, and audio professionals who need accurate, editable transcripts. The app provides a streamlined workflow from audio import through cloud transcription to professional editing with real-time audio synchronization.

## Features

### Modern User Interface
- **macOS-Style Top Bar**: Professional title bar with native traffic lights and draggable window area
- **Collapsible Sidebar**: Toggle between full sidebar (256px) and icon-only mode (64px) with smooth animations
- **Icon-Based Mode Switching**: Listen (headphones) and Edit (pencil) buttons in the top bar with clear active states
- **macOS-Style Transparency**: Full window transparency with vibrancy effects - see desktop through app window
- **Glass Morphism Design**: Professional frosted glass sidebar, panels, and top bar with backdrop blur
- **Design Token System**: Complete CSS architecture with centralized color, transparency, and layout control
- **Dark Mode Support**: Adaptive transparency and glass effects optimized for macOS dark mode
- **Responsive Layout**: Tailwind CSS with clean, modern styling and transparency utilities
- **Professional Window Management**: Native macOS window controls with proper dragging behavior
- **Panel System**: Expandable glass sidebar panels for speakers, clips, fonts, and project management
- **Glass Progress Overlay**: Beautiful glass morphism progress indicator during transcription

### Cloud Transcription Services
- **OpenAI Whisper Integration**: High-quality transcription with word-level timestamps
- **AssemblyAI Support**: Fast transcription with speaker detection
- **Rev.ai Integration**: Professional-grade transcription service support
- **Real-time Progress**: Glass overlay with progress bars and status updates
- **API Key Management**: Secure, encrypted storage of API credentials accessible via Settings panel
- **Transcription Cancel**: Ability to cancel running transcription jobs
- **Comprehensive Debug Logging**: Detailed logging for troubleshooting transcription issues

### Advanced Audio System (Latest - 2025)
- **Unified Audio Manager**: Clean, reliable audio playback built on proven SimpleClipSequencer
- **Real-time Word Highlighting**: Smooth 50fps word highlighting without skipping
- **Mode-Specific Behavior**: Different interactions for Listen vs Edit modes
- **Professional Controls**: Bottom-mounted audio player with transport controls
- **Timeline Management**: Seamless handling of clip reordering and deletions
- **Drag-and-Drop Clip Reordering**: Advanced contiguous timeline system for intuitive audio editing
- **JUCE Backend Integration**: Native C++ audio backend with Edit Decision List (EDL) processing
- **Error Recovery**: Comprehensive error boundaries with automatic recovery
- **Memory Management**: Efficient state management with cleanup monitoring

### Transcript + Audio Integration (2025 Q4 updates)

- Single speaker dropdown portal
  - `ClipSpeakerPlugin` renders all dropdowns via a single persistent React portal into `#clip-speaker-layer` inside the editor wrapper.
  - Actions (change speaker, merge above/below, delete) apply to both the audio system and project store; a `clips-updated` event triggers a lightweight refresh.
  - Dropdown menu z-index is elevated so menus sit above transcript content.

- Listen vs Edit mode safety
  - onClipsChange is suppressed in Listen Mode (readOnly), so structural changes are never sent back to JUCE when clicking words.
  - Clip sync to JUCE is de‑duplicated (id/order/type/speaker/start/end/words length), preventing redundant UPDATE_CLIPS during playback.
  - Word/spacer clicks use a -10ms seek bias to avoid boundary “ended” blips.
  - Reordered playback correctness: when a later clip is moved to the top, clicks in the new first clip always start that clip — UI clamps seeks to the clicked clip’s start and the audio layer snaps within a small EPS at boundaries. If the JUCE backend reports only edited-time in `position` events, a fallback enables original-time seeks during reorders to keep playback and highlighting aligned.

- Spacer pills (UI-only) for audio-only gaps
  - New `SpacerNode` renders silent/music gaps as inline pills, keeping the UI aligned with the EDL without separate “gap clip” containers.
  - Pills are shown only for gaps ≥ 1.0s; sub‑1s are visually absorbed into neighboring text.
  - Trailing/intermediate gaps: pills attach after the preceding speech clip based on explicit audio‑only clips in edited array order.
  - Leading intro gap: exactly one pill attaches to the earliest-by-original‑time speech clip; it moves with that clip when dragged.
  - Pills are UI‑only; they do not modify audio EDL or exports. Pills are keyboard‑selectable (select + delete removes them).

- Merge + delete semantics (gap-aware)
  - Merge Above/Below: robust id‑based logic skips gaps and splices the inclusive range (prev/gaps/curr) into a single merged speech clip with a fresh id; renumbers orders afterwards.
  - Delete Clip: removes the speech clip, prunes orphan 0‑duration gaps, renumbers orders.

- JUCE stability
  - Before any `initialize`/`updateClips`, clips are normalized: finite start/end, speech clips with ≤0 duration are filtered, orders renumbered by array index. This prevents malformed EDLs from causing early segfaults.

Developer refs

- `src/renderer/editor/plugins/ClipSpeakerPlugin.tsx`: single portal + dropdown actions
- `src/renderer/editor/components/shared/SpeakerDropdown.tsx|.css`: dropdown UI
- `src/renderer/editor/utils/converters.ts`: spacer pills + transcript build
- `src/renderer/editor/nodes/SpacerNode.tsx`: pill rendering and click‑to‑seek
- `src/renderer/editor/LexicalTranscriptEditor.tsx`: Listen Mode suppression + node registration
- `src/renderer/components/AudioSystemIntegration.tsx`: JUCE normalization + de‑dup sync + -10ms bias

### Developer Cheatsheet

- Spacer pills (UI-only)
  - Threshold: gaps ≥ 1.0s become pills; tweak `SPACER_VISUAL_THRESHOLD` in `src/renderer/editor/utils/converters.ts`.
  - Placement:
    - Trailing/intermediate: attached after the preceding speech clip when an explicit `audio-only` clip appears in the edited array.
    - Leading intro: exactly one pill attached to the earliest-by-original-time speech clip and moves with that clip when dragged.
  - Node: `SpacerNode` (`src/renderer/editor/nodes/SpacerNode.tsx`) renders a pill and seeks on click (Listen Mode).
  - Deletion: pills are keyboard-selectable; select + delete removes. If you want one‑backspace deletion, add a Backspace boundary handler in `SpacerNode`.

- Speaker dropdown portal
  - Portal container: `#clip-speaker-layer` (rendered in `LexicalTranscriptEditor.tsx`).
  - Renderer + actions: `ClipSpeakerPlugin.tsx` (single persistent React root; items rendered/positioned at ~10 fps; 400ms grace for rebuilds).
  - z-index: menus are elevated in `SpeakerDropdown.css` (menu z-index 200000). Containers have smooth movement transitions.

- Listen vs Edit safety
  - onClipsChange suppressed when `readOnly` (Listen Mode) in `LexicalTranscriptEditor.tsx`.
  - Seek bias: -10ms in `AudioSystemIntegration.tsx` on `onWordClick` and spacer click (from `SpacerNode`).
  - If needed, add a short “ignore ended after manual seek” window in the JUCE/transport bridge to fully quash boundary blips.

- Sync to JUCE
  - De‑duplication: hash fields are `id/order/type/speaker/start/end/wordCount`. Update in `AudioSystemIntegration.tsx` if you add structural fields.
  - Normalization: before `initialize` and `updateClips` we clamp start/end, filter ≤0‑duration speech clips, and renumber `order` by array index (`normalizeClipsForAudio`).

- Merge/Delete (gap-aware)
  - Merge Above/Below: id‑based; skips over `audio-only` gaps; splices inclusive range and renumbers orders; merged clip gets a fresh id (see `ClipSpeakerPlugin.tsx`).
  - Delete: removes the speech clip, prunes orphan zero‑duration gaps, renumbers orders.

- Useful debug tips
  - Enable `VITE_AUDIO_DEBUG=true` to see de‑dup hash decisions and EDL sends.
  - Use Elements to confirm: `.lexical-clip-container` for speech containers, `.lexical-spacer-node` for pills, `#clip-speaker-layer` for the dropdown portal.
  - If playback starts‑then‑stops after edits, check for stray UPDATE_CLIPS right before a click; de‑dup + suppression should prevent this in Listen Mode.

### Professional Editing (Enhanced 2025)
- **Word-Level Editing**: Double-click individual words to correct transcription errors
- **Dynamic Clip System**: Visual boundaries for organizing transcript content
- **Drag-and-Drop Reordering**: Visually reorder clips by dragging, with audio playback following the new sequence
- **Speaker Management**: Assign and manage speaker names with automatic persistence; edit mode limits clip speaker changes to a dropdown of project-defined names
- **Context Menus**: Right-click for editing options (Edit Word, Delete Word, Split Clip Here)
- **Clip Operations**: Split, merge, reorder, and delete clips with undo support
- **Font Controls**: Customize transcript display with font panel
- **Listen/Edit Modes**: 
  - **Listen Mode**: Click words → immediate seek + play, deleted content hidden
  - **Edit Mode**: Click words → position cursor, deleted content visible with strikethrough

### Project Management (2025)
- **Project-First Workflow**: Create named projects before importing audio
- **Folder-Based Format**: A JSON `.transcript` file plus an adjacent `Audio Files/` directory (no ZIP)
- **WAV Pipeline**: Imported audio is converted to WAV (48 kHz, 16‑bit) and saved to `Audio Files/<ProjectName>.wav`
- **Streaming Playback**: Renderer streams directly from disk via `file://` (no large blobs held in memory)
- **Auto-save**: Automatic project saving with unsaved changes tracking
- **Recent Projects**: Quick access to recently opened projects

### Error Handling & Recovery
- **Audio Error Boundaries**: Automatic recovery from audio system failures
- **Timeline Validation**: Comprehensive validation and repair of timeline data
- **Graceful Degradation**: System continues working even with partial failures
- **Memory Monitoring**: Active memory usage tracking and cleanup
- **Debug Information**: Detailed error logs for troubleshooting

## Audio Editor (Isolated) + Media Server (New)

To provide a robust waveform editing experience while keeping the main UI stable, the audio editor now runs in an isolated window and uses a lightweight internal media server.

### Isolated Audio Editor
- **Separate Renderer**: Launched via “Open Audio Editor (isolated)” to contain failures
- **Minimal Transport**: Play/Pause + Zoom, with time/seek planned next
- **Waveform Rendering**: Uses Wavesurfer (MediaElement backend) with precomputed peaks

### Internal Media Server
- **Local HTTP Server**: `http://127.0.0.1:<port>` started on app launch
- **Endpoints**:
  - `GET /media?src=/absolute/path` – Streams audio with proper MIME + Range support
  - `GET /peaks?src=/absolute/path&samplesPerPixel=1024` – Computes mono min/max peaks via ffmpeg (s16le) and returns JSON
- **Peaks Caching**: Peaks are cached to `.waveforms/<filename>.peaks.<spp>.json` next to the audio for instant re-open
- **Renderer CSP**: Updated to allow `http:` for connect/media/img to fetch peaks/audio safely

### Stability Measures
- **Gated Pipelines**: Main AudioManager is disabled during conversion and when the editor is open
- **Resilient Init**: AudioManager uses `preload='auto'`, explicit `load()`, richer event logging, and one-shot retry on transient failures
- **Crash Reporting**: CrashReporter enabled; process-gone events logged
- **Structured Logs**: Vite/Electron logs are written under `./logs/`

## Import Flow (Simplified)

The import dialog has been simplified for stability during the beta phase:

- **WAV Only**: Imports convert to WAV (48 kHz, 16‑bit); future formats can be added later
- **Smart Choice Removed**: MP3/FLAC “smart recommendation” UI and logic were removed
- **Consistent Output**: Ensures a single, stable playback pipeline and consistent waveform generation

## Technology Stack

### Core Technologies
- **Electron 32+**: Cross-platform desktop framework
- **React 18**: Modern React with functional components and hooks
- **TypeScript**: Full type safety throughout the application
- **Vite**: Fast development server and build tool
- **Tailwind CSS**: Utility-first CSS framework for styling

### UI Components
- **Radix UI**: Accessible, unstyled components for complex interactions
- **Lucide React**: Consistent icon set throughout the interface
- **Custom Components**: Built on Radix primitives with Tailwind styling

### Audio System Architecture (2025)
- **AudioManager**: Unified audio management with SimpleClipSequencer
- **AudioAppState**: Centralized state management with validation
- **SimpleUndoManager**: Snapshot-based undo/redo system
- **TimelineValidator**: Comprehensive timeline validation and repair
- **AudioErrorBoundary**: Comprehensive error handling with recovery

### State Management
- **React Context**: Centralized state management
  - `ProjectContext`: Project data and metadata management
  - `NotificationContext`: Toast notifications and error handling
- **Unified Audio State**: Single source of truth for all audio operations

## Developer Docs

- Editing + Audio Integration Cheat Sheet: `docs/Editing-Text-Audio-Integration.md`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
├─────────────────────────────────────────────────────────────┤
│ Main Process (src/main/)                                    │
│ ├── main.ts                    # App entry & window mgmt    │
│ ├── preload.ts                 # Secure IPC bridge         │
│ └── services/                                               │
│     ├── SimpleCloudTranscriptionService.ts  # Cloud APIs  │
│     ├── ProjectFileService.ts               # File I/O     │
│     ├── ProjectPackageService.ts            # ZIP handling │
│     ├── AudioAnalyzer.ts                   # Audio analysis│
│     ├── AudioConverter.ts                  # FLAC conversion│
│     └── UserPreferences.ts                 # Settings mgmt │
├─────────────────────────────────────────────────────────────┤
│ Renderer Process (src/renderer/)                           │
│ ├── App.tsx                    # Main app component        │
│ ├── main.tsx                   # React app entry point     │
│ ├── contexts/                  # State management          │
│ │   ├── ProjectContext.tsx                                 │
│ │   ├── NotificationContext.tsx                           │
│ │   └── index.tsx              # Combined providers        │
│ ├── components/                                             │
│ │   ├── ui/                                                │
│ │   │   └── NewUIShell.tsx     # Main interface shell     │
│ │   ├── AudioSystemIntegration.tsx # Audio system bridge  │
│ │   ├── AudioErrorBoundary.tsx # Error recovery system    │
│ │   ├── shared/                # Reusable components       │
│ │   │   └── SpeakerDropdown.tsx # Speaker selection UI    │
│ │   ├── ImportDialog/          # Enhanced import system    │
│ │   ├── Settings/              # User preferences          │
│ │   ├── Notifications/         # Toast system              │
│ │   └── Legacy/                # Legacy components         │
│ │       └── components/        # Unused legacy components  │
│ ├── editor/                    # Lexical transcript editor  │
│ │   ├── LexicalTranscriptEditor.tsx # Main editor component│
│ │   ├── nodes/                 # Lexical custom nodes      │
│ │   │   ├── SpacerNode.tsx    # UI-only gap pills          │
│ │   │   └── SpeakerNode.tsx   # Speaker labels with dropdown│
│ │   └── plugins/               # Lexical editor plugins    │
│ ├── hooks/                     # Custom React hooks        │
│ │   └── useAudioEditor.ts     # Unified audio hook        │
│ ├── audio/                     # Audio system core         │
│ │   ├── AudioManager.ts       # Unified audio management   │
│ │   ├── AudioAppState.ts      # Centralized state         │
│ │   ├── SimpleClipSequencer.ts # Timeline management      │
│ │   ├── SimpleUndoManager.ts  # Snapshot-based undo       │
│ │   └── TimelineValidator.ts  # Validation & repair       │
│ ├── services/                  # Business logic            │
│ └── types/                     # TypeScript definitions    │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Active Components
- **LexicalTranscriptEditor**: The main transcript component that renders speaker labels, word highlighting, and editing functionality
- **SpeakerNode**: Lexical editor node that renders speaker names with dropdown functionality in Edit mode
- **SpeakerDropdown**: Styled dropdown component for speaker selection and clip operations (merge, delete)
  - Dropdowns render via a body-level overlay to avoid Lexical rebuilds removing them. If dropdown visibility ever flickers during rapid updates, check `ClipSpeakerPlugin` throttling and the `clips-updated` event hooks in `useClipEditor`.
- **AudioSystemIntegration**: Bridges the audio system with the Lexical editor

### Legacy Components
Components in `src/renderer/Legacy/components/` are **not active** and preserved for reference only:
- `SimpleTranscript.tsx`: Previous transcript component (replaced by LexicalTranscriptEditor)
- `SimpleAudioControls.tsx`: Previous audio controls (replaced by integrated controls)

**Note**: Always modify **LexicalTranscriptEditor** and related components, not the Legacy versions.

## Audio System Architecture (2025 Redesign)

The audio system is built around **3 core principles**: **Unified Control**, **Clean State Management**, and **Simple Integration**.

### Audio Architecture Stack (Bottom to Top)

#### **1. AudioManager.ts** - The Engine
```typescript
class AudioManager {
  private audioElement: HTMLAudioElement;
  private sequencer: SimpleClipSequencer;
  private state: AudioAppState;
}
```

**What it does:**
- **Single HTML Audio Element**: One `<audio>` element controls all playback
- **Clip Sequencing**: Uses `SimpleClipSequencer` to map between original audio time and "edited timeline" (after reordering/deleting clips)
- **50fps Word Highlighting**: Updates every 20ms to highlight current word smoothly
- **State Management**: Maintains centralized state via `AudioAppState`

**Key Features:**
- **Timeline Conversion**: `originalTimeToEditedTime()` and `editedTimeToOriginalTime()`
- **Smart Error Handling**: Ignores errors when no audio source is set
- **Lazy Initialization**: Only creates audio resources when actually needed

#### **2. useAudioEditor.ts** - The React Interface
```typescript
const [audioState, audioActions] = useAudioEditor({
  onError: (error) => console.error(error),
  onWordHighlight: (wordId) => scrollToWord(wordId)
});
```

**What it does:**
- **React Hook**: Provides clean React interface to AudioManager
- **Stable Callbacks**: Prevents infinite re-renders with stable callback refs
- **State Conversion**: Converts internal AudioAppState to React-friendly format

**Actions Available:**
- `play()`, `pause()`, `togglePlayPause()`
- `seekToTime()`, `seekToWord(clipId, wordIndex)`
- `setVolume()`, `setPlaybackRate()`
- `updateClips()`, `deleteWords()`, `reorderClips()`

#### **3. AudioSystemIntegration.tsx** - The Bridge
```jsx
<AudioSystemIntegration
  mode="listen" // or "edit"
  fontSettings={fontSettings}
  audioUrl={audioFilePath}
/>
```

**What it does:**
- **Project Integration**: Bridges audio system with project data/contexts
- **Mode Switching**: Handles Listen vs Edit mode behaviors
- **Component Orchestration**: Manages LexicalTranscriptEditor + AudioErrorBoundary

#### **4. LexicalTranscriptEditor.tsx** - The UI

**Listen Mode:**
- Click word → Seek + Play immediately
- Deleted content hidden
- Clean reading experience

**Edit Mode:**
- Click word → Position cursor
- Deleted content visible with strikethrough
- Full editing capabilities

### Data Flow

User clicks word → LexicalTranscriptEditor → AudioSystemIntegration → useAudioEditor → AudioManager → HTML Audio Element → Word highlighting updates → LexicalTranscriptEditor re-renders

### Why This Architecture Works

1. **Single Source of Truth**: AudioManager owns all audio state
2. **No Conflicts**: Only one system controls audio (vs. previous dual system)
3. **React-Friendly**: Clean hooks interface with stable callbacks
4. **Mode-Aware**: Automatically handles Listen vs Edit behaviors
5. **Error Recovery**: Comprehensive error boundaries and recovery

### Mode-Specific Behavior

#### Listen Mode
- **Word Click**: Immediate seek + play audio at that timestamp
- **Word Highlighting**: Real-time highlighting during playback (50fps)
- **Deleted Content**: Hidden from view (clean listening experience)
- **Audio Playback**: Plays edited timeline (reordered/filtered clips)

#### Edit Mode
- **Word Click**: Position cursor, seek if audio stopped
- **Word Double-Click**: Inline text editing with persistent saving
- **Deleted Content**: Visible with strikethrough styling
- **Context Menu**: Right-click for Edit/Delete/Split operations
- **Audio Playback**: Same edited timeline as Listen mode

### Timeline Management

#### SimpleClipSequencer Enhancement
- **Reliable Timeline Mapping**: Convert between original and edited time
- **Clip Reordering**: Handle clip sequence changes efficiently
- **Deletion Handling**: Manage deleted clips and words seamlessly
- **Performance**: Optimized for large transcript files

#### Data Flow
```
Audio File Load → Initialize AudioManager → Setup SimpleClipSequencer →
User Interaction → Update AudioAppState → Sync UI → Persist Changes
```

### Error Recovery System

#### AudioErrorBoundary Component
- **Automatic Recovery**: Detects audio failures and attempts fixes
- **User Feedback**: Clear error messages with recovery options
- **Graceful Degradation**: App continues working in visual-only mode
- **Memory Cleanup**: Prevents memory leaks during recovery

#### Validation & Repair
- **Timeline Validation**: Ensures timeline data integrity
- **Clip Validation**: Validates word timestamps and clip boundaries
- **Automatic Repair**: Fixes common data inconsistencies
- **Error Logging**: Comprehensive debugging information

## Data Flow

1. **Project Creation**: User creates new project → Project context initialized → Save location selected
2. **Audio Import**: Enhanced import dialog analyzes file → Smart recommendations → User preferences applied
3. **Audio Processing**: File converted to FLAC if needed → Embedded in project ZIP → Metadata stored
4. **Transcription**: Selected method (Local/Cloud) → Progress updates via IPC → Glass overlay shows status
5. **Audio System Init**: AudioManager initializes → SimpleClipSequencer setup → Timeline validation
6. **Results**: Completed transcript → Clips generated → Audio system ready → UI rendering
7. **Editing**: User interactions → AudioAppState updates → Timeline sync → Persistent storage
8. **Professional Workflow**: Embedded FLAC audio → Portable projects → Professional mixing support

## Core Systems

### Clip Lifecycle and State Management

Understanding how clips evolve through the application lifecycle:

#### Clip Types and Evolution

1. **'initial'**: Created when audio is first imported, before transcription
   - Contains basic metadata and duration
   - No word-level data yet
   - Represents entire audio file as single clip

2. **'transcribed'**: Generated after successful transcription
   - Contains full word-level timestamps
   - Speaker assignments
   - Segmented based on speaker changes

3. **'speaker-change'**: Standard clips based on speaker boundaries
   - Most common type in final project
   - Generated from transcription segments

4. **'paragraph-break'**: Clips split at natural paragraph breaks
   - Preserves speaker continuity
   - Improves readability

5. **'user-created'**: Clips manually created/split by user
   - Result of editing operations
   - Custom clip boundaries

#### State Flow

Audio Import → 'initial' clip created → Transcription → 'initial' replaced with 'transcribed' clips → User editing → Mix of 'transcribed', 'speaker-change', 'user-created' clips

#### Audio System Integration

- AudioManager processes all clip types uniformly
- SimpleClipSequencer handles timeline calculations
- Mode switching affects clip visibility and interaction
- Real-time state synchronization via AudioAppState

This clip-centric approach ensures data consistency and enables sophisticated editing operations while maintaining audio playback synchronization.

### Enhanced Import System 
```
Audio File → AudioAnalyzer → Smart Recommendations → User Choice → 
AudioConverter → FLAC Embedding → Project ZIP → Auto-Save
```

Key Components:
- **AudioAnalyzer.ts**: Uses ffprobe to detect format, quality, sample rate, and provide recommendations
- **AudioConverter.ts**: Professional FLAC conversion with progress tracking and high-quality resampling
- **EnhancedImportDialog.tsx**: Smart UI that shows/hides options based on audio analysis
- **UserPreferencesService.ts**: Encrypted storage of user defaults for consistent workflow

### Transcription Pipeline
```
Enhanced Import → Audio Embedding → Transcription Method Selection → 
Cloud/Local Processing → Progress Tracking → Auto-Save → 
Clips Generation → Audio System Integration
```

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm package manager
- (Optional) API keys for OpenAI or AssemblyAI
- (Optional) JUCE Framework for advanced audio features like drag-and-drop clip reordering

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd TranscriptionProject

# Install dependencies
npm install

# Start development servers
npm run start-dev
```

### Development

```bash
# Start Vite dev server (port 3000)
npm run dev:vite

# Start Electron app (separate terminal)
npm run dev:electron

# Build for production
npm run build

# Build JUCE backend (optional - for advanced audio features)
cd native/juce-backend
cmake -DUSE_JUCE=ON -DJUCE_DIR=/path/to/JUCE ..
make
```

### Configuration

1. **API Keys**: Configure in the app's settings panel
   - Navigate to **Settings > API Keys** in the left sidebar
   - Enter API keys for OpenAI, AssemblyAI, or Rev.ai
   - Keys are AES-256 encrypted and stored locally
   - Test your setup by starting a cloud transcription

2. **Development**: Create `.env` file for development API keys
   ```
   OPENAI_API_KEY=your_openai_key_here
   ASSEMBLYAI_API_KEY=your_assemblyai_key_here
   ```

### Quick Start Guide

1. **Launch the app**: Run `npm run start-dev` or use the provided launch script
2. **Create a new project**: Click "New" in the sidebar, name your project, and choose save location
3. **Configure API keys** (for cloud transcription): Go to Settings > API Keys and add your OpenAI credentials
4. **Set preferences** (optional): Visit Settings > Import to configure default transcription and audio preferences
5. **Import audio**: Click import button and select your audio file
6. **Choose transcription method**: Select "Cloud Processing" (recommended) or "Local Processing" 
7. **Smart import**: The enhanced import dialog analyzes your audio and provides intelligent recommendations
8. **Watch progress**: Beautiful glass overlay shows real-time transcription progress with provider info
9. **Auto-save**: Project automatically saves to your chosen location when transcription completes
10. **Edit transcript**: Use professional editing tools - double-click words to correct, split clips with Enter, manage speakers
11. **Professional workflow**: Projects include embedded FLAC audio for portability and professional use

## File Structure

### Project Files (.transcript)
ZIP archives containing:
- `project.json`: Project metadata, settings, and embedded audio information
- `transcription.json`: Complete transcript with word timestamps
- `metadata/speakers.json`: Speaker names and mappings  
- `metadata/clips.json`: Audio clip definitions and boundaries
- `metadata/audio.json`: Original audio file information and conversion details
- `audio/`: Embedded audio files and metadata
  - `audio.flac` (or `audio.mp3`, `audio.wav`, etc.): The actual embedded audio file
  - `audio_reference.json`: Fallback reference for external audio files (when embedding fails)

### Configuration
- API keys: `~/.config/TranscriptionProject/api-keys.enc` (AES-256 encrypted)
- User preferences: `~/.config/TranscriptionProject/import-preferences.enc` (encrypted import defaults)
- Recent projects: Managed by Electron's userData directory

## Development Guidelines

### Code Organization
- **Components**: Functional React components with TypeScript
- **Hooks**: Custom hooks for reusable logic (`useAudioEditor`, `useClipEditor`)
- **Contexts**: Centralized state management (Project, Notification)
- **Services**: Business logic and external API integration
- **Types**: Comprehensive TypeScript definitions

### Audio System Development
- **AudioManager**: Central point for all audio operations
- **State Updates**: Always go through AudioAppState dispatch system
- **Error Handling**: Use AudioErrorBoundary for component protection
- **Testing**: Validate with TimelineValidator before state changes
- **Memory**: Clean up resources in component unmount

### Styling
- **Tailwind CSS**: Utility-first styling approach
- **Design Tokens**: Consistent colors and spacing via CSS variables
- **Responsive Design**: Mobile-friendly layouts where applicable
- **Dark Theme**: Professional dark green color scheme

## Recent Updates (September 2025 - Latest)

### ✅ Drag-and-Drop Clip Reordering with Contiguous Timeline (September 2025 - Latest)

**Revolutionary Audio Editing**: Complete implementation of drag-and-drop clip reordering with seamless audio playback following the reordered sequence.

#### **🎯 Key Achievement**
- **Intuitive Drag-and-Drop**: Users can visually reorder clips by dragging in the transcript editor
- **Seamless Audio Playback**: Audio automatically plays in the reordered sequence, not original file order  
- **Contiguous Timeline System**: Advanced dual-timeline architecture handles complex timestamp mapping
- **Real-time Synchronization**: UI and audio playback stay perfectly synchronized during reordering

#### **🔧 Technical Implementation**

**Contiguous Timeline Architecture**:
The system maintains two timeline representations:
1. **Contiguous Timeline**: Sequential UI positioning (0-10s, 10-20s, 20-30s)
2. **Original Timeline**: Actual audio file positions (15-25s, 0-10s, 25-35s)

**TypeScript Layer** (`JuceAudioManager.ts`):
- **Automatic Detection**: Identifies reordered clips by temporal discontinuities
- **Timeline Calculation**: Generates contiguous timeline from reordered clips
- **Dual Timestamp EDL**: Sends both contiguous and original timestamps to JUCE backend

**C++ JUCE Backend** (`main.cpp`):
- **Segment Jump Logic**: Plays from original audio positions in reordered sequence
- **Boundary Detection**: Seamlessly jumps between segments at 50ms boundaries
- **Position Mapping**: Converts between contiguous UI time and original audio positions

#### **🎵 How It Works**

**Example Reordering**:
```
Original Audio:  [Intro: 0-5s] [Speech A: 5-15s] [Speech B: 15-25s] [Outro: 25-30s]
User Drags:      Speech B to position 2
Result Playback: [Intro: 0-5s] [Speech B: 15-25s] [Speech A: 5-15s] [Outro: 25-30s]
```

**Audio Playback Flow**:
1. User drags clip B to position 2
2. TypeScript generates contiguous timeline: Speech B now at 5-15s (contiguous)
3. EDL includes both timelines: `{startSec: 5, endSec: 15, originalStartSec: 15, originalEndSec: 25}`
4. JUCE backend plays from 15-25s in original audio but displays as 5-15s in UI
5. At boundary, jumps to next reordered segment automatically

#### **🚀 User Experience Benefits**
- **Visual Editing**: Drag clips visually like video editing software
- **Immediate Feedback**: Reordered sequence plays back instantly
- **Seamless Transitions**: No gaps or stuttering between reordered segments
- **Professional Workflow**: Foundation for future full audio editing window

#### **🏗️ Architecture Foundation**
This implementation provides the foundation for professional audio editing:
- **Non-destructive Editing**: Original audio file unchanged
- **Scalable Architecture**: Ready for complex multi-track editing
- **Industry Standards**: Uses Edit Decision List (EDL) approach from professional video/audio editing

**Documentation**: Complete technical documentation available at `native/juce-backend/README.md`

### ✅ JUCE Backend Highlighting Debugging & Fixes (September 2025 - Latest)

**Focused JUCE Fix**: Removed hybrid polling confusion and implemented comprehensive JUCE backend debugging to identify and fix word highlighting issues with reordered clips.

#### **🎯 Problem Identified**
The word highlighting issues were caused by:
- **Hybrid polling interference**: Added complexity that masked the real JUCE backend problems  
- **Incorrect position mapping**: `getPositionAtOriginalTime` had flawed logic for reordered clips
- **Insufficient debugging**: Hard to diagnose dual timeline mapping issues

#### **🔧 Solutions Implemented**

**1. Removed Hybrid Polling System**:
- Eliminated confusing fallback polling mechanism
- Focused debugging on pure JUCE backend events
- Cleaner, more predictable behavior

**2. Fixed Position Mapping Logic**:
```typescript
// OLD: Incorrect relative time calculation
const relativeTime = originalTime - clip.startTime;
for (const w of clip.words) {
  if (relativeTime >= (w.start - clip.startTime) && ...) // Wrong!
}

// NEW: Direct word timestamp matching  
const wordIndex = clip.words.findIndex(w => 
  originalTime >= w.start && originalTime < w.end  // Correct!
);
```

**3. Comprehensive JUCE Debugging**:
- **EDL Dual Timeline**: Shows original → contiguous mapping for reordered clips
- **Position Lookup**: Detailed logging of word finding process
- **Event Tracking**: Clear JUCE position event flow

#### **🔍 Debug Output Guide**

With `VITE_AUDIO_DEBUG=true`, look for these key debug patterns:

**For Reordered Clips**:
```
[EDL] ⚡ REORDERED CLIPS DETECTED - Using dual timeline mapping
  Original clip order: 0:abc123(0.0-3.3s) 1:def456(3.3-7.8s) 2:ghi789(7.8-9.2s)
  Reordered indices: [0, 2, 1]
  Contiguous timeline mapping:
    [0] abc123: Original(0.00-3.32s) → Contiguous(0.00-3.32s) [25 words]
    [1] ghi789: Original(7.83-9.19s) → Contiguous(3.32-4.68s) [12 words]  
    [2] def456: Original(3.32-7.83s) → Contiguous(4.68-9.19s) [38 words]
```

**For Word Highlighting**:
```
[JuceAudio] Position update: { editedTime: 5.432, originalSec: 6.123, isPlaying: true }
[getPositionAtOriginalTime] Found word: {
  originalTime: 6.123,
  clipId: "def456",
  wordText: "example",
  wordStart: 6.100,
  wordEnd: 6.200,
  localWordIndex: 15
}
[JUCE DEBUG] Word highlight: { mappedClipId: "def456", localWordIndex: 15, wordId: "clip-def456-word-15" }
```

**For Troubleshooting**:
```
[getPositionAtOriginalTime] No clip found for originalTime: 5.5 {
  availableClips: [
    { id: "abc123", start: 0, end: 3.32 },
    { id: "def456", start: 3.32, end: 7.83 }
  ]
}
```

#### **🚀 Expected Results**
- **Accurate highlighting**: Words highlight exactly when spoken in reordered clips
- **Clear debugging**: Easy to identify mapping issues
- **Preserved editing**: All drag-and-drop functionality intact
- **Predictable behavior**: No interference from fallback systems

### ✅ Word Highlighting Restoration with Hybrid System (September 2025 - Previous)

**Highlighting Recovery**: Complete restoration of smooth 50fps word highlighting while preserving all JUCE backend editing functionality.

#### **🎯 Problem Solved**
After implementing JUCE backend for drag-and-drop editing, word highlighting became broken due to:
- **Event-driven vs Polling**: System switched from reliable 50fps polling to JUCE backend events
- **Inconsistent Event Delivery**: JUCE events not firing consistently during playback
- **Missing Fallback**: No backup highlighting mechanism when events failed

#### **🔧 Hybrid Solution Implemented**

**Smart Highlighting System**:
1. **Primary**: JUCE backend events (optimal performance)
2. **Fallback**: 50fps polling when events are insufficient
3. **Automatic Detection**: Monitors JUCE event frequency and switches modes

**Key Features**:
- **Event Monitoring**: Tracks JUCE position events and timing
- **Intelligent Fallback**: Activates 50fps polling when events stale >100ms
- **Seamless Switching**: Transparent mode switching without user interruption
- **Enhanced Debugging**: Comprehensive logging for troubleshooting

#### **🎵 Technical Implementation**

**Hybrid Highlighting Manager** (`JuceAudioManager.ts`):
```typescript
// Monitor JUCE events and activate fallback polling as needed
private startHybridHighlighting(): void {
  this.highlightingInterval = setInterval(() => {
    const timeSinceLastJuceEvent = Date.now() - this.lastJuceEventTime;
    
    // If JUCE events working (< 100ms old), don't poll
    if (timeSinceLastJuceEvent < 100) return;
    
    // JUCE events stale - use fallback polling
    this.queryJuceStateForHighlighting();
  }, 20); // 50fps for smooth highlighting
}
```

**Event Tracking**:
- `lastJuceEventTime`: Timestamp of last JUCE position event
- `juceEventCount`: Total events received for debugging
- `highlightingInterval`: Fallback polling timer

**Debug Output**:
```
[JuceAudio] Event received: position { eventCount: 45, timeSinceLastEvent: 18 }
[JuceAudio] Word highlight: { highlightingMode: 'event-only', wordId: 'clip-1-word-12' }
[JuceAudio] Fallback polling activated - JUCE events stale by 150ms
[JuceAudio] Hybrid highlighting system started
```

#### **🚀 User Benefits**
- **Restored 50fps Highlighting**: Smooth word highlighting is back
- **Preserved Editing**: All drag-and-drop editing functionality intact
- **Automatic Recovery**: System adapts to JUCE backend issues transparently
- **Better Debugging**: Comprehensive logging for troubleshooting

#### **🔧 Editing Compatibility**
**No Impact on Editing Features**:
- ✅ Drag-and-drop clip reordering still works
- ✅ Contiguous timeline system preserved
- ✅ JUCE backend EDL processing intact
- ✅ All advanced audio editing features functional

**Smart Integration**:
- Highlighting system starts/stops with playback
- Event monitoring continues throughout editing
- Debug mode shows both highlighting and editing status
- Memory cleanup prevents resource leaks

### ✅ JUCE Audio Backend Integration & Critical Bug Fixes

**Major System Integration**: Complete JUCE C++ audio backend integration with comprehensive bug fixes for seamless transcription editing experience.

#### **🎯 Key Achievements**
- **JUCE Audio Backend**: Native C++ audio processing via line-delimited JSON IPC over stdio
- **Seamless Playback**: Continuous audio playback across all clip boundaries including intro music, speech gaps, and outro sections
- **Real-time Word Highlighting**: Precise word-level highlighting synchronized with spoken audio during playback
- **Gap Clip Generation**: Intelligent audio-only clips for non-speech regions ensuring complete timeline coverage
- **Timeline Management**: Robust EDL (Edit Decision List) handling with proper time domain conversions
- **Error Recovery**: Comprehensive crash fixes and graceful error handling

#### **🔧 Critical Bug Fixes**

**1. Application Crash Fix**
- **Issue**: `ReferenceError: currentTime is not defined` in AudioSyncPlugin after incomplete JUCE migration
- **Solution**: Fixed all undefined variable references in AudioSyncPlugin.tsx:34-171
- **Impact**: Application now launches without crashes and audio system initializes properly

**2. Continuous Playback Implementation**
- **Issue**: Audio playback stopped at the end of each clip instead of continuing seamlessly
- **Root Cause**: Gap clips (intro, between speech, outro) were being filtered out, creating discontinuous EDL
- **Solution**: Enhanced gap generation in AudioAppState.ts:114-191 and preserved audio-only clips in filtering logic
- **Result**: Perfect continuous playback through entire audio file including music and pauses

**3. Word Highlighting Synchronization**
- **Issue**: Word highlights completely missing during audio playback
- **Root Cause**: React prop flow broken - timeline time not passed through component hierarchy
- **Solution**: Fixed missing parameter in LexicalTranscriptEditor function destructuring (line 264) and component prop passing (line 316)
- **Result**: Real-time word highlighting now works perfectly, synchronized with spoken audio

#### **🏗️ Technical Implementation**

**JUCE Backend Integration**:
```typescript
// Native C++ audio backend communication
const juceProcess = spawn(juceBinaryPath, args);
juceProcess.stdout.on('data', (data) => {
  // Line-delimited JSON protocol
  const messages = data.toString().split('\n').filter(Boolean);
  messages.forEach(processJUCEMessage);
});
```

**Gap Clip Generation**:
```typescript
// Intelligent gap detection for continuous playback
export const generateGapClips = (speechClips: Clip[], audioDuration: number): Clip[] => {
  const gaps: Clip[] = [];
  const eps = 0.0005; // Precision epsilon
  
  // Create intro, inter-speech, and outro gaps
  for (const speechClip of sorted) {
    if (speechClip.startTime - cursor > eps) {
      gaps.push({
        type: 'audio-only',
        startTime: cursor,
        endTime: speechClip.startTime,
        // ... gap clip properties
      });
    }
  }
};
```

**Word Highlighting Fix**:
```typescript
// Proper prop flow through React component hierarchy
<LexicalTranscriptEditorContent
  currentTime={currentTime}  // CRITICAL: This was missing
  // ... other props
/>

<AudioSyncPlugin
  currentTime={currentTime}  // Now receives valid time values
  isPlaying={isPlaying}
  onSeekAudio={onWordClick}
/>
```

#### **🎵 Audio Highlighting System**

**How It Works**:
1. **Time Domain Separation**: Original audio time (JUCE backend) vs edited timeline (UI display)
2. **Word-Level Timestamps**: Each WordNode contains precise start/end times from transcription
3. **50fps Updates**: AudioSyncPlugin updates word highlighting every 20ms for smooth visual feedback
4. **Boundary Detection**: Smart detection of first/last words to avoid highlighting during intro/outro music
5. **Debug Logging**: Comprehensive logging system for troubleshooting timing issues

**Visual Feedback**:
- **Active Word**: Highlighted with distinct background color during playback
- **Smooth Transitions**: No skipped words or visual glitches
- **Speaker Awareness**: Highlighting respects speaker boundaries and clip organization
- **Mode Sensitivity**: Different behavior for Listen vs Edit modes

#### **🔄 Timeline Management**

**Edit Decision List (EDL)**:
- **Continuous Coverage**: Gap clips ensure no audio regions are skipped during playback
- **Proper Ordering**: Sequential clip ordering maintained through reordering operations
- **Time Conversion**: Robust mapping between original audio time and edited timeline positions
- **Deletion Handling**: Deleted clips filtered appropriately while preserving gaps

**State Synchronization**:
- **AudioAppState**: Centralized state management for all audio operations
- **React Context**: Proper state flow through component hierarchy
- **Memory Efficiency**: Cleanup of unused audio resources and state objects

#### **🛠️ Developer Experience**

**Debug Environment**:
```bash
# Enable comprehensive audio debugging
VITE_AUDIO_DEBUG=true npm run start-dev

# Console output shows:
# - Time synchronization details
# - Word highlighting events  
# - Gap generation statistics
# - Prop flow validation
# - JUCE backend communication
# - EDL dual timeline mapping for reordered clips
# - Word-to-time mapping debugging
# - Position lookup failures and successes
```

**Error Recovery**:
- **Graceful Degradation**: Audio system continues working even with partial failures
- **Automatic Retry**: Transient failures trigger automatic recovery attempts
- **User Feedback**: Clear error messages with actionable recovery options
- **Memory Cleanup**: Proper resource cleanup during error recovery

### ✅ macOS-Style Top Bar Implementation (August 2025)

**Professional macOS Integration**: Complete top bar implementation following Day One app design patterns for native macOS experience.

#### **🎯 Key Features**
- **Native Traffic Lights**: Proper macOS window controls using `titleBarStyle: 'hiddenInset'`
- **Full Window Dragging**: Entire top bar is draggable except interactive buttons
- **Collapsible Sidebar**: Toggle between 256px (full) and 64px (icons-only) with smooth 300ms transitions
- **Icon-Based Mode Switching**: Professional headphones (Listen) and pencil (Edit) icons with active states
- **Glass Vibrancy**: Top bar matches sidebar transparency and backdrop blur effects
- **Project Information Display**: Right-aligned project name and status

#### **🎨 Professional Spacing & Layout** 
Following Day One's exact measurements:
- **Height**: 44px top bar (matches Day One exactly)
- **Traffic Lights Space**: 78px reserved for macOS controls
- **Button Spacing**: 16px between groups, 4px within groups
- **Icon Size**: 20×20px icons with 24×24px touch targets
- **Layout**: `[Traffic Lights] [Sidebar Toggle] | [Listen] [Edit] | ... | [Project Info]`

#### **🔧 Technical Implementation**

**New Components**:
- **TopBar.tsx**: Complete top bar with all functionality
- **Enhanced CSS Variables**: `--topbar-height`, `--sidebar-width-collapsed`
- **Glass Effects**: `.vibrancy-topbar` with consistent transparency
- **Button Styling**: Complete hover states and active indicators

**Updated Components**:
- **NewUIShell.tsx**: Integrated top bar and sidebar collapse state management
- **EnhancedSidebar.tsx**: Supports collapsed mode with tooltips and smooth animations
- **design-tokens.css**: New variables for layout and transparency control

#### **🎭 User Experience**
- **Sidebar Toggle**: Click arrow icon to collapse/expand, icon rotates to indicate state
- **Mode Switching**: Click headphones for Listen mode, pencil for Edit mode
- **Visual Feedback**: Active mode shows purple accent background
- **Tooltips**: Collapsed sidebar shows tooltips on hover for all buttons
- **Smooth Animations**: All state changes animated with CSS transitions

#### **🎨 Design System Integration**
- **CSS Variables**: Full control via design-tokens.css
- **Hot Reload**: Live updates during development
- **Transparency**: Consistent with existing glass morphism design
- **Color Theming**: Uses accent color for active states

## Recent Updates (August 2025 - Previous)

### ✅ Complete Audio System Redesign

**Problem Solved**: The previous audio system had multiple competing implementations causing:
- Inconsistent word highlighting (words frequently skipped)
- State synchronization issues between 6+ different managers
- Memory leaks and performance problems
- Timeline calculation errors
- Over-engineered architecture that was difficult to debug

**New Architecture**: Clean, unified audio system built on proven components:

#### **Core Components**
- **AudioManager.ts**: Single audio manager replacing 5 competing systems
- **AudioAppState.ts**: Centralized state eliminating fragmentation
- **useAudioEditor.ts**: Simple React hook replacing complex integrations
- **LexicalTranscriptEditor.tsx**: Professional transcript UI with Lexical editor
- **AudioErrorBoundary.tsx**: Comprehensive error recovery system

#### **Key Improvements**
- **Smooth Word Highlighting**: 50fps updates, no more skipped words
- **Reliable Timeline**: Based on proven SimpleClipSequencer
- **Mode-Specific Behavior**: Proper Listen vs Edit mode implementation
- **Error Recovery**: Automatic recovery from audio failures
- **Memory Efficiency**: Active cleanup and monitoring
- **60% Code Reduction**: Eliminated over-engineering

#### **User Experience**
- **Listen Mode**: Click word → immediate seek + play, deleted content hidden
- **Edit Mode**: Click word → position cursor, double-click → edit, deleted content visible
- **Reliable Playback**: Edited timeline plays correctly (reordered/deleted clips)
- **Professional Controls**: Clean audio controls with proper state sync

### ✅ Technical Implementation

#### **Error Handling & Recovery**
```typescript
// Comprehensive error boundaries
<AudioErrorBoundary onRecoveryAttempt={handleRecovery}>
  <LexicalTranscriptEditor audioState={state} audioActions={actions} />
</AudioErrorBoundary>

// Automatic recovery mechanisms
- Audio system reset on failures
- Timeline validation and repair
- Memory cleanup during recovery
- Graceful degradation to visual-only mode
```

#### **Timeline Validation**
```typescript
// Comprehensive validation system
TimelineValidator.validateClips(clips) →
TimelineValidator.repairTimeline(clips) →
AudioManager.updateClips(repairedClips)

// Validates: clip boundaries, word timestamps, speaker assignments
// Repairs: missing data, invalid ranges, corrupted state
```

#### **Memory Management**
```typescript
// Active memory monitoring
SimpleUndoManager.getStats() // Memory usage tracking
AudioManager.destroy()       // Resource cleanup
TimelineValidator.cleanup()  // Cache clearing
```

### ✅ Architecture Benefits

- **🚀 Performance**: 50fps word highlighting vs previous 20fps with skips
- **🛡️ Reliability**: Comprehensive error recovery vs frequent crashes
- **🧹 Simplicity**: Single audio manager vs 5+ competing systems
- **💾 Memory**: Active cleanup vs memory leaks
- **🐛 Debugging**: Clear state flow vs scattered state management
- **🔧 Maintenance**: Clean architecture vs over-engineered complexity

### ✅ Backward Compatibility
- All existing project files work without modification
- Seamless integration with existing panel system
- Speaker management and project workflows preserved
- Import/export functionality unchanged

## Transparency & Visual Testing (August 2025)

### ✅ macOS Window Transparency System

**Full Window Transparency**: Professional macOS-style transparency with vibrancy effects that show the desktop and applications through the app window.

#### **Design Token Architecture**
- **Single Source of Truth**: All transparency controlled via `design-tokens.css`
- **Composable Glass Effects**: HSL color composition with separate opacity controls
- **Dark Mode Adaptive**: Automatic transparency adjustments for macOS dark mode
- **Live Hot Reload**: Change transparency values and see results instantly

#### **Key Variables** (in `design-tokens.css`)
```css
/* App-wide transparency control */
--app-bg-opacity: 0.3;        /* 0=fully transparent, 1=opaque */
--opacity-glass-medium: 0.2;  /* Sidebar glass opacity */  
--opacity-glass-light: 0.1;   /* Panel glass opacity */
--backdrop-blur: blur(100px); /* Frosted glass blur effect */
```

#### **Utility Classes**
```css
.app-transparent  /* Fully transparent mode */
.app-opaque      /* Standard opaque mode */
.vibrancy-sidebar /* Glass sidebar effects */
.vibrancy-panel  /* Glass panel effects */
```

### ✅ DevTools vs Transparency Discovery

**Important Finding**: DevTools interfere with Electron window transparency. Use the provided scripts for proper testing:

- **With DevTools**: `./start-with-devtools.sh` - Debugging enabled, transparency disabled
- **Without DevTools**: `./start-without-devtools.sh` - Full transparency enabled, no debugging

### ✅ Automated Visual Testing System

**Playwright Visual Regression Tests**: Comprehensive screenshot testing for transparency effects.

#### **Test Suites**
- **`basic.spec.ts`**: Verifies app launches successfully 
- **`main-app-transparency.spec.ts`**: Tests actual app window with various transparency settings
- **`replicable-transparency.spec.ts`**: Creates screenshots with exact design-tokens.css values

#### **Running Visual Tests**
```bash
# Run all transparency tests
npx playwright test tests/visual/ --update-snapshots

# Run specific test suite  
npx playwright test tests/visual/replicable-transparency.spec.ts

# View test results
npx playwright show-report
```

#### **Test Results**
Each test captures screenshots showing:
- Current transparency settings
- Fully transparent mode (0% opacity)
- Semi-transparent mode (30% opacity) 
- Opaque mode (100% opacity)
- Different vibrancy effects
- Color theme variations
- **Exact replication values** for design-tokens.css

#### **Replicable Design Tokens**
Every test screenshot includes console output showing exact values to copy into `design-tokens.css`:

```
=== TO REPLICATE IN design-tokens.css ===
--app-bg-opacity: 0;
--opacity-glass-medium: 0.05;
--opacity-glass-light: 0.02;
--backdrop-blur: blur(50px);
```

### ✅ Transparency Troubleshooting

**Common Issues & Solutions:**

1. **No transparency visible**:
   - Ensure `transparent: true` in main.ts BrowserWindow config
   - Check macOS System Preferences > Accessibility > Display > Reduce Transparency is OFF
   - Use `./start-without-devtools.sh` (DevTools disable transparency)

2. **Content invisible/too transparent**:
   - Increase `--app-bg-opacity` in design-tokens.css (try 0.3-0.7)
   - Increase glass effect opacities for better visibility

3. **Changes not reflecting**:
   - CSS files have hot reload - changes should be instant
   - If not working, restart dev server: `npm run build:main` then restart

4. **Window can't be dragged**:
   - Current setting: `titleBarStyle: 'default'` (normal title bar)
   - Alternative: `titleBarStyle: 'hiddenInset'` (hidden but draggable)

### ✅ Customizing Transparency

**Easy Transparency Presets** (copy to `design-tokens.css`):

**Fully Transparent**:
```css
--app-bg-opacity: 0;
--opacity-glass-medium: 0.05;
--opacity-glass-light: 0.02;
```

**Semi-Transparent** (Recommended):
```css
--app-bg-opacity: 0.3;
--opacity-glass-medium: 0.2; 
--opacity-glass-light: 0.1;
```

**Subtle Transparency**:
```css
--app-bg-opacity: 0.8;
--opacity-glass-medium: 0.6;
--opacity-glass-light: 0.4;
```

**Heavy Blur Effect**:
```css
--backdrop-blur: blur(50px);
```

**No Blur** (Sharp transparency):
```css
--backdrop-blur: blur(0px);
```

## Scripts

| Command | Description |
|---------|-------------|
| `~/start-transcription-robust.sh` | **Recommended**: Robust launch script with port handling |
| `./start-with-devtools.sh` | Launch with DevTools enabled (transparency disabled) |
| `./start-without-devtools.sh` | Launch without DevTools (full transparency enabled) |
| `npm run start-dev` | Start both Vite and Electron for development |
| `npm run dev:vite` | Start Vite development server only |
| `npm run dev:electron` | Start Electron app only |
| `npm run build` | Build production version |
| `npm run build:renderer` | Build frontend only |
| `npm run build:main` | Build Electron main process only |

## Contributing

1. Follow TypeScript best practices
2. Use functional React components with hooks
3. Maintain consistent code formatting
4. Add comprehensive error handling
5. Update this README for significant changes
6. Test audio system thoroughly before committing

## License

MIT License - see LICENSE file for details
