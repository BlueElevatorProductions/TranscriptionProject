/**
 * TimelineValidator.ts - Validation and repair for timeline data
 * 
 * Ensures timeline data is always in a valid state
 */

import { Clip, Word } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canRepair: boolean;
}

export interface ValidationError {
  type: 'error' | 'warning';
  clipId?: string;
  wordIndex?: number;
  message: string;
  canRepair: boolean;
  repairAction?: () => void;
}

export class TimelineValidator {
  /**
   * Validate an array of clips
   */
  validateClips(clips: Clip[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let canRepair = true;

    // Check for basic structure issues
    if (!Array.isArray(clips)) {
      errors.push('Clips must be an array');
      return { isValid: false, errors, warnings, canRepair: false };
    }

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const clipErrors = this.validateClip(clip, i);
      
      errors.push(...clipErrors.errors);
      warnings.push(...clipErrors.warnings);
      
      if (!clipErrors.canRepair) {
        canRepair = false;
      }
    }

    // Check for timeline consistency
    const timelineErrors = this.validateTimelineConsistency(clips);
    errors.push(...timelineErrors.errors);
    warnings.push(...timelineErrors.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canRepair: canRepair && errors.length > 0,
    };
  }

  /**
   * Validate a single clip
   */
  validateClip(clip: Clip, index: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!clip) {
      errors.push(`Clip ${index} is null or undefined`);
      return { isValid: false, errors, warnings, canRepair: false };
    }

    // Required fields
    if (!clip.id) {
      errors.push(`Clip ${index} missing required field: id`);
    }

    if (typeof clip.startTime !== 'number' || clip.startTime < 0) {
      errors.push(`Clip ${index} has invalid startTime: ${clip.startTime}`);
    }

    if (typeof clip.endTime !== 'number' || clip.endTime <= clip.startTime) {
      errors.push(`Clip ${index} has invalid endTime: ${clip.endTime} (must be > startTime ${clip.startTime})`);
    }

    if (!Array.isArray(clip.words)) {
      errors.push(`Clip ${index} has invalid words array`);
    } else if (clip.words.length === 0) {
      warnings.push(`Clip ${index} has no words`);
    }

    // Validate words
    if (clip.words && Array.isArray(clip.words)) {
      for (let wordIndex = 0; wordIndex < clip.words.length; wordIndex++) {
        const wordErrors = this.validateWord(clip.words[wordIndex], clip.id, wordIndex);
        errors.push(...wordErrors.errors);
        warnings.push(...wordErrors.warnings);
      }
    }

    // Check duration consistency
    if (clip.duration && Math.abs(clip.duration - (clip.endTime - clip.startTime)) > 0.1) {
      warnings.push(`Clip ${index} duration mismatch: stored=${clip.duration}, calculated=${clip.endTime - clip.startTime}`);
    }

