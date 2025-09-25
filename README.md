# TranscriptionProject v2.0

A professional desktop transcription application built with Electron, React, and TypeScript. Features a modern interface with cloud transcription services, advanced audio synchronization, and professional editing tools.

## ⚠️ BREAKING CHANGES - Version 2.0

**TranscriptionProject v2.0 represents a complete architectural refactoring for data integrity and scalability.**

### Major Changes
- **🔄 Complete Data Model Overhaul**: Segment-based architecture replaces legacy token system
- **🏗️ Main Process Authority**: Canonical state moved to main process with validation
- **🚫 No Backward Compatibility**: v2.0 projects incompatible with v1.x format
- **⚡ Clean Slate Approach**: All legacy systems removed, focusing on stability and simplicity
- **🎨 Glass Morphism UI**: Complete redesign with semi-transparent interface and blur effects
- **🔧 EventEmitter Fix**: Resolved transcription import errors for stable operation
- **📚 New Documentation**: Comprehensive architecture documentation for developers

### New Architecture Benefits
- **Data Integrity**: Original transcription timestamps always preserved
- **Performance**: Binary search optimization for large projects
- **Scalability**: Atomic edit operations with undo support
- **Maintainability**: Clear separation between main process and renderer
- **Extensibility**: Ready for collaborative editing and advanced features
- **Stability**: Direct v2.0 implementation without wrappers or legacy compatibility layers

### Recent v2.0 Improvements (September 2025)
- **Fixed Import Process**: Resolved "eventEmitter.emit is not a function" error
- **Enhanced Debugging**: Comprehensive debugging throughout transcription chain
- **Event-Driven Progress**: Real-time transcription progress with event listeners
- **API Key Integration**: Proper cloud service integration with encrypted key storage
- **Audio Playback Fixed**: Complete fix for audio path resolution and playback functionality - audio now working properly

### ⚠️ Audio Playback Speed Issues - Comprehensive Fix Attempts (September 2025 - Latest)

**Current Status**: Audio playback speed remains incorrect despite multiple systematic troubleshooting attempts. Audio plays but at wrong tempo. This section documents our debugging journey.

#### 🔧 **Audio Speed Fix Attempts - Complete Timeline**

**1. Path Resolution Enhancement (Attempt 1)**:
- **Implementation**: Added `audio?.path` as first check in path resolution fallback chain
- **Backend Integration**: Enhanced transcription import to store absolute paths in project metadata
- **Result**: ❌ Audio still not playing - issue deeper than path resolution

**2. Sample Rate Mismatch Fix (Attempt 2)**:
- **Problem**: Audio playing 8.8% too fast due to 44.1kHz vs 48kHz sample rate hardcode
- **Solution**: Changed hardcoded 44100.0 to 48000.0 in JUCE backend main.cpp:315
- **Result**: ✅ Speed issue fixed but introduced segmentation faults

**3. Dynamic Sample Rate Implementation (Attempt 3)**:
- **Problem**: Hardcoded sample rate change caused JUCE backend crashes (SIGSEGV)
- **Solution**: Implemented dynamic sample rate detection instead of hardcoded values
- **Technical**: Added safety checks and logging for sample rate initialization
- **Result**: ✅ Segmentation faults resolved, backend launches successfully

**4. JUCE Backend EPIPE Error Fix (Attempt 4)**:
- **Problem**: JavaScript EPIPE error indicating JUCE backend process disconnection
- **Root Cause**: EdlAudioSource sampleRate initialized to 0.0 causing division by zero
- **Solution**:
  - Changed sampleRate initialization from 0.0 to 48000.0 as safe default
  - Added defensive checks in getNextReadPosition() and getTotalLength() methods
  - Maintained dynamic sample rate updates in prepareToPlay()
- **Result**: ✅ EPIPE errors eliminated, backend starts without crashes

**5. Audio Speed Analysis & Segment Fix (Attempt 5 - September 2025)**:
- **Problem**: Two expert diagnoses identified segment timing mismatches as root cause
- **Root Cause**: Small gaps (<1s) extended word segments without updating original timestamps
- **Technical Issue**:
  - Edited duration: 1.3s (extended to cover 0.8s gap)
  - Original duration: 0.5s (unchanged)
  - JUCE backend assumed they matched, causing audio replay/speed issues
- **Solution**: Create explicit spacer segments for ALL gaps >1ms instead of extending words
- **Result**: ❌ Created 788 segments for 145s audio, JUCE backend crashed with SIGSEGV

