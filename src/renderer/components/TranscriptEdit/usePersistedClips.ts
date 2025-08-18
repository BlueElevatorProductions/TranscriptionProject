import { useMemo, useState, useCallback, useEffect } from 'react';
import { Clip, Segment, Word } from '../../types';

interface UsePersistedClipsProps {
  initialClips?: Clip[];
  segments?: Segment[];
  speakerNames?: { [key: string]: string };
  setSpeakerNames?: (names: { [key: string]: string }) => void;
  onClipsChange?: (clips: Clip[]) => void;
}

/**
 * Hook for managing persisted clips
 * Clips are the primary data structure, segments are archived
 */
export const usePersistedClips = ({ 
  initialClips, 
  segments, 
  speakerNames, 
  setSpeakerNames,
  onClipsChange 
}: UsePersistedClipsProps) => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize clips - either from saved data or generate from segments
  useEffect(() => {
    // Only initialize once
    if (hasInitialized) return;
    
    if (initialClips && initialClips.length > 0) {
      // Use persisted clips
      console.log('Using persisted clips:', initialClips.length);
      setClips(initialClips);
      setHasInitialized(true);
    } else if (segments && segments.length > 0) {
      // Generate clips from segments (first time only)
      console.log('Generating clips from segments:', segments.length);
      const generatedClips = generateClipsFromSegments(segments, speakerNames || {});
      setClips(generatedClips);
      setHasInitialized(true);
      // Immediately save the generated clips
      if (onClipsChange) {
        onClipsChange(generatedClips);
      }
    }
  }, [initialClips, segments, speakerNames, hasInitialized]);

  // Helper function to generate clips from segments
  const generateClipsFromSegments = (segments: Segment[], speakerNames: { [key: string]: string }): Clip[] => {
    const generatedClips: Clip[] = [];
    let runningWordIndex = 0;

    // Create a combined list of all words
    const allWords: Word[] = [];
    segments.forEach((segment) => {
      if (segment.words) {
        allWords.push(...segment.words);
      } else {
        // If segment has no words array, create a single word from the text
        allWords.push({ 
          word: segment.text, 
          start: segment.start, 
          end: segment.end, 
          score: 1 
        });
      }
    });

    // Create clips based on speaker changes
    let currentSpeaker = '';
    let clipStartIndex = 0;
    
    segments.forEach((segment, segIndex) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      const segmentWordCount = segment.words?.length || 1;
      
      // If speaker changed, create a clip
      if (speakerId !== currentSpeaker && currentSpeaker !== '') {
        const clipWords = allWords.slice(clipStartIndex, runningWordIndex);
        if (clipWords.length > 0) {
          const clip: Clip = {
            id: `clip-${generatedClips.length}`,
            speaker: currentSpeaker,
            startTime: clipWords[0].start,
            endTime: clipWords[clipWords.length - 1].end,
            startWordIndex: clipStartIndex,
            endWordIndex: runningWordIndex - 1,
            words: clipWords,
            type: 'speaker-change',
            text: clipWords.map(w => w.word).join(' '),
            duration: clipWords[clipWords.length - 1].end - clipWords[0].start,
            createdAt: Date.now(),
            modifiedAt: Date.now()
          };
          generatedClips.push(clip);
        }
        clipStartIndex = runningWordIndex;
      }
      
      currentSpeaker = speakerId;
      runningWordIndex += segmentWordCount;
    });

    // Create final clip
    if (clipStartIndex < allWords.length) {
      const clipWords = allWords.slice(clipStartIndex);
      if (clipWords.length > 0) {
        const clip: Clip = {
          id: `clip-${generatedClips.length}`,
          speaker: currentSpeaker,
          startTime: clipWords[0].start,
          endTime: clipWords[clipWords.length - 1].end,
          startWordIndex: clipStartIndex,
          endWordIndex: allWords.length - 1,
          words: clipWords,
          type: 'speaker-change',
          text: clipWords.map(w => w.word).join(' '),
          duration: clipWords[clipWords.length - 1].end - clipWords[0].start,
          createdAt: Date.now(),
          modifiedAt: Date.now()
        };
        generatedClips.push(clip);
      }
    }

    return generatedClips;
  };

  // Update a word in a clip
  const updateClipWord = useCallback((clipId: string, wordIndex: number, newWord: string) => {
    console.log('updateClipWord called', { clipId, wordIndex, newWord });
    
    setClips(prevClips => {
      const updatedClips = prevClips.map(clip => {
        if (clip.id === clipId) {
          const newWords = [...clip.words];
          if (wordIndex >= 0 && wordIndex < newWords.length) {
            newWords[wordIndex] = { ...newWords[wordIndex], word: newWord.trim() };
            
            // Update the clip text as well
            const newText = newWords.map(w => w.word).join(' ');
            
            return {
              ...clip,
              words: newWords,
              text: newText,
              modifiedAt: Date.now()
            };
          }
        }
        return clip;
      });
      
      // Notify parent of changes
      if (onClipsChange) {
        onClipsChange(updatedClips);
      }
      
      return updatedClips;
    });
  }, [onClipsChange]);

  // Update a clip's speaker
  const updateClipSpeaker = useCallback((clipId: string, newSpeaker: string) => {
    console.log('updateClipSpeaker called', { clipId, newSpeaker });
    
    setClips(prevClips => {
      console.log('Previous clips count:', prevClips.length);
      const clipToUpdate = prevClips.find(c => c.id === clipId);
      console.log('Found clip to update:', !!clipToUpdate, clipToUpdate?.speaker);
      
      const updatedClips = prevClips.map(clip => 
        clip.id === clipId 
          ? { ...clip, speaker: newSpeaker, modifiedAt: Date.now() }
          : clip
      );
      
      console.log('Updated clips, calling onClipsChange');
      // Notify parent of changes
      if (onClipsChange) {
        onClipsChange(updatedClips);
      }
      
      return updatedClips;
    });
  }, [onClipsChange]);

  // Split a clip at a specific word index
  const splitClip = useCallback((clipId: string, splitAtWordIndex: number) => {
    setClips(prevClips => {
      const clipIndex = prevClips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) {
        return prevClips;
      }
      
      const originalClip = prevClips[clipIndex];
      const localWordIndex = splitAtWordIndex - originalClip.startWordIndex;
      
      if (localWordIndex <= 0 || localWordIndex >= originalClip.words.length) {
        return prevClips;
      }

      // Create two new clips from the original
      const firstWords = originalClip.words.slice(0, localWordIndex);
      const secondWords = originalClip.words.slice(localWordIndex);

      const firstClip: Clip = {
        ...originalClip,
        id: `${originalClip.id}-1`,
        endTime: firstWords[firstWords.length - 1].end,
        endWordIndex: originalClip.startWordIndex + localWordIndex - 1,
        words: firstWords,
        text: firstWords.map(w => w.word).join(' '),
        duration: firstWords[firstWords.length - 1].end - originalClip.startTime,
        type: 'user-created',
        modifiedAt: Date.now()
      };

      const secondClip: Clip = {
        ...originalClip,
        id: `${originalClip.id}-2`,
        startTime: secondWords[0].start,
        startWordIndex: originalClip.startWordIndex + localWordIndex,
        words: secondWords,
        text: secondWords.map(w => w.word).join(' '),
        duration: originalClip.endTime - secondWords[0].start,
        type: 'user-created',
        modifiedAt: Date.now()
      };

      const updatedClips = [
        ...prevClips.slice(0, clipIndex),
        firstClip,
        secondClip,
        ...prevClips.slice(clipIndex + 1)
      ];

      // Notify parent of changes
      if (onClipsChange) {
        onClipsChange(updatedClips);
      }

      return updatedClips;
    });
  }, [onClipsChange]);

  // Merge two adjacent clips
  const mergeClips = useCallback((clipId1: string, clipId2: string) => {
    setClips(prevClips => {
      const index1 = prevClips.findIndex(c => c.id === clipId1);
      const index2 = prevClips.findIndex(c => c.id === clipId2);
      
      if (index1 === -1 || index2 === -1 || Math.abs(index1 - index2) !== 1) {
        return prevClips;
      }

      const firstIndex = Math.min(index1, index2);
      const secondIndex = Math.max(index1, index2);
      const firstClip = prevClips[firstIndex];
      const secondClip = prevClips[secondIndex];

      const mergedClip: Clip = {
        id: `${firstClip.id}-merged`,
        speaker: firstClip.speaker, // Keep first clip's speaker
        startTime: firstClip.startTime,
        endTime: secondClip.endTime,
        startWordIndex: firstClip.startWordIndex,
        endWordIndex: secondClip.endWordIndex,
        words: [...firstClip.words, ...secondClip.words],
        type: 'user-created',
        text: [...firstClip.words, ...secondClip.words].map(w => w.word).join(' '),
        duration: secondClip.endTime - firstClip.startTime,
        createdAt: firstClip.createdAt,
        modifiedAt: Date.now()
      };

      const updatedClips = [
        ...prevClips.slice(0, firstIndex),
        mergedClip,
        ...prevClips.slice(secondIndex + 1)
      ];

      // Notify parent of changes
      if (onClipsChange) {
        onClipsChange(updatedClips);
      }

      return updatedClips;
    });
  }, [onClipsChange]);

  // Find clip by word index
  const findClipByWordIndex = useCallback((wordIndex: number): Clip | null => {
    return clips.find(clip => 
      wordIndex >= clip.startWordIndex && wordIndex <= clip.endWordIndex
    ) || null;
  }, [clips]);

  // Find clip by time
  const findClipByTime = useCallback((time: number): Clip | null => {
    return clips.find(clip => 
      time >= clip.startTime && time <= clip.endTime
    ) || null;
  }, [clips]);

  // Get next/previous clips
  const getNextClip = useCallback((clipId: string): Clip | null => {
    const currentIndex = clips.findIndex(clip => clip.id === clipId);
    if (currentIndex >= 0 && currentIndex < clips.length - 1) {
      return clips[currentIndex + 1];
    }
    return null;
  }, [clips]);

  const getPreviousClip = useCallback((clipId: string): Clip | null => {
    const currentIndex = clips.findIndex(clip => clip.id === clipId);
    if (currentIndex > 0) {
      return clips[currentIndex - 1];
    }
    return null;
  }, [clips]);

  // Select clip
  const selectClip = useCallback((clipId: string) => {
    setSelectedClipId(clipId);
  }, []);

  return {
    clips,
    selectedClipId,
    selectClip,
    updateClipWord,
    updateClipSpeaker,
    splitClip,
    mergeClips,
    findClipByWordIndex,
    findClipByTime,
    getNextClip,
    getPreviousClip,
    // Legacy compatibility
    createNewClip: splitClip,
    mergeClipWithAbove: (clipId: string) => {
      const prevClip = getPreviousClip(clipId);
      if (prevClip) {
        mergeClips(prevClip.id, clipId);
        return true;
      }
      return false;
    },
    addNewSpeakerLabel: (wordIndex: number, speakerName: string) => {
      const clip = findClipByWordIndex(wordIndex);
      if (clip) {
        splitClip(clip.id, wordIndex);
        // After split, update the second clip's speaker
        setTimeout(() => {
          const newClip = findClipByWordIndex(wordIndex);
          if (newClip) {
            updateClipSpeaker(newClip.id, speakerName);
          }
        }, 0);
        return true;
      }
      return false;
    }
  };
};