    // Check word indices
    if (typeof clip.startWordIndex === 'number' && typeof clip.endWordIndex === 'number') {
      if (clip.endWordIndex <= clip.startWordIndex) {
        errors.push(`Clip ${index} has invalid word indices: start=${clip.startWordIndex}, end=${clip.endWordIndex}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canRepair: true,
    };
  }

  /**
   * Validate a single word
   */
  validateWord(word: Word, clipId: string, wordIndex: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!word) {
      errors.push(`Word ${wordIndex} in clip ${clipId} is null or undefined`);
      return { isValid: false, errors, warnings, canRepair: false };
    }

    if (!word.word || typeof word.word !== 'string') {
      errors.push(`Word ${wordIndex} in clip ${clipId} has invalid text: ${word.word}`);
    }

    if (typeof word.start !== 'number' || word.start < 0) {
      errors.push(`Word ${wordIndex} in clip ${clipId} has invalid start time: ${word.start}`);
    }

    if (typeof word.end !== 'number' || word.end <= word.start) {
      errors.push(`Word ${wordIndex} in clip ${clipId} has invalid end time: ${word.end}`);
    }

    if (word.score !== undefined && (typeof word.score !== 'number' || word.score < 0 || word.score > 1)) {
      warnings.push(`Word ${wordIndex} in clip ${clipId} has invalid confidence score: ${word.score}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canRepair: true,
    };
  }

  /**
   * Validate timeline consistency across clips
   */
  validateTimelineConsistency(clips: Clip[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for overlapping clips
    const activeClips = clips.filter(c => c.status !== 'deleted');
    
    for (let i = 0; i < activeClips.length; i++) {
      for (let j = i + 1; j < activeClips.length; j++) {
        const clip1 = activeClips[i];
        const clip2 = activeClips[j];
        
        if (this.clipsOverlap(clip1, clip2)) {
          warnings.push(`Clips ${clip1.id} and ${clip2.id} have overlapping time ranges`);
        }
      }
    }

    // Check for gaps in timeline
    const sortedClips = [...activeClips].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sortedClips.length - 1; i++) {
      const currentClip = sortedClips[i];
      const nextClip = sortedClips[i + 1];
      
      if (nextClip.startTime > currentClip.endTime + 0.1) { // 100ms tolerance
        warnings.push(`Gap detected between clips ${currentClip.id} and ${nextClip.id}`);
      }
    }

    // Check order consistency
    for (const clip of clips) {
      if (typeof clip.order !== 'number' || clip.order < 0) {
        warnings.push(`Clip ${clip.id} has invalid order: ${clip.order}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canRepair: true,
    };
  }

  /**
   * Attempt to repair timeline issues
   */
  repairTimeline(clips: Clip[]): Clip[] {
    let repairedClips = [...clips];

    // Fix missing or invalid orders
    repairedClips = repairedClips.map((clip, index) => ({
      ...clip,
      order: typeof clip.order === 'number' && clip.order >= 0 ? clip.order : index,
    }));

    // Fix missing durations
    repairedClips = repairedClips.map(clip => ({
      ...clip,
      duration: clip.duration || (clip.endTime - clip.startTime),
    }));

    // Fix missing or invalid statuses
    repairedClips = repairedClips.map(clip => ({
      ...clip,
      status: clip.status || 'active',
    }));

    // Fix word timing issues
    repairedClips = repairedClips.map(clip => {
      if (!clip.words || !Array.isArray(clip.words)) {
        return clip;
      }

      const repairedWords = clip.words.map((word, index) => {
        let repairedWord = { ...word };

        // Fix word text
        if (!repairedWord.word || typeof repairedWord.word !== 'string') {
          repairedWord.word = `[word_${index}]`;
        }

        // Fix timing
        if (typeof repairedWord.start !== 'number' || repairedWord.start < clip.startTime) {
          repairedWord.start = clip.startTime + (index * (clip.duration / clip.words.length));
        }

        if (typeof repairedWord.end !== 'number' || repairedWord.end <= repairedWord.start || repairedWord.end > clip.endTime) {
          repairedWord.end = Math.min(repairedWord.start + (clip.duration / clip.words.length), clip.endTime);
        }

        // Fix confidence score
        if (repairedWord.score !== undefined && (typeof repairedWord.score !== 'number' || repairedWord.score < 0 || repairedWord.score > 1)) {
          repairedWord.score = 0.9; // Default confidence
        }

        return repairedWord;
      });

      return {
        ...clip,
        words: repairedWords,
        text: repairedWords.map(w => w.word).join(' '),
      };
    });

    return repairedClips;
  }

  /**
   * Check if two clips overlap in time
   */
  private clipsOverlap(clip1: Clip, clip2: Clip): boolean {
    return !(clip1.endTime <= clip2.startTime || clip2.endTime <= clip1.startTime);
  }

  /**
   * Validate time conversion accuracy
   */
  validateTimeConversion(editedTime: number, totalDuration: number): boolean {
    return (
      typeof editedTime === 'number' &&
      !isNaN(editedTime) &&
      editedTime >= 0 &&
      editedTime <= totalDuration + 0.1 // Small tolerance
    );
  }

  /**
   * Validate clip order array
   */
  validateClipOrder(clips: Clip[], orderIndices: number[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(orderIndices)) {
      errors.push('Order indices must be an array');
      return { isValid: false, errors, warnings, canRepair: false };
    }

    if (orderIndices.length !== clips.length) {
      errors.push(`Order indices length (${orderIndices.length}) doesn't match clips length (${clips.length})`);
    }

    // Check for valid indices
    for (let i = 0; i < orderIndices.length; i++) {
      const index = orderIndices[i];
      if (typeof index !== 'number' || index < 0 || index >= clips.length) {
        errors.push(`Invalid order index at position ${i}: ${index}`);
      }
    }

    // Check for duplicates
    const seen = new Set();
    for (const index of orderIndices) {
      if (seen.has(index)) {
        errors.push(`Duplicate order index: ${index}`);
      }
      seen.add(index);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canRepair: true,
    };
  }
}