**6. Ratio-Preserving Gap Handling (Attempt 6)**:
- **Problem**: Too many segments (5.4/second) overwhelmed JUCE backend
- **Solution**: Reverted to 1s spacer threshold but preserved timing ratios
- **Technical**: When extending segments for gaps <1s:
  - `newOriginalEnd = originalStart + (originalDuration × scaleFactor)`
  - `scaleFactor = newEditedDuration / currentEditedDuration`
- **Files**: TranscriptionImportService.ts, TranscriptionServiceV2.ts
- **Result**: ✅ Reasonable segment count, no crashes, but speed still wrong

**7. JUCE Backend Duration Ratio Fix (Attempt 7)**:
- **Problem**: Backend advanced `editedPosition` by raw sample time, ignoring duration ratios
- **Root Cause**: Line 280: `editedPosition += (double)samplesToRead / sampleRate`
- **Solution**: Applied duration ratio to position advancement:
  ```cpp
  double durationRatio = editedDuration / originalDuration;
  editedPosition += originalTimeAdvanced * durationRatio;
  ```
- **Files**: native/juce-backend/src/main.cpp
- **Result**: ❌ **Speed issue persists** - fundamental architectural problem remains

**8. Audio Playback Restoration Fix (Attempt 8 - September 2025)**:
- **Problem**: Audio loaded successfully but no position updates, causing complete playback failure
- **Root Cause Analysis**: JUCE backend entering "contiguous timeline" mode but segments array empty
  - Frontend sending EDL without segment data (only clip-level timing)
  - Backend expecting word-level segments for position tracking
  - Timer callbacks returning early due to missing segments
- **Technical Solution**:
  - **Frontend**: Modified JuceAudioManager to include segments array in EDL with word-level timing
  - **Backend**: Added safety check to prevent contiguous mode when segments missing
  - **Type Safety**: Updated EdlClip interface to include segments with proper TypeScript types
- **Files**:
  - `src/shared/types/transport.ts` - Added segments to EdlClip interface
  - `src/renderer/audio/JuceAudioManager.ts` - Build segments from clip words
  - `native/juce-backend/src/main.cpp` - Safety check + fallback segment creation
- **Result**: ✅ **Audio playback restored** - position updates working, word highlighting functional
- **Current Status**: ⚠️ **Audio plays but still at incorrect speed** - playback working but tempo issues remain

**9. JUCE Backend Crash Fix (Attempt 9 - Latest - September 2025)**:
- **Problem**: SIGSEGV crashes in JUCE backend and EPIPE errors when writing to crashed process
- **Root Cause Analysis**: Multiple memory safety issues in C++ backend
  - Division by zero when `originalDuration` was exactly 0.0 in audio calculations (line 288-300)
  - Invalid sample rate operations causing segmentation faults
  - Writing to stdin after process crash causing EPIPE errors
  - Missing null pointer checks and array bounds validation
- **Technical Solution**:
  - **Division by Zero Fix**: Added epsilon-based validation (`> 1e-9`) and ratio clamping (0.01-100.0)
  - **Memory Safety**: Added comprehensive null pointer checks and bounds validation
  - **Process Health Monitoring**: Enhanced stdin writability checks and process state validation
  - **Error Recovery**: Improved EPIPE error handling and graceful restart mechanisms
- **Files**:
  - `native/juce-backend/src/main.cpp` - Memory safety fixes and division by zero protection
  - `src/main/services/JuceClient.ts` - Process health monitoring and stdin validation
- **Result**: ✅ **JUCE backend stability improved** - no more crashes during transcription
- **Current Status**: ❌ **Audio playback still not functioning** - crashes resolved but playback remains broken

**10. Audio Path Resolution Fix (Attempt 10 - Latest - September 2025)**:
- **Problem**: Audio paths not resolving correctly - relative paths failing JUCE backend existence checks
- **Root Cause Analysis**: Path resolution system using hardcoded developer directories
  - UI passes relative paths like "Audio Files/ProjectName.wav" to audio system
  - JuceAudioManagerV2.resolveAudioPath() only searches fixed developer machine paths
  - When hardcoded paths fail, returns unresolved relative path to JUCE backend
  - Main process JuceClient.existsSync() fails for invalid relative paths
  - Result: Audio load requests rejected, playback remains disabled
- **Technical Solution**:
  - **Project Directory Integration**: Pass currentProjectPath from ProjectContext to audio managers
  - **Smart Path Resolution**: Use project directory to resolve relative paths to absolute paths
  - **Multiple Candidates**: Try various path structures (direct, "Audio Files" subfolder, etc.)
  - **Backward Compatibility**: Maintain existing fallback paths for migration
