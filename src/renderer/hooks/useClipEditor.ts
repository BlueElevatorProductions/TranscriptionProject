/**
 * useClipEditor.ts - High-level clip editing API built on top of useAudioEditor.
 *
 * Provides unified methods for splitting, merging, deleting, reordering clips,
 * and deleting/restoring words. Intended to centralize clip editing logic.
 */

import { useMemo } from 'react';
import { AudioEditorActions, AudioEditorState } from './useAudioEditor';
import { generateWordId, generateClipId } from '../audio/AudioAppState';

/** API for clip-level editing operations. */
export interface ClipEditorActions {
  /** Split the clip at the given word index. */
  splitClip(clipId: string, wordIndex: number): void;
  /** Merge two adjacent clips into one. */
  mergeClips(firstClipId: string, secondClipId: string): void;
  /** Delete (hide) an entire clip from the edited timeline. */
  deleteClip(clipId: string): void;
  /** Move a clip from one index to another in the edited sequence. */
  reorderClips(fromIndex: number, toIndex: number): void;
  /** Delete (hide) specific words within a clip. */
  deleteWords(clipId: string, wordIndices: number[]): void;
  /** Restore previously deleted words within a clip. */
  restoreWords(clipId: string, wordIndices: number[]): void;
}

/**
 * Hook that wraps audioActions to expose high-level clip editing methods.
 * Implementation stubs are provided for split/merge; delete/reorder delegate directly.
 */
export function useClipEditor(
  audioState: AudioEditorState,
  audioActions: AudioEditorActions
): ClipEditorActions {
  return useMemo(
    () => ({
      splitClip: (clipId: string, wordIndex: number) => {
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
      },
      deleteClip: (clipId: string) => {
        audioActions.deleteClip(clipId);
      },
      reorderClips: (fromIndex: number, toIndex: number) => {
        audioActions.reorderClips(fromIndex, toIndex);
      },
      deleteWords: (clipId: string, wordIndices: number[]) => {
        const wordIds = wordIndices.map(idx => generateWordId(clipId, idx));
        audioActions.deleteWords(wordIds);
      },
      restoreWords: (clipId: string, wordIndices: number[]) => {
        const wordIds = wordIndices.map(idx => generateWordId(clipId, idx));
        audioActions.restoreWords(wordIds);
      },
    }),
    [audioActions]
  );
}
