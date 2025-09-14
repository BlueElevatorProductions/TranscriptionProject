/**
 * useClipEditor.ts - High-level clip editing API built on top of useAudioEditor.
 *
 * Provides unified methods for splitting, merging, deleting, reordering clips,
 * and deleting/restoring words. Intended to centralize clip editing logic.
 */

import { useMemo, useRef } from 'react';
import { AudioEditorActions, AudioEditorState } from './useAudioEditor';
import { generateWordId, generateClipId } from '../audio/AudioAppState';
import { SimpleUndoManager } from '../audio/SimpleUndoManager';

/** API for clip-level editing operations. */
export interface ClipEditorActions {
  /** Split the clip at the given word index. */
  splitClip(clipId: string, wordIndex: number): void;
  /** Merge two adjacent clips into one. */
  mergeClips(firstClipId: string, secondClipId: string): void;
  /** Merge multiple clips into one (in visual order). */
  mergeMultipleClips(clipIds: string[]): void;
  /** Set the style for a specific clip. */
  setClipStyle(clipId: string, style: import('../types').ClipStyle): void;
  /** Change the speaker assignment for a specific clip. */
  changeSpeaker(clipId: string, newSpeakerId: string): void;
  /** Delete (hide) an entire clip from the edited timeline. */
  deleteClip(clipId: string): void;
  /** Move a clip from one index to another in the edited sequence. */
  reorderClips(fromIndex: number, toIndex: number): void;
  /** Delete (hide) specific words within a clip. */
  deleteWords(clipId: string, wordIndices: number[]): void;
  /** Restore previously deleted words within a clip. */
  restoreWords(clipId: string, wordIndices: number[]): void;
  /** Undo the last clip editing operation. */
  undo(): void;
  /** Redo the last undone operation. */
  redo(): void;
  /** Whether an undo operation is available. */
  canUndo(): boolean;
  /** Whether a redo operation is available. */
  canRedo(): boolean;
}

/**
 * Hook that wraps audioActions to expose high-level clip editing methods.
 * Implementation stubs are provided for split/merge; delete/reorder delegate directly.
 */