- **Files**:
  - `src/renderer/audio/JuceAudioManager.ts` - Added projectDirectory support and path resolution
  - `src/renderer/audio/JuceAudioManagerV2.ts` - Enhanced resolveAudioPath with project-relative resolution
  - `src/renderer/hooks/useAudioEditor.ts` - Pass projectDirectory option to audio managers
  - `src/renderer/components/AudioSystemIntegration.tsx` - Get currentProjectPath from context
- **Result**: ✅ **Path resolution improved** - relative paths now resolve to absolute paths
- **Current Status**: ❌ **Audio playback still not functioning** - path resolution fixed but deeper issues remain

**11. useAudioPlayback Project Directory Fix (Attempt 11 - Latest - September 2025)**:
- **Problem**: useAudioPlayback hook not passing project directory to JuceAudioManagerV2
- **Root Cause Analysis**: Critical missing parameter in playback hook initialization
  - useAudioEditor correctly passes projectDirectory to JuceAudioManager
  - useAudioPlayback creates JuceAudioManagerV2 with only callbacks, missing projectDirectory
  - JuceAudioManagerV2.projectDirectory remains undefined, path resolution falls back to hardcoded paths
  - JUCE backend refuses to load non-existent resolved paths, playback never becomes ready
- **Technical Solution**:
  - **Hook Signature Update**: Added projectDirectory parameter to useAudioPlayback
  - **Manager Instantiation Fix**: Pass options object with callbacks and projectDirectory
  - **Component Integration**: NewUIShellV2 passes currentProjectPath from ProjectContextV2
  - **Proper Re-initialization**: Added projectDirectory to useEffect dependency array with cleanup
- **Files**:
  - `src/renderer/hooks/useAudioPlayback.ts` - Added projectDirectory parameter and proper manager initialization
  - `src/renderer/components/ui/NewUIShellV2.tsx` - Pass currentProjectPath to useAudioPlayback hook
- **Result**: ✅ **useAudioPlayback now receives project directory** - path resolution should work in playback hook
- **Current Status**: ❌ **Audio playback still not functioning** - project directory integration complete but playback remains broken

**13. Comprehensive Path Resolution Infrastructure (Attempt 13 - Latest - September 2025)**:
- **Problem**: Audio playback failure despite extensive path resolution improvements
- **Root Cause Analysis**: Complete path resolution infrastructure implemented but playback still broken
  - All major path resolution components now functional: backend stability, project directory integration, Node.js path utilities
  - JuceAudioManagerV2 enhanced with sanitized relative path handling and proper candidate generation
  - Cross-platform path normalization and multiple fallback strategies implemented
  - Yet audio playback remains completely non-functional despite comprehensive path infrastructure
- **Technical Solution**:
  - **Enhanced Path API**: Refined electronAPI.path with better sanitization and normalization
  - **Improved Candidate Generation**: Multiple path resolution strategies with proper fallbacks
  - **Better Error Logging**: Enhanced debugging information for path resolution process
  - **Cross-Platform Compatibility**: Proper handling of Windows vs Unix path differences
- **Files**:
  - `src/main/preload.ts` - Enhanced path API exposure with better error handling
  - `src/renderer/audio/JuceAudioManagerV2.ts` - Improved path resolution with sanitized relative paths
- **Result**: ✅ **Comprehensive path resolution infrastructure complete** - all path-related components functional
- **Current Status**: ❌ **Audio playback still completely broken** - path resolution not the root cause

**14. Root Cause Fix: Main Process File Validation (Attempt 14 - Latest - September 2025)**:
- **Problem**: Audio loading failure at main process level due to fs.existsSync() blocking valid paths
- **Root Cause Discovery**: JuceClient.ts lines 53-54 using fs.existsSync() to reject paths before JUCE backend even receives them
  - Renderer resolves paths but main process immediately rejects them without attempting resolution
  - Main process lacks path resolution logic, causing valid audio files to be rejected
  - fs.existsSync() check happens before any attempt to resolve relative paths in main process context
- **Technical Solution**:
  - **Enhanced JuceAudioManagerV2**: Added comprehensive path validation using checkFileExists API before sending to main process
  - **JuceClient Path Resolution**: Implemented resolveAudioFilePath() method with fallback logic in main process
  - **Bidirectional Validation**: Both renderer and main process now validate and resolve paths independently
  - **Diagnostic Logging**: Added detailed logging to track path resolution pipeline from renderer → main process → JUCE backend
