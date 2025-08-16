import { useMemo, useState, useCallback } from 'react';

export interface Clip {
  id: string;
  speaker: string;
  startTime: number;
  endTime: number;
  startWordIndex: number;
  endWordIndex: number;
  words: any[];
  type: 'speaker-change' | 'paragraph-break' | 'user-created';
  text: string;
  duration: number;
  createdAt: number;
  modifiedAt: number;
}

interface UseClipsProps {
  segments: any[];
  speakerNames?: { [key: string]: string };
  setSpeakerNames?: (names: { [key: string]: string }) => void;
}

export const useClips = ({ segments, speakerNames, setSpeakerNames }: UseClipsProps) => {
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [userClips, setUserClips] = useState<Clip[]>([]);
  // Store split points to track where clips should be broken
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  // Store merged speaker boundaries (speaker changes that should be ignored)
  const [mergedBoundaries, setMergedBoundaries] = useState<number[]>([]);

  // Helper function to create a clip from a range of words
  const createClipFromWords = useCallback((words: any[], startWordIndex: number, clipId: string, segments: any[], speakerNames: any, isUserCreated = false): Clip => {
    // Find the speaker for this range (use the speaker of the first segment that contains these words)
    let speaker = 'SPEAKER_00';
    let runningIndex = 0;
    
    for (const segment of segments) {
      const segmentWordCount = segment.words?.length || 1;
      if (runningIndex <= startWordIndex && startWordIndex < runningIndex + segmentWordCount) {
        const speakerId = segment.speaker || 'SPEAKER_00';
        speaker = speakerNames?.[speakerId] || speakerId;
        break;
      }
      runningIndex += segmentWordCount;
    }

    const text = words.map(w => w.word).join(' ');
    const startTime = words[0]?.start || 0;
    const endTime = words[words.length - 1]?.end || startTime;

    return {
      id: clipId,
      speaker,
      startTime,
      endTime,
      startWordIndex,
      endWordIndex: startWordIndex + words.length - 1,
      words,
      type: isUserCreated ? 'user-created' : 'speaker-change',
      text,
      duration: endTime - startTime,
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };
  }, []);

  // Generate clips from segments - create clips on speaker changes AND split points
  const clips = useMemo(() => {
    console.log('=== useClips Debug ===');
    console.log('Input segments:', segments?.length || 0, segments?.slice(0, 2));
    console.log('Input speakerNames:', speakerNames);
    console.log('Split points:', splitPoints);
    console.log('Merged boundaries:', mergedBoundaries);
    
    if (!segments || segments.length === 0) {
      console.log('No segments available, returning empty clips');
      return [];
    }

    const generatedClips: Clip[] = [];
    let runningWordIndex = 0;
    let currentClip: Clip | null = null;

    // Create a combined list of all words with their global indices
    const allWords: any[] = [];
    segments.forEach((segment: any) => {
      if (segment.words) {
        allWords.push(...segment.words);
      } else {
        allWords.push({ word: segment.text, start: segment.start, end: segment.end });
      }
    });

    console.log('Total words:', allWords.length);
    console.log('Split points to apply:', splitPoints);

    // Create breakpoints (speaker changes + user split points)
    const breakpoints = new Set<number>();
    
    // Add speaker change breakpoints (excluding merged boundaries)
    runningWordIndex = 0;
    let lastSpeaker = '';
    segments.forEach((segment: any) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      const speakerName = speakerNames?.[speakerId] || speakerId;
      
      if (lastSpeaker && lastSpeaker !== speakerName) {
        // Only add speaker change breakpoint if it hasn't been merged
        if (!mergedBoundaries.includes(runningWordIndex)) {
          breakpoints.add(runningWordIndex);
          console.log('Added speaker change breakpoint at word:', runningWordIndex);
        } else {
          console.log('Skipping merged speaker boundary at word:', runningWordIndex);
        }
      }
      
      lastSpeaker = speakerName;
      runningWordIndex += segment.words?.length || 1;
    });

    // Add user split points
    splitPoints.forEach(splitPoint => {
      breakpoints.add(splitPoint);
      console.log('Added user split breakpoint at word:', splitPoint);
    });

    // Convert to sorted array
    const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);
    console.log('All breakpoints:', sortedBreakpoints);

    // Create clips between breakpoints
    let clipStartWordIndex = 0;
    sortedBreakpoints.forEach((breakpoint, index) => {
      if (breakpoint > clipStartWordIndex) {
        const clipWords = allWords.slice(clipStartWordIndex, breakpoint);
        if (clipWords.length > 0) {
          // Check if this breakpoint was created by a user split
          const isUserCreated = splitPoints.includes(breakpoint);
          const clip = createClipFromWords(clipWords, clipStartWordIndex, `clip-${generatedClips.length}`, segments, speakerNames, isUserCreated);
          generatedClips.push(clip);
          console.log('Created clip from words', clipStartWordIndex, 'to', breakpoint - 1, ':', clip.id, isUserCreated ? '(user-created)' : '(speaker-change)');
        }
        clipStartWordIndex = breakpoint;
      }
    });

    // Create final clip from last breakpoint to end
    if (clipStartWordIndex < allWords.length) {
      const clipWords = allWords.slice(clipStartWordIndex);
      if (clipWords.length > 0) {
        const clip = createClipFromWords(clipWords, clipStartWordIndex, `clip-${generatedClips.length}`, segments, speakerNames, false);
        generatedClips.push(clip);
        console.log('Created final clip from words', clipStartWordIndex, 'to end:', clip.id);
      }
    }

    console.log('Generated clips:', generatedClips.length, generatedClips.map(c => ({ id: c.id, type: c.type, speaker: c.speaker, words: c.words.length })));
    console.log('=================');
    return generatedClips;
  }, [segments, speakerNames, splitPoints, mergedBoundaries, createClipFromWords]);

  // Find clip by word index
  const findClipByWordIndex = (wordIndex: number): Clip | null => {
    return clips.find(clip => 
      wordIndex >= clip.startWordIndex && wordIndex <= clip.endWordIndex
    ) || null;
  };

  // Find current clip based on time
  const findClipByTime = (time: number): Clip | null => {
    return clips.find(clip => 
      time >= clip.startTime && time <= clip.endTime
    ) || null;
  };

  // Get next clip
  const getNextClip = (clipId: string): Clip | null => {
    const currentIndex = clips.findIndex(clip => clip.id === clipId);
    if (currentIndex >= 0 && currentIndex < clips.length - 1) {
      return clips[currentIndex + 1];
    }
    return null;
  };

  // Get previous clip
  const getPreviousClip = (clipId: string): Clip | null => {
    const currentIndex = clips.findIndex(clip => clip.id === clipId);
    if (currentIndex > 0) {
      return clips[currentIndex - 1];
    }
    return null;
  };

  // Select clip
  const selectClip = (clipId: string) => {
    setSelectedClipId(clipId);
  };

  // Merge clip with the one above it
  const mergeClipWithAbove = (clipId: string) => {
    console.log('🔀 === mergeClipWithAbove Debug ===');
    console.log('Merging clip:', clipId);
    console.log('Current clips:', clips.map(c => ({
      id: c.id,
      type: c.type,
      startWordIndex: c.startWordIndex,
      endWordIndex: c.endWordIndex
    })));
    console.log('Current split points:', splitPoints);
    
    // Find the clip index
    const clipIndex = clips.findIndex(c => c.id === clipId);
    if (clipIndex <= 0) {
      console.log('❌ Cannot merge - clip is first or not found. ClipIndex:', clipIndex);
      return false;
    }
    
    const currentClip = clips[clipIndex];
    const previousClip = clips[clipIndex - 1];
    
    console.log('Current clip:', {
      id: currentClip.id,
      type: currentClip.type,
      startWordIndex: currentClip.startWordIndex,
      endWordIndex: currentClip.endWordIndex
    });
    console.log('Previous clip:', {
      id: previousClip.id,
      type: previousClip.type,
      startWordIndex: previousClip.startWordIndex,
      endWordIndex: previousClip.endWordIndex
    });
    
    // Check what created this boundary
    const boundaryWordIndex = currentClip.startWordIndex;
    const isUserSplit = splitPoints.includes(boundaryWordIndex);
    const isSpeakerChange = !isUserSplit; // If not a user split, it must be a speaker change
    
    console.log('Boundary at word index:', boundaryWordIndex);
    console.log('Is user split?', isUserSplit);
    console.log('Is speaker change?', isSpeakerChange);
    
    if (isUserSplit) {
      // Remove the split point between these clips
      setSplitPoints(prev => {
        const newSplitPoints = prev.filter(sp => sp !== boundaryWordIndex);
        
        console.log('Removing user split point at:', boundaryWordIndex);
        console.log('Old split points:', prev);
        console.log('New split points:', newSplitPoints);
        
        return newSplitPoints;
      });
      console.log('✅ User-created split removed');
    } else {
      console.log('⚠️ This is a speaker-change boundary, adding to merged boundaries');
      // Add this boundary to the merged boundaries list
      setMergedBoundaries(prev => {
        if (prev.includes(boundaryWordIndex)) {
          console.log('Boundary already merged');
          return prev;
        }
        const newMergedBoundaries = [...prev, boundaryWordIndex].sort((a, b) => a - b);
        console.log('Adding merged boundary at:', boundaryWordIndex);
        console.log('Old merged boundaries:', prev);
        console.log('New merged boundaries:', newMergedBoundaries);
        return newMergedBoundaries;
      });
      console.log('✅ Speaker boundary marked as merged');
    }
    
    console.log('✅ Merge operation completed');
    return true;
  };

  // Create new clip by adding a split point
  const createNewClip = (splitWordIndex: number) => {
    console.log('🚀 === createNewClip Debug ===');
    console.log('Split word index:', splitWordIndex);
    console.log('Current split points:', splitPoints);
    
    const currentClip = findClipByWordIndex(splitWordIndex);
    console.log('Found current clip:', currentClip ? { id: currentClip.id, startWordIndex: currentClip.startWordIndex, endWordIndex: currentClip.endWordIndex } : 'None');
    
    if (!currentClip) {
      console.log('❌ No clip found for word index:', splitWordIndex);
      return false;
    }

    // Add split point if not already exists
    setSplitPoints(prev => {
      const exists = prev.includes(splitWordIndex);
      
      if (exists) {
        console.log('❌ Split point already exists at word index:', splitWordIndex);
        return prev;
      }
      
      const newSplitPoints = [...prev, splitWordIndex].sort((a, b) => a - b);
      console.log('✅ Added split point at word index:', splitWordIndex);
      console.log('New split points:', newSplitPoints);
      return newSplitPoints;
    });

    return true;
  };

  // Add new speaker label at word position
  const addNewSpeakerLabel = (wordIndex: number, newSpeakerName: string) => {
    const currentClip = findClipByWordIndex(wordIndex);
    if (!currentClip) {
      console.log('No clip found for word index:', wordIndex);
      return false;
    }

    const splitPoint = wordIndex - currentClip.startWordIndex;
    if (splitPoint <= 0) {
      console.log('Invalid split point for speaker change:', splitPoint);
      return false;
    }

    // Calculate split time based on word position
    const splitWord = currentClip.words[splitPoint];
    const splitTime = splitWord?.start || currentClip.startTime + (currentClip.duration * (splitPoint / currentClip.words.length));

    console.log('Adding new speaker label:', newSpeakerName, 'at word index:', wordIndex, 'split time:', splitTime);
    
    // Find the segment index that corresponds to this clip
    const segmentIndex = parseInt(currentClip.id.replace('clip-', ''));
    if (isNaN(segmentIndex) || !segments[segmentIndex]) {
      console.log('Cannot find segment for clip:', currentClip.id);
      return false;
    }

    const originalSegment = segments[segmentIndex];
    
    // Create text for first part and second part
    const firstPartWords = currentClip.words.slice(0, splitPoint);
    const secondPartWords = currentClip.words.slice(splitPoint);
    
    const firstPartText = firstPartWords.map(w => w.word).join(' ');
    const secondPartText = secondPartWords.map(w => w.word).join(' ');

    // Generate new speaker ID
    const newSpeakerId = `SPEAKER_${newSpeakerName.toUpperCase().replace(/\s+/g, '_')}`;

    // Update the original segment to end at split point
    originalSegment.end = splitTime;
    originalSegment.text = firstPartText;
    originalSegment.words = firstPartWords;

    // Create new segment for the second part with new speaker
    const newSegment = {
      ...originalSegment,
      speaker: newSpeakerId,
      start: splitTime,
      end: currentClip.endTime,
      text: secondPartText,
      words: secondPartWords
    };

    // Create updated segments array instead of mutating
    const updatedSegments = [...segments];
    updatedSegments[segmentIndex] = originalSegment;
    updatedSegments.splice(segmentIndex + 1, 0, newSegment);

    // Update speaker names if this is a new speaker
    if (speakerNames && setSpeakerNames && !speakerNames[newSpeakerId]) {
      const updatedSpeakerNames = { ...speakerNames, [newSpeakerId]: newSpeakerName };
      setSpeakerNames(updatedSpeakerNames);
    }

    console.log('Successfully added new speaker label:', newSpeakerName, 'at', splitTime);
    console.log('Note: Segments updated locally but caller should update project context');
    return true;
  };

  // Calculate adjusted playback time skipping deleted words
  const getAdjustedPlaybackTime = (deletedWordIds: Set<string>, targetTime: number): number => {
    let adjustedTime = targetTime;
    let totalSkippedTime = 0;
    
    // Get all deleted words with their time ranges
    const deletedWordRanges: Array<{start: number, end: number}> = [];
    
    clips.forEach(clip => {
      clip.words.forEach((word, wordIndex) => {
        const wordId = `${clip.id}-${wordIndex}`;
        if (deletedWordIds.has(wordId)) {
          deletedWordRanges.push({
            start: word.start || 0,
            end: word.end || word.start || 0
          });
        }
      });
    });
    
    // Sort by start time
    deletedWordRanges.sort((a, b) => a.start - b.start);
    
    // Calculate total time to skip that occurs before the target time
    deletedWordRanges.forEach(range => {
      if (range.start <= targetTime) {
        const overlapEnd = Math.min(range.end, targetTime);
        const skippedDuration = overlapEnd - range.start;
        if (skippedDuration > 0) {
          totalSkippedTime += skippedDuration;
        }
      }
    });
    
    return targetTime + totalSkippedTime;
  };

  // Calculate original time from adjusted time (reverse operation)
  const getOriginalTimeFromAdjusted = (deletedWordIds: Set<string>, adjustedTime: number): number => {
    let originalTime = adjustedTime;
    let totalSkippedTime = 0;
    
    // Get all deleted words with their time ranges
    const deletedWordRanges: Array<{start: number, end: number}> = [];
    
    clips.forEach(clip => {
      clip.words.forEach((word, wordIndex) => {
        const wordId = `${clip.id}-${wordIndex}`;
        if (deletedWordIds.has(wordId)) {
          deletedWordRanges.push({
            start: word.start || 0,
            end: word.end || word.start || 0
          });
        }
      });
    });
    
    // Sort by start time
    deletedWordRanges.sort((a, b) => a.start - b.start);
    
    // Calculate total time to subtract
    deletedWordRanges.forEach(range => {
      const rangeDuration = range.end - range.start;
      if (range.start <= originalTime - totalSkippedTime) {
        totalSkippedTime += rangeDuration;
      }
    });
    
    return Math.max(0, adjustedTime - totalSkippedTime);
  };

  return {
    clips,
    selectedClipId,
    findClipByWordIndex,
    findClipByTime,
    getNextClip,
    getPreviousClip,
    selectClip,
    createNewClip,
    mergeClipWithAbove,
    addNewSpeakerLabel,
    getAdjustedPlaybackTime,
    getOriginalTimeFromAdjusted
  };
};