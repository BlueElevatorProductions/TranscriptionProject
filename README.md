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

### Audio Integration
- **Unified Audio Player**: Bottom-mounted player with transport controls
- **Real-time Synchronization**: Word-level highlighting during playback
- **Interactive Transcript**: Click any word to jump to that audio timestamp
- **Speed Control**: Variable playback speed (0.5× to 2×)
- **Timeline Scrubbing**: Visual progress bar with click-to-seek

### Professional Editing
- **Word-Level Editing**: Double-click individual words to correct transcription errors with persistent saving
- **Dynamic Clip System**: Visual boundaries for organizing transcript content
- **Speaker Management**: Assign and manage speaker names with automatic segment splitting
- **Real-time Speaker Changes**: Change speakers within clips with automatic segment reconstruction
- **Context Menus**: Right-click for editing options (Edit Word, Delete Word, Split Clip Here)
- **Clip Splitting**: Press Enter at cursor position to create new clip boundaries
- **Font Controls**: Customize transcript display with font panel

### Project Management
- **Project-First Workflow**: Create named projects before importing audio
- **ZIP-based Format**: `.transcript` files contain all project data
- **Auto-save**: Automatic project saving with unsaved changes tracking
- **Import/Export**: Support for various audio formats
- **Recent Projects**: Quick access to recently opened projects

### Error Handling & Notifications
- **Toast Notifications**: Non-intrusive status messages and error alerts
- **Error Recovery**: Smart error handling with actionable suggestions
- **Crash Protection**: Error boundaries prevent application crashes
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
  - Tabs, Sliders, Dialogs, Dropdowns, Tooltips
- **Lucide React**: Consistent icon set throughout the interface
- **Custom Components**: Built on Radix primitives with Tailwind styling

### State Management
- **React Context**: Centralized state management with multiple contexts
  - `AudioContext`: Audio playback state and controls
  - `ProjectContext`: Project data and metadata management
  - `TranscriptionContext`: Transcription jobs and processing state
  - `NotificationContext`: Toast notifications and error handling

### Backend Services
- **Node.js APIs**: Integration with OpenAI and AssemblyAI services
- **File System**: Secure file handling with Electron's main process
- **Encryption**: AES-256 encryption for API key storage
- **IPC Communication**: Secure communication between main and renderer processes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
├─────────────────────────────────────────────────────────────┤
│ Main Process (src/main/)                                    │
│ ├── main.ts                    # App entry & window mgmt    │
│ ├── preload.ts                 # Secure IPC bridge         │
│ └── services/                                               │
│     ├── SimpleCloudTranscriptionService.ts                 │
│     ├── ProjectFileService.ts                              │
│     └── ProjectPackageService.ts                           │
├─────────────────────────────────────────────────────────────┤
│ Renderer Process (src/renderer/)                           │
│ ├── App.tsx                    # Main app component        │
│ ├── main.tsx                   # React app entry point     │
│ ├── contexts/                  # State management          │
│ │   ├── AudioContext.tsx                                   │
│ │   ├── ProjectContext.tsx                                 │
│ │   ├── TranscriptionContext.tsx                          │
│ │   ├── NotificationContext.tsx                           │
│ │   └── index.tsx              # Combined providers        │
│ ├── components/                                             │
│ │   ├── ui/                                                │
│ │   │   └── NewUIShell.tsx     # Main interface shell     │
│ │   ├── shared/                # Reusable components       │
│ │   ├── ImportDialog/          # File import workflows     │
│ │   ├── NewProject/            # Project creation          │
│ │   ├── Notifications/         # Toast system              │
│ │   └── TranscriptEdit/        # Editing components        │
│ ├── hooks/                     # Custom React hooks        │
│ ├── services/                  # Business logic            │
│ └── types/                     # TypeScript definitions    │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Project Creation**: User creates new project → Project context initialized
2. **Audio Import**: File selected → Sent to main process → Cloud transcription service
3. **Transcription**: Progress updates via IPC → UI shows real-time status
4. **Results**: Completed transcript → Project context → UI rendering
5. **Editing**: User interactions → Context updates → Real-time UI updates
6. **Saving**: Project data → ZIP packaging → File system storage

## Core Components

### NewUIShell.tsx
The main interface component featuring:
- Dark green sidebar with mode tabs (Listen/Edit)
- Project management controls (New, Open, Save)
- Panel toggles (Speakers, Clips, Fonts)
- Main content area with transcript display
- Integrated audio player at bottom

### Audio System
- **BottomAudioPlayer**: Unified audio controls across all modes
- **Audio Context**: Centralized audio state management
- **Word Synchronization**: Real-time highlighting during playback
- **Interactive Navigation**: Click-to-seek functionality

### Project System
- **ZIP-based Projects**: Self-contained `.transcript` files
- **Metadata Management**: Project settings, speaker info, clips
- **Auto-save**: Automatic saving with change detection
- **Import/Export**: Multiple audio format support