- **Files**:
  - `src/renderer/audio/JuceAudioManagerV2.ts` - Enhanced resolveAudioPath() with validation before sending to main process
  - `src/main/services/JuceClient.ts` - Added resolveAudioFilePath() method with comprehensive fallback resolution logic
- **Result**: ✅ **Path validation pipeline complete** - both renderer and main process validate file existence
- **Current Status**: ❌ **Audio playback still not functioning** - comprehensive path resolution implemented but playback remains broken

**15. Buffer Overflow Fix: JUCE stdin Communication (Attempt 15 - Latest - September 2025)**:
- **Problem**: Audio playback failure due to JUCE backend stdin buffer overflow when processing large EDL payloads
- **Root Cause Discovery**: Analysis of logs revealed stdin buffer overflow errors causing audio manager to never reach "ready" state
  - `🔥 JUCE Audio Error: JUCE transport error: Failed to write to JUCE stdin: buffer full`
  - Error cooldown preventing recovery even after buffer clears
  - 418 segments creating large JSON payload overwhelming 64KB default stdin buffer
- **Technical Solution**:
  - **Enhanced JuceClient.ts**: Implemented comprehensive stdin backpressure handling with drain event listeners
  - **Command Queue System**: Added retry logic with exponential backoff and proper flow control
  - **Smart Error Recovery**: Reduced cooldown for buffer errors (100ms) vs regular errors (1000ms)
  - **JUCE Backend Buffer**: Increased stdin buffer to 1MB to handle large EDL payloads
  - **Promise-based Commands**: Converted all JUCE commands to Promise-based API with proper error handling
- **Files**:
  - `src/main/services/JuceClient.ts` - Added backpressure handling, command queuing, and drain event management
  - `src/renderer/audio/JuceAudioManagerV2.ts` - Enhanced error recovery with buffer-specific cooldown logic
  - `native/juce-backend/src/main.cpp` - Increased stdin buffer from default 64KB to 1MB
- **Result**: ✅ **Buffer overflow protection complete** - stdin flow control and enhanced error recovery implemented
- **Current Status**: ✅ **Audio playback now working!** - buffer overflow fix successful, but playback is playing too fast in moments

#### 📊 **Current Operational State (September 2025 - Latest)**
- ✅ Application launches without crashes
- ✅ JUCE backend builds and initializes successfully
- ✅ No segmentation faults or EPIPE errors
- ✅ Audio loading and file access working properly
- ✅ **Audio playback functionality restored** - buffer overflow fix successful
- ⚠️ **Fast playback issue persists** - audio plays at incorrect tempo in moments (needs speed/sample rate investigation)
- ✅ **Path resolution infrastructure complete** - comprehensive cross-platform path handling implemented
- ✅ **Project directory integration** - both audio hooks receive proper project context
- ✅ **Node.js path utilities fully functional** - all path operations working correctly
- ✅ **Enhanced path candidate generation** - multiple fallback strategies implemented
- ❌ **Audio playback completely broken** - no sound output during transcription despite path fixes
- ❌ **Position tracking non-functional** - no position updates or word highlighting
- ❌ **Fundamental audio system failure** - core issue lies beyond path resolution architecture
- ✅ **Backend stability maintained** - no crashes, but audio functionality completely absent

#### ⚠️ **Critical Assessment (13 Attempts Complete)**
After 13 comprehensive attempts addressing every aspect of path resolution, backend stability, and infrastructure integration, **audio playback remains completely broken**. This definitively indicates the root cause lies in **fundamental audio system architecture** beyond path resolution:

**Path Resolution Infrastructure: ✅ COMPLETE**
- Backend memory safety and crash prevention
- Cross-platform path utilities and normalization
- Project directory integration across all components
- Multiple fallback strategies and candidate generation
- Enhanced error logging and debugging capabilities

**Remaining Issues: Core Audio System Architecture**
- Audio data flow between renderer and JUCE backend
- Transport protocol communication failures
- Audio format compatibility or conversion problems
- Buffer management and timing synchronization issues
- Fundamental audio pipeline architectural problems

#### 🔍 **Technical Details of Latest Fix**

**JUCE Backend Stabilization**:
```cpp
// Fixed sample rate initialization to prevent crashes
double sampleRate = 48000.0; // Default fallback, set dynamically in prepareToPlay

// Added safety checks in audio calculations
int64_t getNextReadPosition() const override {
  if (sampleRate <= 0.0) return 0;  // Prevent division by zero
  return (int64_t)(editedPosition * sampleRate);
}
```

