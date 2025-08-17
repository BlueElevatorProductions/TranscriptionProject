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
- **Word-Level Editing**: Click to edit individual words or segments
- **Dynamic Clip System**: Visual boundaries for organizing transcript content
- **Speaker Management**: Assign and manage speaker names with automatic segment splitting
- **Real-time Speaker Changes**: Change speakers within clips with automatic segment reconstruction
- **Context Menus**: Right-click for editing options and word operations
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

### Clip and Speaker Management System

The application uses a unified system where **clips** and **segments** represent the same conceptual unit - a portion of the transcript with a specific speaker and time range.

#### How It Works
- **Segments**: Core transcript data from transcription services (OpenAI, AssemblyAI, etc.)
- **Clips**: Visual editing boundaries created by users for organizing content
- **Dynamic Segmentation**: When speakers are changed within clips, segments are automatically split/merged to maintain data consistency

#### Speaker Assignment Process
1. **Initial State**: Transcription services provide segments with speaker detection
2. **Clip Creation**: Users can split transcript into clips at any word boundary
3. **Speaker Changes**: When a speaker is changed for a clip:
   - System finds all segments that overlap with the clip boundary
   - Overlapping segments are split at exact clip boundaries
   - The portion within the clip gets the new speaker assignment
   - Adjacent portions retain their original speakers
4. **Real-time Updates**: UI immediately reflects changes without page refresh

#### Key Components
- **`useClips.ts`**: Generates clip boundaries from segments and user splits
- **`ClipBasedTranscript.tsx`**: Handles speaker dropdown interactions and segment splitting
- **`ProjectContext.tsx`**: Manages speaker mappings and segment updates

#### Important Design Principles
- **No Orphaned Changes**: All speaker changes must result in valid segment updates
- **Boundary Consistency**: Clip boundaries always align with word-level timestamps
- **Data Integrity**: Original transcription data is preserved through transformations
- **ID-based Speakers**: Speaker assignments use consistent IDs (SPEAKER_00, SPEAKER_01) with display name mappings

## Recent Updates (August 2025)

### ✅ Speaker Management System Overhaul (Latest)
- **Fixed Speaker Dropdown Issues**: Resolved issue where speaker changes weren't persisting
- **Implemented Segment Splitting**: When speakers are changed within clips, segments are now properly split at word boundaries
- **Unified Clip/Segment Architecture**: Eliminated confusion between clips and segments - they now work as a unified system
- **Real-time Speaker Updates**: Speaker changes now immediately reflect in the UI without requiring app restart
- **Console Logging Cleanup**: Removed excessive console.log statements while preserving error handling

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
The transcription workflow is now fully functional end-to-end:
1. ✅ API key storage and encryption
2. ✅ Audio file import and validation  
3. ✅ Cloud transcription service integration
4. ✅ Real-time progress tracking
5. ✅ Transcript display and editing
6. ✅ Advanced speaker management with automatic segment splitting
7. ✅ Error handling and recovery

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