/**
 * SimpleUndoManager.ts - Simple undo/redo using state snapshots
 * 
 * Much simpler than the command pattern, just stores state snapshots
 */

import { Clip } from '../types';

export interface UndoableState {
  clips: Clip[];
  deletedWordIds: Set<string>;
  reorderIndices: number[];
  timestamp: number;
  description: string;
}

export class SimpleUndoManager {
  private snapshots: UndoableState[] = [];
  private currentIndex: number = -1;
  private maxSnapshots: number = 50; // Limit memory usage

  /**
   * Take a snapshot of the current state
   */
  takeSnapshot(clips: Clip[], deletedWordIds: Set<string>, reorderIndices: number[], description: string): void {
    // Remove any redo history when taking a new snapshot
    if (this.currentIndex < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
    }

    // Create snapshot
    const snapshot: UndoableState = {
      clips: this.deepCloneClips(clips),
      deletedWordIds: new Set(deletedWordIds),
      reorderIndices: [...reorderIndices],
      timestamp: Date.now(),
      description,
    };

    // Add to history
    this.snapshots.push(snapshot);
    this.currentIndex = this.snapshots.length - 1;

    // Limit history size
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
      this.currentIndex--;
    }
  }

  /**
   * Undo to previous state
   */
  undo(): UndoableState | null {
    if (!this.canUndo()) return null;

    this.currentIndex--;
    return this.deepCloneState(this.snapshots[this.currentIndex]);
  }

  /**
   * Redo to next state
   */
  redo(): UndoableState | null {
    if (!this.canRedo()) return null;

    this.currentIndex++;
    return this.deepCloneState(this.snapshots[this.currentIndex]);
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.snapshots.length - 1;
  }

  /**
   * Get description of next undo operation
   */
  getUndoDescription(): string | null {
    if (!this.canUndo()) return null;
    return this.snapshots[this.currentIndex - 1].description;
  }

  /**
   * Get description of next redo operation
   */
  getRedoDescription(): string | null {
    if (!this.canRedo()) return null;
    return this.snapshots[this.currentIndex + 1].description;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.snapshots = [];
    this.currentIndex = -1;
  }

  /**
   * Get stats for debugging
   */
  getStats(): { snapshotCount: number; currentIndex: number; memoryUsage: string } {
    const memoryUsage = this.estimateMemoryUsage();
    return {
      snapshotCount: this.snapshots.length,
      currentIndex: this.currentIndex,
      memoryUsage: `${Math.round(memoryUsage / 1024)}KB`,
    };
  }

  private deepCloneClips(clips: Clip[]): Clip[] {
    return clips.map(clip => ({
      ...clip,
      words: clip.words.map(word => ({ ...word })),
    }));
  }

  private deepCloneState(state: UndoableState): UndoableState {
    return {
      clips: this.deepCloneClips(state.clips),
      deletedWordIds: new Set(state.deletedWordIds),
      reorderIndices: [...state.reorderIndices],
      timestamp: state.timestamp,
      description: state.description,
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage in bytes
    let total = 0;
    
    for (const snapshot of this.snapshots) {
      total += JSON.stringify({
        clips: snapshot.clips.length,
        deletedWords: snapshot.deletedWordIds.size,
        reorderIndices: snapshot.reorderIndices.length,
      }).length * 2; // Rough estimate for UTF-16
    }
    
    return total;
  }
}