**Build System Verification**:
- ✅ JUCE backend builds successfully
- ✅ Launch script always uses latest binaries
- ✅ No compilation or runtime crashes

#### 🎯 **Architecture Status**
**Audio Files System**: Projects save converted WAV audio (48kHz, 16-bit) to "Audio Files" folder alongside .transcript file. Path resolution and backend communication work correctly, but the final audio playback step remains problematic.

#### 🔮 **Next Investigation Areas**
After 8 comprehensive fix attempts, **playback is now functional** but speed issues remain:

1. **Audio Speed Analysis**: Now that playback works, focus on identifying why tempo is incorrect
   - Compare original audio file playback rate vs transcribed content timing
   - Analyze if gap-filling or segment timing is causing speed drift
2. **Sample Rate Verification**: Ensure frontend and backend agree on audio file sample rates
   - Verify 44.1kHz vs 48kHz handling across the entire pipeline
   - Check if resampling is introducing timing errors
3. **Timeline Synchronization**: Since position tracking works, investigate timing alignment
   - Compare original timestamps vs. edited timeline position mapping
   - Analyze if duration ratio calculations need refinement
4. **Segment Boundary Analysis**: With word-level data now flowing properly, debug segment timing
   - Verify word start/end times match actual audio content
   - Check if spacer gaps are being calculated correctly

**Commits Available**: All fix attempts committed to `codex/diagnose-audio-conversion-playback-issue` branch:
- f662c6b1: Initial explicit spacer creation attempt
- f5fe098: Ratio-preserving gap handling
- 9f0364d: JUCE backend duration ratio fix

For detailed technical information, see [ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md).

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

### v2.0 Glass Morphism System
- **Glass Dialog Components**: ImportDialogV2 and NewProjectDialogV2 with semi-transparent backgrounds
- **Backdrop Blur Effects**: `backdrop-filter: var(--backdrop-blur)` for professional frosted glass appearance
- **Consistent Opacity**: Unified opacity system across all glass components
- **CSS Variable Control**: Complete design system controllable via `src/renderer/styles/glass-dialogs.css`
- **Dynamic Transparency**: HSL-based color composition with separate opacity controls
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

- Spacer pills + gap playback
  - `SpacerNode` renders silent/music gaps as inline pills. Playback includes gaps — the JUCE EDL carries audio‑only segments so timing is continuous.
  - Pills are shown only for gaps ≥ 1.0s; sub‑1s are visually absorbed into neighboring text.
  - Trailing/intermediate gaps: pills attach after the preceding speech clip based on explicit audio‑only clips in edited array order.
  - Leading intro gap: exactly one pill attaches to the earliest-by-original‑time speech clip; it moves with that clip when dragged.
  - Pills highlight during playback and are keyboard‑selectable (select + delete removes them). Clicking a pill seeks to that gap.

- Highlight customization
  - Colors Panel includes a “Highlight Color” section (presets: Yellow, Amber, Lime, Cyan, Pink, Violet).
  - Highlights use CSS variables with automatic contrast (white/black text) for readability in Light/Dark transcript themes.

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

- Spacer pills
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

## Architecture v2.0

**Segment-Based Architecture with Main Process Authority**

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN PROCESS                             │
├─────────────────────────────────────────────────────────────┤
│ ProjectDataStore (Canonical State)                         │
│ ├── Clip validation and invariants                         │
│ ├── Atomic edit operations                                 │
│ ├── Event emission to renderer                             │
│ └── Operation history and undo                             │
├─────────────────────────────────────────────────────────────┤
│ IPC Handlers                                               │
│ ├── project:applyEdit                                      │
│ ├── project:getState                                       │
│ ├── project:loadIntoStore                                  │
│ └── Event broadcasting                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC Events
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  RENDERER PROCESS                          │
├─────────────────────────────────────────────────────────────┤
│ ProjectContext v2 (Thin Cache)                             │
│ ├── Dispatches operations to main                          │
│ ├── Subscribes to state updates                            │
│ ├── UI-specific state only                                 │
│ └── Optimistic updates with rollback                       │
├─────────────────────────────────────────────────────────────┤
│ Services Layer                                             │
│ ├── TranscriptionImportService                             │
│ ├── EDLBuilderService                                      │
│ └── JuceAudioManager v2                                    │
├─────────────────────────────────────────────────────────────┤
│ UI Components                                              │
│ ├── Lexical Editor with segment nodes                      │
│ ├── Edit operations plugin                                 │
│ └── Atomic operation hooks                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key v2.0 Components

