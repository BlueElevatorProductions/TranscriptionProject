# TranscriptionProject

> A professional desktop transcription editor with advanced audio synchronization and cloud API integration

## Overview

TranscriptionProject is a sophisticated Electron-based desktop application designed for podcast producers, journalists, and audio editors. It features a dual-mode interface for professional transcript editing with real-time audio synchronization, cloud transcription services, and an advanced word-level editing system.

## ✅ Current Features

### **Dual Mode Professional Interface**
- **Playback Mode**: Clean paragraph-based reading interface optimized for listening and review
- **Transcript Edit Mode**: Detailed word-level editing with professional tools and context menus
- **Seamless Mode Switching**: Instant transitions between interfaces with shared state preservation
- **Resizable Layout**: User-customizable panels with drag-to-resize functionality

### **Advanced Transcript Editing System**
- **Word-Level Editing**: Double-click any word to edit, right-click for insertion and context options
- **Complete Undo/Redo System**: Full edit history with Cmd+Z/Cmd+Shift+Z keyboard shortcuts
- **Text Cursor Navigation**: Click-to-position cursor with arrow key navigation between words
- **Paragraph Management**: Enter key for paragraph breaks with visual indicators
- **Context Menu System**: Right-click access to word operations, clip creation, and speaker assignment
- **Speaker Management**: Inline editing throughout transcript with real-time updates

### **Professional Audio Integration**
- **Unified Audio Player**: Consistent bottom player across all modes with shared state
- **Real-time Word Highlighting**: Synchronized highlighting during playback in both interfaces
- **Interactive Transcript**: Click any word to jump audio to that precise timestamp
- **Advanced Transport Controls**: Play/pause, 15-second skip, volume, and variable speed (0.5× to 2.0×)
- **Timeline Scrubbing**: Visual progress with click-to-seek functionality
- **Global Keyboard Shortcuts**: Spacebar for play/pause across all application modes

### **Cloud Transcription Services**
- **OpenAI Whisper Integration**: High-quality cloud transcription with word-level timestamps
- **AssemblyAI Support**: Fast transcription with built-in speaker detection capabilities
- **Local WhisperX Option**: Offline processing for privacy-sensitive content
- **Intelligent Punctuation**: Advanced redistribution algorithm for proper formatting
- **Secure API Management**: Encrypted storage with machine-specific key derivation

### **Modern Project Management**
- **Project File System**: ZIP-based `.transcript` format for portable project storage
- **Audio Embedding**: Optional audio inclusion in project files for portability
- **Speaker Identification**: Semi-automated speaker naming with audio sample playback
- **Import/Export**: Multiple audio format support with metadata preservation

## Technology Stack & Architecture

### **Core Technologies**
- **Frontend**: React 18 with TypeScript for type-safe development
- **Desktop Framework**: Electron 32.2.1 with secure IPC communication
- **Build System**: Vite for fast development with hot reload
- **Audio Processing**: HTML5 Audio API with Electron file system integration
- **State Management**: React hooks with centralized shared audio state
- **Styling**: Custom CSS with CSS variables for consistent theming

### **Application Architecture**

```
Electron Application
├── Main Process (src/main/)
│   ├── main.ts                     # Application entry point & window management
│   ├── preload.ts                  # Secure IPC bridge (88+ API methods)
│   └── services/
│       ├── SimpleCloudTranscriptionService.ts    # OpenAI/AssemblyAI integration
│       ├── ProjectFileService.ts                 # Modern .transcript format
│       └── ProjectFileManager.ts                 # Legacy .transcription format
│
└── Renderer Process (src/renderer/)
    ├── App.tsx                     # Central state manager & view router
    ├── components/
    │   ├── PlaybackMode/
    │   │   ├── PlaybackModeContainer.tsx          # Clean reading interface
    │   │   └── CleanTranscriptDisplay.tsx         # Paragraph-grouped display
    │   ├── TranscriptEdit/
    │   │   ├── TranscriptEditContainer.tsx        # Professional editing interface
    │   │   ├── TranscriptPanel.tsx                # Word-level editing canvas
    │   │   ├── ContextMenu.tsx                    # Right-click operations
    │   │   └── useClips.ts                        # Clip management hook
    │   ├── shared/
    │   │   ├── BottomAudioPlayer.tsx              # Unified audio controls
    │   │   └── SpeakersPanel.tsx                  # Speaker management UI
    │   ├── SpeakerIdentification/
    │   │   └── SpeakerIdentification.tsx          # Speaker naming workflow
    │   └── ImportDialog/
    │       └── ImportDialog.tsx                   # File import & model selection
    └── hooks/
        └── useAudioPlayer.ts                      # Audio state management
```

### **Data Flow Architecture**

```
Audio Import → Cloud/Local Transcription → Speaker Identification → Dual-Mode Editing → Project Export

1. File Import Dialog (ImportDialog.tsx)
   ↓ IPC → main.ts → SimpleCloudTranscriptionService.ts
2. Transcription Processing (OpenAI/AssemblyAI/WhisperX)
   ↓ Progress Events → IPC → App.tsx
3. Speaker Identification (SpeakerIdentification.tsx)
   ↓ Speaker Mapping → Global State
4. Editing Interfaces (PlaybackMode + TranscriptEdit)
   ↓ Shared State → Real-time Synchronization
5. Project Persistence (ProjectFileService.ts)
   ↓ ZIP Archive → .transcript files
```

