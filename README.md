# TranscriptionProject

A professional desktop transcription application built with Electron, React, and TypeScript. Features a modern interface with cloud transcription services, advanced audio synchronization, and professional editing tools.

## Overview

TranscriptionProject is a desktop application designed for content creators, journalists, and audio professionals who need accurate, editable transcripts. The app provides a streamlined workflow from audio import through cloud transcription to professional editing with real-time audio synchronization.

## Features

### Modern User Interface
- **Dark Green Sidebar**: Professional ScriptScribe-inspired design with Listen/Edit mode tabs
- **Responsive Layout**: Tailwind CSS with clean, modern styling
- **Mode Switching**: Toggle between Listen mode (playback-focused) and Edit mode (editing-focused)
- **Panel System**: Expandable sidebar panels for speakers, clips, fonts, and project management
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
- **Error Recovery**: Comprehensive error boundaries with automatic recovery
- **Memory Management**: Efficient state management with cleanup monitoring

### Professional Editing (Enhanced 2025)
- **Word-Level Editing**: Double-click individual words to correct transcription errors
- **Dynamic Clip System**: Visual boundaries for organizing transcript content
- **Speaker Management**: Assign and manage speaker names with automatic persistence
- **Context Menus**: Right-click for editing options (Edit Word, Delete Word, Split Clip Here)
- **Clip Operations**: Split, merge, reorder, and delete clips with undo support
- **Font Controls**: Customize transcript display with font panel
- **Listen/Edit Modes**: 
  - **Listen Mode**: Click words → immediate seek + play, deleted content hidden
  - **Edit Mode**: Click words → position cursor, deleted content visible with strikethrough

### Project Management
- **Project-First Workflow**: Create named projects before importing audio
- **ZIP-based Format**: `.transcript` files contain all project data
- **Auto-save**: Automatic project saving with unsaved changes tracking
- **Import/Export**: Support for various audio formats
- **Recent Projects**: Quick access to recently opened projects

### Error Handling & Recovery
- **Audio Error Boundaries**: Automatic recovery from audio system failures
- **Timeline Validation**: Comprehensive validation and repair of timeline data
- **Graceful Degradation**: System continues working even with partial failures
- **Memory Monitoring**: Active memory usage tracking and cleanup
- **Debug Information**: Detailed error logs for troubleshooting

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
│ │   ├── SimpleTranscript.tsx   # Clean transcript UI      │
│ │   ├── SimpleAudioControls.tsx # Professional controls   │
│ │   ├── AudioErrorBoundary.tsx # Error recovery system    │
│ │   ├── shared/                # Reusable components       │
│ │   ├── ImportDialog/          # Enhanced import system    │
│ │   ├── Settings/              # User preferences          │
│ │   └── Notifications/         # Toast system              │
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
- **Component Orchestration**: Manages SimpleTranscript + AudioErrorBoundary

#### **4. SimpleTranscript.tsx** - The UI

**Listen Mode:**
- Click word → Seek + Play immediately
- Deleted content hidden
- Clean reading experience

**Edit Mode:**
- Click word → Position cursor
- Deleted content visible with strikethrough
- Full editing capabilities

### Data Flow

User clicks word → SimpleTranscript → AudioSystemIntegration → useAudioEditor → AudioManager → HTML Audio Element → Word highlighting updates → SimpleTranscript re-renders

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
- **Hooks**: Custom hooks for reusable logic (`useAudioEditor`)
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

## Recent Updates (August 2025 - Latest)

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
- **SimpleTranscript.tsx**: Clean transcript UI with proper mode behavior
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
  <SimpleTranscript audioState={state} audioActions={actions} />
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

## Scripts

| Command | Description |
|---------|-------------|
| `~/start-transcription-robust.sh` | **Recommended**: Robust launch script with port handling |
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