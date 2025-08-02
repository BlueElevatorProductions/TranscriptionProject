# Refactoring Migration Guide

## Overview

This guide documents the refactoring of TranscriptionProject from a monolithic App.tsx with extensive prop drilling to a modular, context-based architecture with separated concerns.

## Key Improvements

### 1. **State Management Centralization**
- **Before**: 18+ useState hooks in App.tsx with extensive prop drilling
- **After**: 3 context providers with useReducer pattern
  - `AudioContext` - Centralized audio state with validation
  - `ProjectContext` - Project data, speakers, segments management  
  - `TranscriptionContext` - Job lifecycle and progress tracking

### 2. **Component Modularization**  
- **Before**: 600+ line App.tsx handling everything
- **After**: Separated into focused view components
  - `HomeView` - Landing page and job selection
  - `TranscriptionProgressView` - Progress tracking
  - `SpeakerIdentificationView` - Speaker naming workflow
  - `PlaybackView` - Dual-mode transcription interface

### 3. **Type Safety Improvements**
- **Before**: `any` types and loose interfaces
- **After**: 200+ lines of comprehensive TypeScript interfaces
- Strict mode enabled with full type coverage

### 4. **Architecture Benefits**
- **Reduced Props**: Components receive 2-4 props instead of 8-9
- **Better Testing**: Isolated contexts and pure components
- **Improved Performance**: Selective re-renders and memoization
- **Enhanced Debugging**: Context debug panel and structured logging

## Migration Steps

### Phase 1: Backup and Setup
```bash
# Backup current App.tsx
cp src/renderer/App.tsx src/renderer/App.backup.tsx

# Current files are ready to use:
# - src/renderer/contexts/ (all context providers)
# - src/renderer/views/ (modular view components)  
# - src/renderer/types/index.ts (comprehensive types)
# - src/renderer/AppRefactored.tsx (new App component)
```

### Phase 2: Switch to Refactored Version
```bash
# Replace App.tsx with refactored version
mv src/renderer/App.tsx src/renderer/App.legacy.tsx
mv src/renderer/AppRefactored.tsx src/renderer/App.tsx
```

### Phase 3: Update Component Imports
Update any components that directly import App.tsx or rely on its exports.

### Phase 4: Test Migration
1. **Start Development Server**: `npm run start-dev`
2. **Test Core Workflows**:
   - File import and transcription
   - Speaker identification
   - Playback mode functionality
   - Transcript editing
   - Project save/load
3. **Verify State Persistence**: Check that audio state, project data persist correctly

## Context Usage Examples

### AudioContext
```typescript
import { useAudio } from './contexts';

const MyComponent = () => {
  const { state, actions } = useAudio();
  
  return (
    <button onClick={() => actions.play()}>
      {state.isPlaying ? 'Pause' : 'Play'}
    </button>
  );
};
```

### ProjectContext
```typescript
import { useProject, useSpeakers } from './contexts';

const SpeakerComponent = () => {
  const { speakers, updateSpeakers } = useSpeakers();
  
  const handleSpeakerEdit = (id: string, name: string) => {
    updateSpeakers({ ...speakers, [id]: name });
  };
  
  return <div>/* Speaker editing UI */</div>;
};
```

### TranscriptionContext
```typescript
import { useTranscriptionJobs } from './contexts';

const JobsList = () => {
  const { jobs, selectJob } = useTranscriptionJobs();
  
  return (
    <div>
      {jobs.map(job => (
        <div key={job.id} onClick={() => selectJob(job)}>
          {job.fileName} - {job.status}
        </div>
      ))}
    </div>
  );
};
```

## Legacy Compatibility

The refactored version includes legacy compatibility hooks to ease migration:

```typescript
// For components not yet migrated
import { useLegacyAudioState, useLegacyProjectState } from './contexts';

const LegacyComponent = () => {
  const { sharedAudioState, handleAudioStateUpdate } = useLegacyAudioState();
  const { editedSegments, handleSegmentUpdate } = useLegacyProjectState();
  
  // Existing component code works unchanged
};
```

## Performance Improvements

### Before (App.tsx)
- **Bundle Size**: Large single component
- **Re-renders**: Entire app re-renders on any state change
- **Props**: 8-9 props passed down 3-4 levels
- **State Updates**: Complex dependencies cause unnecessary renders

### After (Refactored)
- **Bundle Size**: Code splitting by context and view
- **Re-renders**: Only affected components re-render
- **Props**: 2-4 props per component maximum
- **State Updates**: Isolated updates with memoized selectors

## Debugging Tools

### Context Debug Panel
```typescript
import { ContextDebugPanel } from './contexts';

// Add to App component for development
<AppProviders>
  <AppCore />
  <ContextDebugPanel /> {/* Shows all context state */}
</AppProviders>
```

### Audio Debug Hook
```typescript
import { useAudioDebug } from './contexts';

const AudioDebugComponent = () => {
  const debug = useAudioDebug();
  console.log('Audio state validity:', debug.isValid);
  console.log('Formatted state:', debug.summary.formatted);
};
```

## Common Migration Issues

### 1. **Props Interface Changes**
**Problem**: Components expect old prop names
**Solution**: Use legacy compatibility hooks temporarily

### 2. **State Access Patterns**
**Problem**: Direct state access patterns changed
**Solution**: Replace with context hooks

```typescript
// Before
const [speakers, setSpeakers] = useState({});

// After  
const { speakers, updateSpeakers } = useSpeakers();
```

### 3. **Event Handler Patterns**
**Problem**: Event handlers passed as props
**Solution**: Use context actions directly

```typescript
// Before
<Component onSpeakerUpdate={handleSpeakerUpdate} />

// After - Component uses context internally
<Component />
```

## Testing Strategy

### Unit Tests
```typescript
// Test context providers in isolation
import { renderHook } from '@testing-library/react';
import { AudioProvider, useAudio } from './contexts/AudioContext';

test('audio context provides correct initial state', () => {
  const { result } = renderHook(() => useAudio(), {
    wrapper: AudioProvider,
  });
  
  expect(result.current.state.isPlaying).toBe(false);
  expect(result.current.state.volume).toBe(0.7);
});
```

### Integration Tests
```typescript
// Test view components with context
import { render } from '@testing-library/react';
import { AppProviders } from './contexts';
import HomeView from './views/HomeView';

test('home view renders with context', () => {
  render(
    <AppProviders>
      <HomeView onImportClick={() => {}} onJobSelect={() => {}} />
    </AppProviders>
  );
});
```

## Rollback Plan

If issues arise, rollback is simple:

```bash
# Restore original App.tsx
mv src/renderer/App.tsx src/renderer/App.refactored.tsx
mv src/renderer/App.legacy.tsx src/renderer/App.tsx

# Remove new files (optional)
rm -rf src/renderer/contexts/
rm -rf src/renderer/views/
rm src/renderer/types/index.ts
```

## Future Enhancements

With the new architecture, these improvements become easier:

1. **Redux DevTools Integration**: Add Redux DevTools for better debugging
2. **React Query**: Add for server state management  
3. **Virtualization**: Implement react-window for large transcripts
4. **Code Splitting**: Lazy load views and contexts
5. **Testing**: Comprehensive unit and integration tests
6. **Performance Monitoring**: Add React Profiler integration

## Conclusion

This refactoring significantly improves maintainability, testability, and performance while maintaining full backward compatibility. The modular architecture makes future development much more manageable and follows React best practices.