# TranscriptionProject v2.0 Architecture

## Overview

TranscriptionProject v2.0 represents a complete architectural refactoring focused on **data integrity**, **simplicity**, and **scalability**. The new architecture eliminates timestamp mutations, implements canonical state management, and provides a clean foundation for future development.

## Core Principles

### 1. **Data Integrity First**
- **NEVER modify original word timestamps** - preserve exact transcription service output
- **Explicit gap tracking** - spacer segments instead of timestamp stretching
- **Invariant validation** - segments must cover [0, clipDuration] exactly
- **Atomic operations** - all edits validated before application

### 2. **Main Process Authority**
- **Canonical state** lives in main process (`ProjectDataStore`)
- **Renderer as thin cache** - dispatches operations, subscribes to updates
- **Validation at the boundary** - all operations validated before state changes
- **Event-driven updates** - changes broadcast to all renderer processes

### 3. **Segment-Based Architecture**
- **Unified segment model** - `WordSegment | SpacerSegment` union type
- **Clip-relative timing** - segments positioned relative to clip start
- **Complete coverage** - segments cover clip duration exactly
- **Binary search optimization** - efficient lookup for large projects

### 4. **Clean Separation of Concerns**
- **No fallback systems** - single implementation path for each feature
- **Pure function design** - EDL building with no side effects
- **Atomic edit operations** - structured operations with undo support
- **Clear abstractions** - each layer has well-defined responsibilities

## Architecture Overview

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

## Key Components

### Main Process

#### ProjectDataStore
- **Purpose**: Owns canonical project state and enforces invariants
- **Location**: `src/main/services/ProjectDataStore.ts`
- **Key Features**:
  - Validates all clips before state changes
  - Implements atomic edit operations
  - Maintains operation history for undo
  - Emits events to renderer processes
  - Prevents timeline overlaps and gaps

#### IPC Handlers
- **Purpose**: Bridge between renderer and main process
- **Location**: `src/main/main.ts`
- **Operations**:
  - `project:applyEdit` - Apply structured edit operations
  - `project:getState` - Get current project state
  - `project:loadIntoStore` - Load project with validation
  - Event broadcasting for state updates

### Renderer Process

#### ProjectContext v2
- **Purpose**: Thin cache that dispatches to main process
- **Location**: `src/renderer/contexts/ProjectContextV2.tsx`
- **Key Features**:
  - Dispatches edit operations to main
  - Subscribes to authoritative updates
  - Maintains only UI-specific state
  - Provides React hooks for components

#### Services Layer

##### TranscriptionImportService
- **Purpose**: Clean import without timestamp mutation
- **Location**: `src/renderer/services/TranscriptionImportService.ts`
- **Key Features**:
  - Preserves original word timestamps
  - Creates explicit spacer segments
  - Builds clips with segment arrays
  - Validates import consistency

##### EDLBuilderService
- **Purpose**: Pure function EDL generation for JUCE
- **Location**: `src/renderer/services/EDLBuilderService.ts`
- **Key Features**:
  - Binary search optimization
  - Segment metadata for highlighting
  - Dual timeline mapping (original ↔ contiguous)
  - EDL validation and debugging

##### JuceAudioManager v2
- **Purpose**: Simplified JUCE integration
- **Location**: `src/renderer/audio/JuceAudioManagerV2.ts`
- **Key Features**:
  - Single event handling path
  - Uses EDLBuilderService for clean EDL
  - Segment-aware highlighting
  - No fallback polling systems

#### UI Components

##### Lexical Nodes v2
- **WordNode v2**: Segment-aware word nodes with original timing
- **SpacerNode v2**: Clean spacer representation with seek support
- **ClipNode v2**: Container for segment collections

##### Edit Operations System
- **useEditOperations**: React hook for atomic operations
- **EditOperationsPlugin**: Bridges UI interactions to operations
- **Atomic validation**: Operations validated before application

## Data Flow