export function useClipEditor(
  audioState: AudioEditorState,
  audioActions: AudioEditorActions
): ClipEditorActions {
  const undoManagerRef = useRef(new SimpleUndoManager());
  const undoMgr = undoManagerRef.current;
  return useMemo(
    () => ({
      splitClip: (clipId: string, wordIndex: number) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Split clip ${clipId} at word ${wordIndex}`
        );
        const clips = [...audioState.clips];
        const idx = clips.findIndex(c => c.id === clipId);
        if (idx === -1) return;
        const clip = clips[idx];
        const beforeWords = clip.words.slice(0, wordIndex);
        const afterWords = clip.words.slice(wordIndex);
        if (beforeWords.length === 0 || afterWords.length === 0) return;
        const now = Date.now();
        const first: typeof clip = {
          ...clip,
          id: generateClipId(clip.id),
          words: beforeWords,
          startTime: clip.startTime,
          endTime: beforeWords[beforeWords.length - 1].end,
          startWordIndex: clip.startWordIndex,
          endWordIndex: clip.startWordIndex + beforeWords.length - 1,
          duration: beforeWords[beforeWords.length - 1].end - clip.startTime,
          text: beforeWords.map(w => w.word).join(' '),
          createdAt: now,
          modifiedAt: now,
          type: 'user-created',
        };
        const second: typeof clip = {
          ...clip,
          id: generateClipId(clip.id),
          words: afterWords,
          startTime: afterWords[0].start,
          endTime: clip.endTime,
          startWordIndex: clip.startWordIndex + wordIndex,
          endWordIndex: clip.endWordIndex,
          duration: clip.endTime - afterWords[0].start,
          text: afterWords.map(w => w.word).join(' '),
          createdAt: now,
          modifiedAt: now,
          type: 'user-created',
        };
        clips.splice(idx, 1, first, second);
        audioActions.updateClips(clips);
      },
      mergeClips: (firstClipId: string, secondClipId: string) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Merge clips ${firstClipId} + ${secondClipId}`
        );
        const clips = [...audioState.clips];
        const i1 = clips.findIndex(c => c.id === firstClipId);
        const i2 = clips.findIndex(c => c.id === secondClipId);
        if (i1 === -1 || i2 === -1) return;
        const [minIdx, maxIdx] = i1 < i2 ? [i1, i2] : [i2, i1];
        if (maxIdx !== minIdx + 1) return;
        const a = clips[minIdx];
        const b = clips[maxIdx];
        const mergedWords = [...a.words, ...b.words];
        const now = Date.now();
        const merged: typeof a = {
          ...a,
          id: generateClipId(a.id),
          words: mergedWords,
          startTime: a.startTime,
          endTime: b.endTime,
          startWordIndex: a.startWordIndex,
          endWordIndex: b.endWordIndex,
          duration: b.endTime - a.startTime,
          text: mergedWords.map(w => w.word).join(' '),
          createdAt: now,
          modifiedAt: now,
          type: 'user-created',
        };
        clips.splice(minIdx, 2, merged);
        audioActions.updateClips(clips);
        try { window.dispatchEvent(new CustomEvent('clips-updated')); } catch {}
      },
      mergeMultipleClips: (clipIds: string[]) => {
        if (clipIds.length < 2) return;
        
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Merge ${clipIds.length} clips`
        );
        
        const clips = [...audioState.clips];
        const clipsToMerge = clipIds
          .map(id => clips.find(c => c.id === id))
          .filter(Boolean)
          .sort((a, b) => a!.startTime - b!.startTime); // Sort by start time (visual order)
        
        if (clipsToMerge.length < 2) return;
        
        // Merge all words from all clips
        const mergedWords = clipsToMerge.flatMap(clip => clip!.words);
        const firstClip = clipsToMerge[0]!;
        const lastClip = clipsToMerge[clipsToMerge.length - 1]!;
        const now = Date.now();
        
        // Determine dominant speaker (most frequent)
        const speakerCounts = clipsToMerge.reduce((acc, clip) => {
          acc[clip!.speaker] = (acc[clip!.speaker] || 0) + clip!.words.length;
          return acc;
        }, {} as Record<string, number>);
        const dominantSpeaker = Object.keys(speakerCounts).reduce((a, b) => 
          speakerCounts[a] > speakerCounts[b] ? a : b
        );
        
        const merged = {
          ...firstClip,
          id: generateClipId('merged'),
          words: mergedWords,
          startTime: firstClip.startTime,
          endTime: lastClip.endTime,
          startWordIndex: firstClip.startWordIndex,
          endWordIndex: lastClip.endWordIndex,
          duration: lastClip.endTime - firstClip.startTime,
          text: mergedWords.map(w => w.word).join(' '),
          speaker: dominantSpeaker,
          createdAt: now,
          modifiedAt: now,
          type: 'user-created' as const,
        };
        
        // Remove original clips and insert merged clip at first clip's position
        const firstClipIndex = clips.findIndex(c => c.id === firstClip.id);
        const indicesToRemove = clipsToMerge.map(clip => clips.findIndex(c => c.id === clip!.id));
        
        // Remove clips in reverse order to maintain indices
        indicesToRemove.sort((a, b) => b - a).forEach(index => {
          if (index !== -1) clips.splice(index, 1);
        });
        
        // Insert merged clip at the original first clip position
        clips.splice(firstClipIndex, 0, merged);
        audioActions.updateClips(clips);
        try { window.dispatchEvent(new CustomEvent('clips-updated')); } catch {}
      },
      setClipStyle: (clipId: string, style: any) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Update style for clip ${clipId}`
        );
        
        const clips = [...audioState.clips];
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return;
        
        const updatedClip = {
          ...clips[clipIndex],
          style: { ...clips[clipIndex].style, ...style },
          modifiedAt: Date.now()
        };
        
        clips[clipIndex] = updatedClip;
        audioActions.updateClips(clips);
      },
      changeSpeaker: (clipId: string, newSpeakerId: string) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Change speaker for clip ${clipId}`
        );
        
        const clips = [...audioState.clips];
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return;
        
        const updatedClip = {
          ...clips[clipIndex],
          speaker: newSpeakerId,
          modifiedAt: Date.now()
        };
        
        clips[clipIndex] = updatedClip;
        audioActions.updateClips(clips);
        try { window.dispatchEvent(new CustomEvent('clips-updated')); } catch {}
      },
      deleteClip: (clipId: string) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Delete clip ${clipId}`
        );
        audioActions.deleteClip(clipId);
        try { window.dispatchEvent(new CustomEvent('clips-updated')); } catch {}
      },
      reorderClips: (fromIndex: number, toIndex: number) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Reorder clip index ${fromIndex} to ${toIndex}`
        );
        audioActions.reorderClips(fromIndex, toIndex);
      },
      deleteWords: (clipId: string, wordIndices: number[]) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Delete words in clip ${clipId}`
        );
        const wordIds = wordIndices.map(idx => generateWordId(clipId, idx));
        audioActions.deleteWords(wordIds);
      },
      restoreWords: (clipId: string, wordIndices: number[]) => {
        undoMgr.takeSnapshot(
          audioState.clips,
          audioState.deletedWordIds,
          audioActions.getReorderIndices(),
          `Restore words in clip ${clipId}`
        );
        const wordIds = wordIndices.map(idx => generateWordId(clipId, idx));
        audioActions.restoreWords(wordIds);
      },
      undo: () => {
        const prev = undoMgr.undo();
        if (prev) {
          audioActions.updateClips(prev.clips);
          audioActions.deleteWords([]); // clear before restoring
          audioActions.restoreWords(Array.from(prev.deletedWordIds));
          // Restore order from snapshot
          const indices = prev.reorderIndices;
          for (let i = 0; i < indices.length; i++) {
            audioActions.reorderClips(i, indices.indexOf(i));
          }
        }
      },
      redo: () => {
        const next = undoMgr.redo();
        if (next) {
          audioActions.updateClips(next.clips);
          audioActions.restoreWords(Array.from(next.deletedWordIds));
          const indices = next.reorderIndices;
          for (let i = 0; i < indices.length; i++) {
            audioActions.reorderClips(i, indices.indexOf(i));
          }
        }
      },
      canUndo: () => undoMgr.canUndo(),
      canRedo: () => undoMgr.canRedo(),
    }),
    [audioActions, audioState]
  );
}
