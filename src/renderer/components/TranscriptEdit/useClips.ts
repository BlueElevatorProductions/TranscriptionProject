import { useMemo, useState } from 'react';

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

  // Generate clips from segments - only create clips on speaker changes
  const clips = useMemo(() => {
    if (!segments || segments.length === 0) return [];

    const generatedClips: Clip[] = [];
    let runningWordIndex = 0;
    let currentClip: Clip | null = null;

    segments.forEach((segment: any, segmentIndex: number) => {
      const speakerId = segment.speaker || 'SPEAKER_00';
      const speakerName = speakerNames?.[speakerId] || speakerId;
      
      // Calculate word indices for this segment
      const startWordIndex = runningWordIndex;
      const wordCount = segment.words?.length || 1;
      const endWordIndex = startWordIndex + wordCount - 1;
      runningWordIndex += wordCount;

      // Only create new clip if speaker changes (not for every segment)
      if (!currentClip || currentClip.speaker !== speakerName) {
        // Finish previous clip
        if (currentClip) {
          generatedClips.push(currentClip);
        }
        
        // Start new clip
        currentClip = {
          id: `clip-${generatedClips.length}`,
          speaker: speakerName,
          startTime: segment.start,
          endTime: segment.end,
          startWordIndex,
          endWordIndex,
          words: segment.words || [{ word: segment.text, start: segment.start, end: segment.end }],
          type: 'speaker-change',
          text: segment.text,
          duration: segment.end - segment.start,
          createdAt: Date.now(),
          modifiedAt: Date.now()
        };
      } else {
        // Extend current clip
        currentClip.endTime = segment.end;
        currentClip.endWordIndex = endWordIndex;
        currentClip.words = [...currentClip.words, ...(segment.words || [{ word: segment.text, start: segment.start, end: segment.end }])];
        currentClip.text += ' ' + segment.text;
        currentClip.duration = currentClip.endTime - currentClip.startTime;
      }
    });

    // Add the last clip
    if (currentClip) {
      generatedClips.push(currentClip);
    }

    // Combine generated clips with user clips
    const allClips = [...generatedClips, ...userClips];
    console.log(`Generated ${generatedClips.length} clips from ${segments.length} segments + ${userClips.length} user clips = ${allClips.length} total`);
    return allClips;
  }, [segments, speakerNames, userClips]);

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

  // Create new clip by splitting existing clip
  const createNewClip = (splitWordIndex: number) => {
    console.log('Creating new clip at word index:', splitWordIndex);
    
    const currentClip = findClipByWordIndex(splitWordIndex);
    if (!currentClip) {
      console.log('No clip found for word index:', splitWordIndex);
      return false;
    }

    // Create a simple user clip based on the current clip position
    const splitPoint = splitWordIndex - currentClip.startWordIndex;
    const splitWord = currentClip.words[splitPoint];
    
    if (!splitWord) {
      console.log('No word found at split point');
      return false;
    }

    const timestamp = Date.now();
    const newUserClip: Clip = {
      id: `user-clip-${timestamp}`,
      speaker: currentClip.speaker,
      startTime: splitWord.start,
      endTime: splitWord.start + 30, // 30 second clip
      startWordIndex: splitWordIndex,
      endWordIndex: splitWordIndex + 20, // Approximate 20 words
      words: [splitWord],
      type: 'user-created',
      text: `Clip: ${currentClip.text.substring(0, 50)}...`,
      duration: 30,
      createdAt: timestamp,
      modifiedAt: timestamp
    };

    // Add to user clips with duplicate prevention
    setUserClips(prev => {
      const exists = prev.find(clip => 
        Math.abs(clip.startWordIndex - splitWordIndex) < 3
      );
      
      if (exists) {
        console.log('Similar clip already exists at word index:', exists.startWordIndex);
        return prev;
      }
      
      console.log('Created new user clip:', newUserClip.id, 'at time:', newUserClip.startTime);
      return [...prev, newUserClip];
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

    // Insert the new segment into the segments array
    segments.splice(segmentIndex + 1, 0, newSegment);

    // Update speaker names if this is a new speaker
    if (speakerNames && setSpeakerNames && !speakerNames[newSpeakerId]) {
      const updatedSpeakerNames = { ...speakerNames, [newSpeakerId]: newSpeakerName };
      setSpeakerNames(updatedSpeakerNames);
    }

    console.log('Successfully added new speaker label:', newSpeakerName, 'at', splitTime);
    return true;
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
    addNewSpeakerLabel
  };
};