### 1. Import Flow
```
Raw Transcription → TranscriptionImportService → Segment Arrays →
ProjectDataStore Validation → Canonical State → Renderer Update
```

### 2. Edit Operation Flow
```
UI Interaction → Edit Operation → ProjectDataStore Validation →
State Update → Event Broadcast → Renderer Reconciliation
```

### 3. Audio Playback Flow
```
Clips → EDLBuilderService → Optimized EDL → JUCE Backend →
Position Events → Segment Lookup → UI Highlighting
```

## Data Structures

### Segment Union Type
```typescript
type Segment = WordSegment | SpacerSegment;

interface WordSegment {
  type: 'word';
  id: string;
  start: number;           // Clip-relative time
  end: number;             // Clip-relative time
  text: string;
  confidence: number;
  originalStart: number;   // Preserved original timing
  originalEnd: number;     // Preserved original timing
}

interface SpacerSegment {
  type: 'spacer';
  id: string;
  start: number;           // Clip-relative time
  end: number;             // Clip-relative time
  duration: number;
  label?: string;
}
```

### Clip Structure
```typescript
interface Clip {
  id: string;
  speaker: string;
  startTime: number;       // Absolute timeline position
  endTime: number;         // Absolute timeline position
  duration: number;        // endTime - startTime
  segments: Segment[];     // Ordered segments covering [0, duration]
  type: 'speaker-change' | 'paragraph-break' | 'user-created' | 'transcribed';
  createdAt: number;
  modifiedAt: number;
  order: number;           // For clip reordering
  status: 'active' | 'deleted';
}
```

### Edit Operations
```typescript
interface EditOperation {
  id: string;
  type: EditOperationType;
  timestamp: number;
  data: EditOperationData;
}

type EditOperationType =
  | 'splitClip'
  | 'mergeClips'
  | 'deleteClip'
  | 'reorderClips'
  | 'insertSpacer'
  | 'editWord'
  | 'changeSpeaker';
```

## Key Benefits

### Data Integrity
- **Original timestamps preserved** - can always trace back to source
- **No timestamp corruption** - explicit gaps instead of stretching
- **Validation at boundaries** - prevents invalid state
- **Atomic operations** - no partial updates

### Performance
- **Binary search** - O(log n) segment lookup vs O(n) iteration
- **Optimized EDL** - efficient JUCE communication
- **Event-driven updates** - only send changes, not full state
- **Segment caching** - pre-built lookup tables

### Maintainability
- **Clear separation** - main process authority, renderer cache
- **Pure functions** - predictable behavior, easy testing
- **Atomic operations** - structured, undoable changes
- **No fallbacks** - single implementation path

### Scalability
- **Efficient large projects** - binary search scales well
- **Memory efficient** - segments instead of duplicate data
- **Extensible operations** - easy to add new edit types
- **Multi-window ready** - canonical state in main process

## Migration Strategy

### Breaking Changes
- **Complete data model change** - segments replace words/tokens
- **New project format** - v2.0 projects incompatible with v1.x
- **No backward compatibility** - clean slate approach
- **API changes** - new hooks and service interfaces

### Developer Benefits
- **Type safety** - comprehensive TypeScript coverage
- **Debug support** - rich logging and validation
- **Testing** - pure functions easy to test
- **Documentation** - comprehensive architecture docs

## Future Enhancements

### Ready for Extension
- **Advanced edit operations** - boundary nudging, time stretching
- **Multi-track support** - segment model scales to multiple tracks
- **Collaborative editing** - main process authority enables sync
- **Plugin system** - clean operation interfaces

### Performance Optimizations
- **Virtual scrolling** - segment model supports large transcripts
- **Incremental updates** - only changed segments re-render
- **Web Workers** - computation can be moved off main thread
- **Caching strategies** - segment lookup tables can be cached

This architecture provides a solid foundation for the next generation of TranscriptionProject, with clean abstractions, data integrity, and room for future growth.