**Main Process**:
- **ProjectDataStore**: Canonical state with validation and atomic operations
- **TranscriptionServiceV2**: Direct segment output without legacy conversion layers
- **EventEmitter Adapter**: Bridges TranscriptionServiceV2 events to IPC communication
- **IPC Handlers**: Structured edit operations and transcription management

**Renderer Process**:
- **ProjectContextV2**: Thin cache that dispatches to main process with real-time event listeners
- **NewUIShellV2**: Glass morphism interface with semi-transparent design
- **ImportDialogV2 & NewProjectDialogV2**: Glass-styled dialogs with smart import flow
- **TranscriptionImportService**: Clean import preserving original timestamps
- **EDLBuilderService**: Pure function EDL generation with binary search
- **JuceAudioManagerV2**: Simplified audio backend without fallback systems
- **Lexical Nodes v2**: WordNodeV2, SpacerNodeV2, ClipNodeV2 with segment awareness

**Recent Additions (September 2025)**:
- **EventEmitter Adapter**: Fixes "eventEmitter.emit is not a function" error
- **Glass Dialog System**: Semi-transparent UI components with backdrop blur
- **Comprehensive Debugging**: Full transcription chain visibility and error tracking
- **Event-Driven Progress**: Real-time transcription updates without polling
- **Audio Path Integration**: Complete frontend/backend audio path handling (playback still requires additional work)

For complete architectural details, see [ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md).

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

### Recent Changes (JUCE-only, Reordering, Mapping)

This project now runs a JUCE-only audio backend. The previous HTML `<audio>`-based `AudioManager` was removed in favor of a single, robust path via `JuceAudioManager`. Key behavior updates:

- JUCE-only backend
  - `JuceAudioManager` is the sole engine. The HTML `AudioManager` and its tests were removed.
  - The React hook `useAudioEditor` always constructs `JuceAudioManager`.

- Clip reordering and EDL application
  - EDL updates are sent as a contiguous edited timeline with per-clip original time metadata.
  - Seeks are deferred while an EDL is applying; they flush only after a real `edlApplied` event.
  - A short post-apply cooldown ignores stale position events (e.g., 0.0xx) to prevent UI regressions.
  - Bridge syncs (“Syncing clips to audio system”) are gated while an EDL is applying to avoid competing updates.

- Original vs edited time seeks (reordered timelines)
  - When the EDL reflects a reorder, the transport prefers original-domain seeks for correctness. Word clicks map to original time; JUCE then plays the correct content, and the UI maps position back to edited time for highlighting.

- Word deletion semantics (text-only)
  - Deleting words does not remove or compress audio. Total duration equals the sum of active clip durations.
  - EDLs no longer include per-word `deleted` arrays. Highlighting respects deleted words (they are not highlighted) while playback remains continuous.

- Audio-only segments
  - Audio-only clips (gaps, music cues, etc.) are fully included in time mapping and seeks. Word highlighting is suppressed in gaps by design.

Files most impacted:
- `src/renderer/audio/JuceAudioManager.ts` (EDL/seek ordering, apply discipline, original-time seek preference, sequencer sync)
- `src/renderer/hooks/useAudioEditor.ts` (JUCE-only)
- `src/renderer/components/AudioSystemIntegration.tsx` (clip sync gating while EDL applying)
- `src/renderer/editor/plugins/AudioSyncPlugin.tsx` (deleted-word aware highlighting)
- Removed: `src/renderer/audio/AudioManager.ts` and its HTML-audio tests


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

### ✅ v2.0 EventEmitter Fix & Import Process Enhancement (September 2025 - Latest)

**Complete Import System Overhaul**: Fixed critical "eventEmitter.emit is not a function" error and implemented comprehensive debugging throughout the transcription chain.

#### **🎯 Critical Bug Fixed**
- **Issue**: TranscriptionServiceV2 expected EventEmitter with `emit()` method but received App instance using `webContents.send()`
- **Solution**: Created EventEmitterAdapter that bridges TranscriptionServiceV2 events to IPC communication
- **Impact**: Transcription import process now works end-to-end without errors