### Transcription Pipeline
```
Audio File → Cloud Service → Word Timestamps → Speaker Detection → UI Display
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

1. **Launch the app**: Run `~/start-transcription-robust.sh` or use npm scripts
2. **Create a new project**: Click "New" in the sidebar and name your project
3. **Configure API keys**: Go to Settings > API Keys and add your cloud service credentials
4. **Import audio**: Click the import button, select your audio file
5. **Choose transcription service**: Select "cloud-openai" or your preferred service
6. **Watch the magic**: The glass progress overlay will show real-time transcription progress
7. **Edit and export**: Use the transcript editor to refine your text and export results

## File Structure

### Project Files (.transcript)
ZIP archives containing:
- `project.json`: Project metadata and settings
- `transcription.json`: Complete transcript with word timestamps
- `metadata/speakers.json`: Speaker names and mappings
- `metadata/clips.json`: Audio clip definitions
- (Optional) `audio/`: Original audio files

### Configuration
- API keys: `~/.config/TranscriptionProject/api-keys.enc`
- Recent projects: Managed by Electron's userData directory

## Development Guidelines

### Code Organization
- **Components**: Functional React components with TypeScript
- **Hooks**: Custom hooks for reusable logic
- **Contexts**: Centralized state management
- **Services**: Business logic and external API integration
- **Types**: Comprehensive TypeScript definitions

### Styling
- **Tailwind CSS**: Utility-first styling approach
- **Design Tokens**: Consistent colors and spacing via CSS variables
- **Responsive Design**: Mobile-friendly layouts where applicable
- **Dark Theme**: Professional dark green color scheme

### State Management
- **React Context**: Multiple specialized contexts
- **Immutable Updates**: Proper state update patterns
- **Type Safety**: Full TypeScript coverage for state
- **Error Boundaries**: Graceful error handling

## Core Systems

### Clip-Based Architecture (November 2024 Update)

The application has been completely redesigned with **clips as the primary data structure**. This new architecture provides better user experience and data persistence.

#### Core Concepts

**Clips**: The primary data structure containing:
- Word-level timestamps and text
- Speaker assignments
- Clip boundaries (start/end times and word indices)
- User-created metadata (creation time, modifications)

**Segments**: Archived initial transcription data from cloud services, kept for potential "reset to original" feature

#### Data Flow Architecture

```
1. Transcription Complete → Initial Segments Generated
2. Segments → Generate Clips → Save Clips as Primary Data
3. User Edits → Update Clips → Save Clips to Project
4. Segments Archived (not modified after initial generation)
```

#### How Clips Work

1. **Initial Generation**: When transcription completes:
   - Segments from cloud service → Generate clips based on speaker changes
   - Clips become the "source of truth"
   - Original segments archived in `project.originalTranscription`

2. **User Editing**:
   - **Edit Words**: Double-click any word to correct transcription errors, press Enter to save
   - **Split Clips**: Press Enter at cursor position to create new clip boundary
   - **Change Speakers**: Select from dropdown - updates clip directly
   - **Merge Clips**: Combine adjacent clips into single clip
   - **Context Menu Actions**: Right-click words for Edit, Delete, or Split operations
   - All changes persist immediately to project file

3. **Data Persistence**:
   - Clips saved in `project.clips.clips` array
   - No more segment manipulation or synchronization issues
   - Speaker changes are instant and permanent

#### Key Components

- **`usePersistedClips.ts`**: New hook managing clips as primary data with editing methods:
  - `updateClipWord()`: Edit individual words with persistent saving
  - `updateClipSpeaker()`: Change clip speaker assignments
  - `splitClip()`: Create new clips at word boundaries
  - `mergeClips()`: Combine adjacent clips
- **`ClipBasedTranscript.tsx`**: UI component for clip editing and display
- **`ProjectContext.tsx`**: Handles clip persistence via `updateClips()` action
- **`NewUIShell.tsx`**: Coordinates between persisted clips and UI

#### Architectural Benefits

- **✅ Data Integrity**: No more lost user edits when changing speakers
- **✅ Performance**: No constant regeneration of clips from segments
- **✅ Simplicity**: Single source of truth eliminates sync issues
- **✅ User Experience**: Instant feedback for all editing operations
- **✅ Persistence**: All user changes saved immediately

#### Migration from Old Architecture

Projects created before this update will:
1. Load with segments as primary data (fallback mode)
2. Generate clips from segments on first load
3. Save clips as new primary data structure
4. Archive segments for potential reset feature

### Word-Level Editing System

The application provides comprehensive word-level editing capabilities for correcting transcription errors:

#### **Double-Click Word Editing**
1. **Activate Edit Mode**: Double-click any word in Edit mode to enter inline editing
2. **Make Corrections**: Type the corrected word to fix transcription service errors
3. **Save Changes**: Press Enter to save - word updates immediately in clips and project file
4. **Cancel Editing**: Press Escape to cancel without saving changes

#### **Context Menu Operations** 
Right-click any word for additional editing options:
- **Edit Word**: Same as double-click - enters inline editing mode
- **Delete Word**: Marks word as deleted with strikethrough (can be restored)
- **Split Clip Here**: Creates new clip boundary at the selected word

#### **Technical Implementation**
- **Clips-First Architecture**: Word edits update `clip.words[]` array directly
- **Real-time Persistence**: Changes save immediately via `updateClipWord()` method
- **Dual Updates**: Updates both individual word object and clip's text field
- **Project File Integration**: All edits persist to `.transcript` ZIP file automatically

#### **Data Flow for Word Editing**
```
User Double-Clicks Word → Inline Edit Mode → User Types Correction → 
Press Enter → updateClipWord() → Update Clip Data → onClipsChange() → 
Save to Project File → UI Updates
```

This system ensures transcription service errors can be permanently corrected with immediate visual feedback and persistent storage.

## Recent Updates (November 2024)

### ✅ Complete Architectural Overhaul - Clips as Primary Data (Latest)
- **Clips-First Architecture**: Completely redesigned data flow with clips as primary data structure
- **Eliminated Segment Sync Issues**: No more lost edits when changing speakers - clips persist all changes
- **Enhanced Word Editing**: Double-click words to correct transcription errors with persistent saving to project files
- **Context Menu System**: Professional right-click menu with Edit Word, Delete Word, Split Clip Here options
- **Enhanced Split Functionality**: Press Enter to split clips at cursor position with perfect word-level precision
- **Instant Speaker Changes**: Speaker dropdown changes update clips directly with immediate persistence
- **Improved Performance**: No more constant regeneration of clips from segments
- **Better User Experience**: All editing operations now provide instant feedback
- **Data Migration Support**: Existing projects automatically migrate to new clip-based architecture

### ✅ UI/UX Design System Implementation  
- **Color Theming**: Added persistent color themes (Green/Blue) with localStorage storage
- **Panel Animation Fixes**: Resolved green color flashes during panel transitions
- **Improved Panel Behavior**: One-panel-at-a-time with smooth 150ms transitions
- **Font System Enhancement**: Default font size changed to 18px with persistent project-level storage
- **Sidebar Spacing**: Fixed gap between Fonts and Speakers buttons
- **Clips Panel Optimization**: Removed editing features, expanded viewable area, added click-to-scroll functionality

### ✅ Architecture Debugging and Optimization
- **React Key Warnings Fixed**: Resolved duplicate key issues causing rendering inconsistencies  
- **Multiple Update Prevention**: Fixed excessive clip update calls during initialization
- **Console Cleanup**: Removed debug logging while preserving error handling
- **Type Safety Improvements**: Enhanced TypeScript definitions for new clip architecture

### ✅ API Key Integration & Transcription Workflow
- **Settings Panel Integration**: Added Settings section to sidebar with API Keys management
- **Modern API Settings UI**: Redesigned API settings with Tailwind CSS and secure storage
- **Import Flow Fix**: Fixed transcription import workflow - files now properly trigger cloud transcription
- **Glass Progress Overlay**: Beautiful glass morphism progress indicator with:
  - Real-time progress bars and status updates
  - Provider information (OpenAI, AssemblyAI, etc.)
  - Cancel functionality for running jobs
  - Error handling with detailed messages

### 🔧 Enhanced Debugging & Reliability
- **Comprehensive Debug Logging**: Added detailed logging throughout transcription pipeline
- **Event Handler Improvements**: Fixed transcription completion and progress event handling
- **Error Recovery**: Better error messages and recovery options for failed transcriptions
- **Type Safety Improvements**: Relaxed strict TypeScript rules for better development experience

### 🚀 Development Experience
- **Robust Launch Script**: Created `~/start-transcription-robust.sh` for reliable app launching
- **Port Conflict Resolution**: Fixed Vite/Electron port synchronization issues
- **Hot Reload Support**: Improved development workflow with better hot reloading

### 🎯 Production Ready Features
The transcription workflow is now fully functional with clips-first architecture:
1. ✅ API key storage and encryption
2. ✅ Audio file import and validation  
3. ✅ Cloud transcription service integration (OpenAI, AssemblyAI, Rev.ai)
4. ✅ Real-time progress tracking with glass morphism UI
5. ✅ **Clip-based transcript editing** with instant persistence
6. ✅ **Word-level editing** with double-click correction and persistent saving
7. ✅ **Professional context menu** with Edit, Delete, Split operations
8. ✅ **Advanced speaker management** with dropdown selection
9. ✅ **Interactive clip splitting** with Enter key at cursor position
10. ✅ **Persistent color theming** (Green/Blue themes)
11. ✅ **Professional font controls** with project-level storage
12. ✅ **Comprehensive error handling** and recovery
13. ✅ **Project file management** with ZIP-based .transcript files

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

## License

MIT License - see LICENSE file for details