## Developer Documentation

### **Core Components Deep Dive**

#### **App.tsx - Central State Manager**
- **Responsibilities**: View routing, shared audio state, project lifecycle, API coordination
- **Key Features**: 
  - Multi-view state machine (`home`, `transcription-progress`, `speaker-identification`, `playback`)
  - Centralized `handleAudioStateUpdate` with state validation and type safety
  - Project file management with auto-save and unsaved changes tracking
  - IPC event coordination with polling fallbacks

#### **TranscriptEditContainer.tsx - Professional Editing**
- **Architecture**: Word-level editing with comprehensive undo/redo system
- **Core Systems**:
  - **Edit History**: Linear undo/redo with action types (`word-edit`, `speaker-change`, `paragraph-break`)
  - **Clip Management**: `useClips` hook for sophisticated clip operations and speaker assignment
  - **Keyboard Shortcuts**: Cmd+Z/Shift+Z for undo/redo, spacebar for play/pause
  - **Context Menu Integration**: Right-click operations with word insertion and clip creation

#### **PlaybackModeContainer.tsx - Document Interface**
- **Design Philosophy**: Clean, document-focused reading experience
- **Key Features**:
  - **Paragraph Grouping**: Intelligent segment grouping by speaker and timing gaps
  - **Resizable Layout**: Drag-to-resize sidebar with constraints and persistence
  - **Global Shortcuts**: Document-wide spacebar handling with input field detection

#### **BottomAudioPlayer.tsx - Unified Audio System**
- **Technical Implementation**: HTML5 Audio with Electron file system bridge
- **Core Features**:
  - **Secure File Loading**: IPC → ArrayBuffer → Blob URL conversion
  - **State Synchronization**: Shared audio state with defensive validation
  - **Time Updates**: Animation frame-based updates with 50ms precision
  - **Format Support**: Wide audio format compatibility with MIME type detection

### **Key TypeScript Interfaces**

```typescript
interface TranscriptionJob {
  id: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: WhisperTranscriptionResult;
  speakerNames?: { [key: string]: string };
}

interface SharedAudioState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
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

### **Service Layer Architecture**

#### **SimpleCloudTranscriptionService.ts**
- **OpenAI Integration**: Whisper-1 model with optimized prompts for punctuation
- **AssemblyAI Support**: Fast transcription with speaker diarization
- **Features**: Audio format conversion (FFmpeg), progress callbacks, connection testing
- **Error Handling**: Comprehensive error capture with user-friendly messages

#### **ProjectFileService.ts - Modern Project Format**
- **File Structure**: ZIP-based `.transcript` files with organized JSON structure
- **Contents**:
  - `project.json` - Project metadata and settings
  - `transcription.json` - Complete transcript data with word timestamps
  - `metadata/speakers.json` - Speaker information and mappings
  - `metadata/clips.json` - Clip definitions and metadata
  - `audio/original.*` - Optional embedded audio files
- **Compression**: DEFLATE level 6 for optimal size/speed balance

### **Security & Encryption**

#### **API Key Management**
- **Storage**: `~/.config/TranscriptionProject/api-keys.enc`
- **Encryption**: AES-256-CBC with machine-specific key derivation
- **Key Generation**: SHA256(`platform + app.version + executable.path`)
- **Security Model**: Process isolation with secure IPC bridge

### **Audio Processing Pipeline**

```
Audio File → Electron File API → ArrayBuffer → Blob URL → HTML5 Audio
                ↓
          Format Validation → Size Checking → MIME Type Detection
                ↓
          Word-Level Synchronization → Real-time Highlighting → Interactive Seeking
```

### **State Management Patterns**

#### **Shared Audio State**
- **Architecture**: Centralized state with prop drilling and defensive validation
- **Update Pattern**: `handleAudioStateUpdate` with type safety and NaN protection
- **Synchronization**: Cross-component state sharing with immediate UI updates

#### **Edit History System**
```typescript
interface EditAction {
  type: 'word-edit' | 'speaker-change' | 'clip-create' | 'word-insert' | 'word-delete' | 'paragraph-break';
  data: any;
  timestamp: number;
}
```

## Getting Started

### **Prerequisites**
- Node.js 18+ with npm
- Git for version control
- (Optional) Python 3.8+ for local WhisperX transcription

### **Installation**

```bash
# Clone the repository
git clone https://github.com/BlueElevatorProductions/TranscriptionProject.git
cd TranscriptionProject

# Install dependencies
npm install

# Set up environment variables (copy .env.example to .env)
cp .env.example .env
```

### **Development Workflow**

```bash
# Start concurrent development servers
npm run start-dev

# Or run separately:
# Terminal 1: Frontend development server (port 5174)
npm run dev:vite

# Terminal 2: Electron application
npm run dev:electron