#### **🔧 Technical Implementation**
**EventEmitter Adapter** (`src/main/main.ts:1467-1488`):
```typescript
class EventEmitterAdapter {
  emit(event: string, data: any): void {
    switch (event) {
      case 'transcription:progress':
        this.app.mainWindow?.webContents.send('transcription-progress', data);
        break;
      case 'transcription:completed':
        this.app.mainWindow?.webContents.send('transcription-complete', data);
        break;
      case 'transcription:error':
        this.app.mainWindow?.webContents.send('transcription-error', data);
        break;
    }
  }
}
```

**Enhanced API Key Management**:
- Fixed API key loading in TranscriptionServiceV2 to use proper decryption methods
- Added setApiKeys() method for cloud service integration
- Proper error handling for missing or invalid keys

**Comprehensive Debugging Chain**:
- **App.tsx**: Detailed logging for handleAudioImported function
- **ProjectContextV2**: Debug output for startTranscription with availability checks
- **TranscriptionServiceV2**: Full job lifecycle logging with progress tracking
- **Main.ts IPC handlers**: Complete IPC communication debugging

#### **🚀 Benefits**
- **Working Import Process**: Audio import and transcription now functions correctly
- **Real-time Progress**: Event-driven progress updates without polling
- **Enhanced Debugging**: Full visibility into transcription chain for troubleshooting
- **Stable Architecture**: Direct v2.0 implementation without wrapper layers

### 🔧 Audio Path Integration Work (September 2025 - Latest)

**Comprehensive Audio Path Implementation**: Complete frontend and backend integration for audio path persistence through transcription workflow, addressing the root cause of missing audio playback.

#### **🎯 Problem Identified**
Audio playback was failing because:
- **Frontend Path Access**: Code was accessing wrong path (`projectData.audioPath` vs `projectData.project.audio.originalFile`)
- **Missing Backend Storage**: Transcription completion never saved the audio file path to project metadata
- **Path Flow Broken**: Audio path lost between transcription start and completion

#### **🔧 Frontend Fixes Implemented**
**Path Access Correction** (NewUIShellV2.tsx):
```typescript
// FIXED: Changed from wrong path to correct TypeScript interface path
// OLD: projectState.projectData?.audioPath
// NEW: projectState.projectData?.project?.audio?.originalFile
```

**Audio Path State Management** (ProjectContextV2.tsx):
- Added `transcriptionAudioPath` state to store file path during transcription
- Enhanced `startTranscription` to preserve audio file path
- Updated `handleTranscriptionComplete` to pass stored path to backend
- Added comprehensive cleanup in all error scenarios

**Enhanced Error Handling**:
- Defensive checks for missing audio metadata
- Better error messages with specific file paths
- Warnings when projects have clips but no audio path

#### **🔧 Backend Fixes Implemented**
**IPC Handler Enhancement** (main.ts:1564-1591):
```typescript
// FIXED: Backend now properly processes audioPath parameter
const properAudioMetadata = {
  originalFile: audioMetadata.audioPath || audioMetadata.fileName || 'unknown',
  originalName: audioMetadata.fileName || 'Untitled Audio',
  // ... complete AudioMetadata structure
};
```

**Audio Metadata Processing**:
- Enhanced `transcription:importV2` IPC handler to accept `audioPath` parameter
- Maps frontend `audioPath` to proper `project.audio.originalFile` structure
- Added comprehensive logging for audio metadata processing

#### **🚀 Implementation Status**
**✅ Completed Work**:
- Frontend audio path access corrected (4 locations)
- Backend audio path storage implemented
- Complete transcription flow path preservation
- Comprehensive error handling and cleanup
- Defensive programming for missing metadata

**❌ Current Status**:
- Audio playback still not functional despite complete path integration
- Additional investigation required beyond path handling
- May require deeper JUCE backend or audio manager fixes

#### **🔍 Next Steps Required**
The path integration work is complete but playback requires additional investigation:
1. **JUCE Backend Initialization**: May need JUCE-specific audio loading fixes
2. **Audio Manager State**: Possible audio manager initialization issues
3. **File Access**: Verify file permissions and accessibility
4. **Project Structure**: Investigate if project format affects audio loading

### ✅ Enhanced Speaker Tracking & Auto-Save Improvements (September 2025 - Latest)

**Advanced Speaker Intelligence**: Complete implementation of diarized speaker metadata propagation with deferred auto-save after clip normalization.

#### **🎯 Key Features**

**Enhanced Speaker Tracking**:
- **Diarized Speaker Metadata**: Automatic propagation of speaker segments from transcription services
- **Speaker Segment Summaries**: Intelligent aggregation of speaker segments with duration tracking
- **Cross-Job Speaker Persistence**: Speaker names and mappings persist across transcription jobs
- **Robust Speaker Directory**: Global speaker directory with automatic merging and conflict resolution

