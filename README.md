# TranscriptionProject

> A cross-platform podcast transcript editor with integrated audio editing capabilities

## Overview

TranscriptionProject is an Electron-based desktop application designed for podcast producers and audio editors. It combines AI-powered transcription with non-destructive audio editing, enabling seamless workflow from raw interview recordings to polished final products.

## Key Features

- **Offline Transcription**: On-device WhisperX processing with word-level timestamps
- **Multi-Speaker Support**: Automatic speaker diarization with color-coded transcripts
- **Integrated Audio Editing**: Non-destructive cuts, fades, and volume control via Tracktion Engine
- **Professional Export**: Support for audio formats (MP3/WAV/AIFF), text formats (TXT/DOC), and professional formats (AAF/OMF)
- **Cross-Platform**: Built with Electron for Mac, Windows, and Linux support

## Technology Stack

### Core Technologies
- **Frontend**: React with React-Quill text editor (Lexical as fallback)
- **Desktop Framework**: Electron
- **Transcription**: WhisperX (offline, on-device processing)
- **Audio Engine**: Tracktion Engine (free personal tier)
- **Project Format**: JSON container with edit history
- **Export Integration**: pyaaf2/OTIO for professional format support

## Architecture

The application is built around four core modules:

1. **Import & Transcription** - Audio file processing and WhisperX integration
2. **Alignment & Transcript Editor** - Timestamp refinement and text editing
3. **Audio Engine & Editing** - Playback and non-destructive audio modifications
4. **Export & Persistence** - Project saving and multi-format export

All modules share synchronized timestamp metadata to maintain audio-text alignment.

## Development Roadmap

### Phase 1: Setup & Infrastructure
- [x] Git repository and CI setup
- [ ] Electron/React scaffold
- [ ] WhisperX model integration
- [ ] Tracktion Engine licensing and integration

### Phase 2: Core Features
- [ ] Alignment and transcript editing
- [ ] React-Quill integration
- [ ] Tracktion playback and editing (cut, fade, undo/redo)
- [ ] Multi-speaker diarization support

### Phase 3: Persistence & Export
- [ ] JSON project schema implementation
- [ ] Save/load functionality
- [ ] Audio/text format exports
- [ ] AAF/OMF integration via pyaaf2/OTIO
- [ ] Non-destructive editing history

### Phase 4: Polish & Release
- [ ] Responsive UI design
- [ ] Electron packaging and code signing
- [ ] Preferences and settings
- [ ] Error handling and update checker
- [ ] Beta testing and v1.0 release

## User Story

**Persona**: Chris, a podcast producer

Chris imports a 90-minute interview and watches WhisperX transcribe offline with a progress indicator. The transcript appears with speaker color-coding. In Playback mode, he reviews and highlights unneeded segments. Using Transcript Edit mode, he corrects misrecognized words via React-Quill. In Audio Edit mode, he non-destructively removes segments using Tracktion Engine. Finally, he exports a clean MP3 and AAF project for sound engineering in Pro Tools.

## Getting Started

### Prerequisites

- Node.js and npm
- Python (for pyaaf2 and OTIO dependencies)
- Tracktion Engine license (free personal tier available)

### Installation

```bash
# Clone the repository
git clone https://github.com/BlueElevatorProductions/TranscriptionProject.git
cd TranscriptionProject

# Install dependencies
npm install

# Install Python dependencies for export features
pip install pyaaf2 opentimelineio
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

## License Setup

This project requires a Tracktion Engine license:
1. Create account at [engine.tracktion.com](https://engine.tracktion.com)
2. Obtain free Personal license (includes branding requirement and $50k revenue limit)
3. Each developer requires a separate license seat

## Contributing

We welcome contributions! Please see our contributing guidelines and engage with the podcasting and audio editing community for feedback and feature prioritization.

## Performance Considerations

- WhisperX model files (~1-3 GB) included in project assets
- Benchmark transcription time and memory usage on target hardware
- WCAG accessibility standards compliance
- Color-blind friendly speaker color palette

## Future Roadmap

- Multi-language ASR model support
- Modular architecture for additional diarization modules
- Community-driven feature development
- Enhanced accessibility features

---

*Built with ❤️ for the podcasting community*