# Build main process only
npm run build:main
```

### **Configuration**

#### **Environment Variables (.env)**
```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Development Settings
NODE_ENV=development
```

#### **API Key Setup**
1. Launch the application
2. Click the gear icon (⚙️) in the top-right header
3. Enter your OpenAI API key (encrypted and stored locally)
4. Keys are machine-specific and automatically encrypted

## Suggested Improvements & Future Development

### **Architecture Enhancements**

#### **State Management Evolution**
- **Current**: React state with prop drilling
- **Suggested**: Context providers or Redux Toolkit for complex state
- **Benefits**: Reduced prop drilling, better debugging, predictable updates

#### **Component Architecture Refinements**
- **Extract Shared Logic**: Create custom hooks for common patterns (word navigation, time formatting)
- **Component Composition**: Break down large components into smaller, focused units
- **Error Boundaries**: Add granular error handling for each major component tree

#### **Performance Optimizations**
- **Word Highlighting**: Implement virtual scrolling for large transcripts
- **Audio Loading**: Add progressive loading for large audio files
- **Memory Management**: Implement cleanup for blob URLs and temporary files

### **Feature Enhancements**

#### **Advanced Editing Features**
- **Find & Replace**: Global text search with regex support
- **Bulk Operations**: Multi-selection editing and speaker reassignment
- **Text Formatting**: Rich text support with markdown export
- **Collaboration**: Real-time collaborative editing with conflict resolution

#### **Export System Improvements**
- **Format Support**: SRT, VTT, Word, PDF export options
- **Audio Export**: Clip-based audio extraction with fade in/out
- **Batch Processing**: Multiple project export with templates

#### **Transcription Pipeline Enhancements**
- **Model Selection**: User-configurable Whisper model sizes
- **Custom Vocabulary**: Domain-specific word lists for improved accuracy
- **Language Support**: Multi-language transcription with automatic detection
- **Confidence Scoring**: Visual confidence indicators for transcript quality

### **Technical Debt & Code Quality**

#### **TypeScript Improvements**
- **Strict Mode**: Enable strict TypeScript compilation
- **Type Definitions**: Create comprehensive type definitions for all data structures
- **Generic Utilities**: Develop reusable type utilities for common patterns

#### **Testing Infrastructure**
- **Unit Tests**: Comprehensive test coverage for core business logic
- **Integration Tests**: End-to-end workflow testing with realistic data
- **Performance Tests**: Automated performance regression testing

#### **Build & Deployment**
- **Production Builds**: Configure optimized production builds
- **Code Splitting**: Implement lazy loading for improved startup performance
- **Bundle Analysis**: Regular bundle size monitoring and optimization

### **Security Enhancements**
- **Content Security Policy**: Implement strict CSP for renderer processes
- **Dependency Auditing**: Regular security audits for npm dependencies
- **File Validation**: Enhanced file type and content validation

### **User Experience Improvements**
- **Onboarding**: Interactive tutorial for new users
- **Keyboard Shortcuts**: Comprehensive shortcut system with customization
- **Accessibility**: Full WCAG 2.1 compliance with screen reader support
- **Themes**: Dark mode and customizable color schemes

## Development Status

### ✅ **Completed Implementation**
- [x] **Core Architecture**: Electron/React/TypeScript foundation with secure IPC
- [x] **Dual Interface System**: Playback and Transcript Edit modes with seamless switching
- [x] **Audio Integration**: Real-time synchronization with word-level highlighting
- [x] **Cloud Transcription**: OpenAI Whisper and AssemblyAI integration
- [x] **Professional Editing**: Word-level editing with undo/redo and context menus
- [x] **Project Management**: ZIP-based project files with audio embedding
- [x] **Security**: Encrypted API key storage with machine-specific binding

### 🚧 **Active Development Priorities**
- [ ] **Local Transcription**: WhisperX integration for offline processing
- [ ] **Export System**: Multiple format support (SRT, VTT, Word, PDF)
- [ ] **Performance**: Optimization for large files and memory usage
- [ ] **Testing**: Comprehensive test suite for core functionality

### 📋 **Future Roadmap**
- [ ] **Collaboration**: Real-time collaborative editing capabilities
- [ ] **Mobile Companion**: React Native app for remote transcription management
- [ ] **Plugin System**: Extensible architecture for third-party integrations
- [ ] **Cloud Sync**: Optional cloud storage for cross-device project access

## Contributing

### **Code Style & Standards**
- **TypeScript**: Strict typing with comprehensive interfaces
- **React**: Functional components with hooks, no class components
- **Naming**: Descriptive names with consistent camelCase/PascalCase
- **Comments**: JSDoc for public APIs, inline comments for complex logic

### **Development Guidelines**
- **Commits**: Conventional commit messages with scope
- **Branches**: Feature branches with descriptive names
- **Testing**: Tests required for new features and bug fixes
- **Documentation**: Update README and inline docs for significant changes

---

*Built with ❤️ for professional audio transcription workflows*

**Key Contributors**: Development team focused on creating professional-grade transcription tools for content creators, journalists, and audio professionals.

**License**: [Add your license information here]

**Support**: For questions or support, please [add contact information or issue tracker link]