**Intelligent Auto-Save System**:
- **Deferred Auto-Save**: Auto-save triggers after clip normalization completes, preventing race conditions
- **Normalization Tracking**: `normalizedAt` timestamp tracks when jobs have been processed into clips
- **Conditional Save Logic**: Auto-save only occurs for newly completed jobs that haven't been normalized yet
- **Memory-Efficient Processing**: Prevents redundant clip generation and duplicate auto-saves

#### **🔧 Technical Implementation**

**Speaker Metadata Propagation**:
```typescript
// Enhanced speaker metadata building in main.ts
const buildSpeakerMetadata = (segments: any[] = []): {
  speakers: { [key: string]: string };
  speakerSegments: SpeakerSegmentSummary[]
} => {
  // Intelligent speaker labeling and segment aggregation
  // Automatic fallback speaker generation when metadata missing
  // Continuous speaker segment creation with word count tracking
};
```

**Auto-Save Integration**:
```typescript
// Deferred auto-save in App.tsx
useEffect(() => {
  if (pendingAutoSaveJobId && selectedJob?.id === pendingAutoSaveJobId) {
    if (selectedJob.normalizedAt) {
      // Job has been normalized, trigger auto-save
      handleSave();
      setPendingAutoSaveJobId(null);
    }
  }
}, [selectedJob?.normalizedAt, pendingAutoSaveJobId]);
```

**Speaker Directory Management**:
```typescript
// Enhanced TranscriptionContext with speaker persistence
case 'COMPLETE_JOB': {
  const updatedSpeakerDirectory = { ...state.speakerDirectory };
  if (completedSpeakerMap) {
    Object.entries(completedSpeakerMap).forEach(([speakerId, speakerName]) => {
      if (speakerName && speakerName.trim().length > 0) {
        updatedSpeakerDirectory[speakerId] = speakerName;
      }
    });
  }
  // Merge speaker segments and update global directory
};
```

#### **🎵 User Experience Benefits**

**Seamless Speaker Management**:
- **Automatic Speaker Detection**: Transcription services provide speaker diarization automatically
- **Persistent Speaker Names**: Once named, speakers persist across all project transcriptions
- **Smart Speaker Merging**: Intelligent merging of speaker metadata from different sources
- **Visual Speaker Segments**: Clear visualization of speaker segments with duration and word counts

**Reliable Auto-Save**:
- **No Lost Work**: Auto-save ensures transcription results are always preserved
- **Performance Optimized**: Deferred save prevents UI blocking during clip normalization
- **Race Condition Free**: Proper sequencing prevents save conflicts and data corruption
- **Status Tracking**: Clear indication when projects have been auto-saved

#### **🏗️ Technical Architecture**

**Enhanced Data Types**:
```typescript
interface SpeakerSegmentSummary {
  speaker: string;
  start: number;
  end: number;
  text: string;
  segmentIds: (number | string)[];
  wordCount: number;
}

interface TranscriptionJob {
  // ... existing fields
  normalizedAt?: string | null;        // New: tracks normalization completion
  speakerSegments?: SpeakerSegmentSummary[];  // New: speaker segment summaries
}
```

**Improved Cloud Transcription**:
- **Enhanced Whisper Service**: Better speaker diarization and metadata extraction
- **Robust Error Handling**: Comprehensive error recovery for cloud transcription failures
- **Progress Tracking**: Detailed progress updates including speaker detection phases
- **Service Compatibility**: Works with OpenAI, AssemblyAI, and Rev.ai transcription services

#### **🚀 Performance Improvements**

**Memory Efficiency**:
- **Smart Clip Generation**: Only generates clips once per transcription job
- **Efficient Speaker Storage**: Compact speaker directory with automatic cleanup
- **Reduced Redundancy**: Eliminates duplicate clip normalization and saves

**Processing Pipeline**:
```
Transcription Complete → Speaker Metadata Extraction →
Job Completion Event → Clip Normalization →
Auto-Save Trigger → Project Persistence
```

**Developer Benefits**:
- **Comprehensive Logging**: Detailed debug output for speaker tracking and auto-save flow
- **Type Safety**: Full TypeScript coverage for new speaker and auto-save interfaces
- **Error Recovery**: Graceful handling of speaker metadata and save failures
- **Testing Support**: Robust state management enables comprehensive testing

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
