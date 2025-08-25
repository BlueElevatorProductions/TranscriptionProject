/**
 * SimpleClipSequencer.ts - Direct, working solution for clip reordering playback
 * 
 * No complex timeline math. Just: "Which clip should be playing now?"
 */

import { Clip } from '../types';

export class SimpleClipSequencer {
  private clips: Clip[];
  private reorderedClips: Clip[];
  
  constructor(clips: Clip[]) {
    this.clips = clips;
    this.reorderedClips = this.calculateReorderedClips(clips);
  }
  
  /**
   * Update clips and recalculate sequence
   */
  updateClips(newClips: Clip[]): void {
    this.clips = newClips;
    this.reorderedClips = this.calculateReorderedClips(newClips);
  }
  
  /**
   * Calculate clips in their reordered sequence
   */
  private calculateReorderedClips(clips: Clip[]): Clip[] {
    return clips
      .filter(clip => clip.status !== 'deleted') // Allow active and undefined status
      .sort((a, b) => (a.order || 0) - (b.order || 0)); // Handle undefined order
  }
  
  /**
   * Convert edited timeline position to original audio position
   * This is the core function that makes reordering work
   */
  editedTimeToOriginalTime(editedTime: number): { originalTime: number; clipId: string } | null {
    let accumulatedTime = 0;
    
    // Go through clips in reordered sequence
    for (const clip of this.reorderedClips) {
      const clipDuration = clip.duration;
      
      // Check if edited time falls within this clip
      if (editedTime >= accumulatedTime && editedTime <= accumulatedTime + clipDuration) {
        const offsetWithinClip = editedTime - accumulatedTime;
        const originalTime = clip.startTime + offsetWithinClip;
        
        return {
          originalTime: Math.max(clip.startTime, Math.min(originalTime, clip.endTime)),
          clipId: clip.id
        };
      }
      
      accumulatedTime += clipDuration;
    }
    
    // If beyond all clips, go to the last clip's end
    const lastClip = this.reorderedClips[this.reorderedClips.length - 1];
    if (lastClip) {
      return {
        originalTime: lastClip.endTime,
        clipId: lastClip.id
      };
    }
    
    return null;
  }
  
  /**
   * Convert original audio position to edited timeline position
   */
  originalTimeToEditedTime(originalTime: number, clipId: string): number | null {
    let accumulatedTime = 0;
    
    // Find the clip in reordered sequence
    for (const clip of this.reorderedClips) {
      if (clip.id === clipId) {
        // Check if original time is within this clip
        if (originalTime >= clip.startTime && originalTime <= clip.endTime) {
          const offsetWithinClip = originalTime - clip.startTime;
          return accumulatedTime + offsetWithinClip;
        }
      }
      accumulatedTime += clip.duration;
    }
    
    return null;
  }
  
  /**
   * Get total duration of edited sequence
   */
  getTotalEditedDuration(): number {
    return this.reorderedClips.reduce((total, clip) => total + clip.duration, 0);
  }
  
  /**
   * Get current clip at edited time position
   */
  getClipAtEditedTime(editedTime: number): Clip | null {
    const result = this.editedTimeToOriginalTime(editedTime);
    if (result) {
      return this.reorderedClips.find(c => c.id === result.clipId) || null;
    }
    return null;
  }
  
  /**
   * Get reordered clips list
   */
  getReorderedClips(): Clip[] {
    return [...this.reorderedClips];
  }
}