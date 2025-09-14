**Editing + Audio Integration Cheat Sheet**

- Scope: How Lexical text editing maps to audio clips and the JUCE backend.
- Key files: `src/renderer/editor/LexicalTranscriptEditor.tsx`, `src/renderer/editor/utils/converters.ts`, `src/renderer/components/AudioSystemIntegration.tsx`, `src/renderer/hooks/useAudioEditor.ts`, `src/renderer/audio/JuceAudioManager.ts`, `src/shared/types/transport.ts`, `src/main/preload.ts`, `src/main/services/JuceClient.ts`.

**Architecture Overview**
- Editor: Lexical-based editor renders clips as containers with word nodes (`WordNode`) that carry absolute word timestamps.
- Project Store: `ProjectContext` keeps `projectData.clips.clips` as the single source of truth; editor writes back via `onClipsChange`.
- Audio Hook: `useAudioEditor` provides `audioState` + `audioActions` and wraps `JuceAudioManager` when `VITE_USE_JUCE=true`.
- JUCE Transport: Preload exposes `window.juceTransport` which sends `load/updateEdl/play/seek/...` and receives `loaded/state/position`.
- Sequencer: `SimpleClipSequencer` converts between edited time and original audio time for reordered clips.

**Data Model (Renderer)**
- `Clip`: `{ id, speaker, startTime, endTime, words[], text, duration, order, status, type }`.
- `Word`: `{ word, start, end, score? }` with absolute times in original audio.
- Gaps: `type: 'audio-only'` are audio segments with no words; rendered as UI-only spacer pills (`SpacerNode`) in the editor.
- Modes: `listen` (readOnly; never mutates structure) vs `edit` (allows structural changes).

**EDL Model (JUCE)**
- `EdlClip`: `{ id, startSec, endSec, order, deleted?[] }` plus optional `{ originalStartSec, originalEndSec }` when clips are reordered.
- Original order: `startSec/endSec` use original timestamps.
- Reordered: contiguous edited timeline is synthesized; original positions are included for mapping/highlighting.

**Action Flow (Edit → Audio)**
- User edits in Lexical → `editorStateToClips` rebuilds `Clip[]` from `ClipContainerNode`s.
- `LexicalTranscriptEditor` calls `onClipsChange(allClips)` (preserves `audio-only` gaps; renumbers `order`).
- `ProjectContext.actions.updateProjectData` writes to `projectData.clips.clips` and marks unsaved changes.
- `AudioSystemIntegration` de-dupes changes and calls `audioActions.updateClips(normalizeClipsForAudio(clips))`.
- `JuceAudioManager.updateClips` updates internal state and calls `pushEdl()` → `juceTransport.updateEdl(...)`.

**Action Flow (Playback → Highlighting)**
- JUCE emits `position { editedSec, originalSec }` via preload → `JuceAudioManager.onTransportEvent`.
- Highlighting uses `currentOriginalTime` only. `AudioSyncPlugin` marks the `WordNode` where `start ≤ originalSec ≤ end`.
- Auto-scroll throttled; clicking a word seeks using a small bias (`-10ms`) to avoid boundary “ended” blips.

**Reordering + EDL Rules**
- `order` is authoritative for visual/edited order; always renumber sequentially after edits.
- Reordered detection: if `startTime` decreases across ordered clips, use contiguous edited timestamps.
- Contiguous mapping: synthesize `startSec/endSec` by accumulating durations; also include `originalStartSec/originalEndSec` for JUCE.
- Sequencer: `editedTime ↔ originalTime` conversion comes from `SimpleClipSequencer` based on `order` and per-clip durations.

**Deletions + Merges**
- Clip delete: set `status='deleted'` (hidden in Listen mode). Active IDs tracked in audio state.
- Word delete: `deletedWordIds` set by word ID (`clipId-word-N`); EDL `deleted[]` carries indices per-clip to JUCE.
- Merges: `ClipSpeakerPlugin` supports Merge Above/Below; merges speech clips, skips gaps, splices inclusive range, renumbers `order`.

**Gaps + Spacers**
- Gap generation lives in audio state (`generateGapClips/createContinuousClips`), ensuring EDL continuity.
- Editor renders gaps as inline spacer pills (`SpacerNode`) after the previous speech clip; leading intro gap attaches to the earliest speech clip.
- Spacers are UI-only and do not modify `Clip[]` or EDL; clicking seeks in Listen mode.

**Suppression + De‑dupe Guards**
- Editor suppresses `onClipsChange` when: readOnly (Listen), during drag, or while audio is playing.
- `AudioSystemIntegration` hashes `(id:order:type:speaker:start:end:words.length)` and skips duplicate `updateClips` calls to avoid playback glitches.

**Key Events + Hooks**
- DOM events from editor/plugins: `clip-reorder`, `clip-drag-start`, `clip-drag-end`, `clips-updated`, `speaker-change-clip`, `audio-seek-to-time`.
- `useClipEditor` centralizes split/merge/delete/reorder and word delete/restore; emits `clips-updated` for portal refresh.

**Where To Tweak What**
- Text parsing/render: `converters.ts` (`clipsToEditorState`, `editorStateToClips`).
- UI behavior for speaker/clip menu: `ClipSpeakerPlugin.tsx`.
- Playback/EDL mapping: `JuceAudioManager.pushEdl`, `SimpleClipSequencer`.
- Suppression/flow control: `LexicalTranscriptEditor.tsx` and `AudioSystemIntegration.tsx`.

**Debugging**
- Enable `VITE_AUDIO_DEBUG=true` for verbose logs; `VITE_AUDIO_TRACE=true` for detailed flow traces.
- Inspect EDL logs in console before `updateEdl` (first 5 entries logged with original vs contiguous times).
- Common gotchas: non-finite times, zero/negative durations, non-sequential `order`, sending updates during playback.

**Quick Recipes**
- Change speaker across clips: use `ClipSpeakerPlugin` dropdown; updates project and audio in one pass.
- Merge with gap in between: Merge Above/Below skips `audio-only`; renumbers `order`; sends new EDL.
- Seek to word: click a word (Listen mode) → seeks to `start-10ms` and optionally auto-plays.

