import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProject, useAudio, useSelectedJob } from '../../contexts';
import { Segment } from '../../types';
import ContextMenu from '../TranscriptEdit/ContextMenu';
import LexicalTranscriptEditor from '../../editor/LexicalTranscriptEditor';

interface EditModeTranscriptProps {
  mode: string;
}

interface CursorPosition {
  segmentIndex: number;
  wordIndex: number;
  position: 'before' | 'after';
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordData?: {
    word: any;
    wordIndex: number;
    segmentIndex: number;
    timestamp: number;
  };
}

export const EditModeTranscript: React.FC<EditModeTranscriptProps> = ({ mode }) => {
  const { state: audioState } = useAudio();
  const { state: projectState, actions: projectActions } = useProject();
  const { selectedJob } = useSelectedJob();
  
  // Helper function to get speaker display name
  const getSpeakerDisplayName = (speakerId: string): string => {
    const globalSpeakers = projectState.globalSpeakers || {};
    if (globalSpeakers[speakerId]) {
      return globalSpeakers[speakerId];
    }
    if (speakerId.startsWith('SPEAKER_')) {
      const speakerNumber = speakerId.replace('SPEAKER_', '');
      return `Speaker ${parseInt(speakerNumber) + 1}`;
    }
    return speakerId;
  };
  
  // Get segments from the selected job or project
  const segments: Segment[] = React.useMemo(() => {
    if (selectedJob?.result?.segments) {
      return selectedJob.result.segments;
    } else if (projectState.projectData?.transcription?.segments) {
      return projectState.projectData.transcription.segments;
    }
    return [];
  }, [selectedJob, projectState.projectData, projectState.globalSpeakers]);
  
  // Update segments with edits
  const updateSegments = useCallback((newSegments: Segment[]) => {
    projectActions.updateSegments(newSegments);
  }, [projectActions]);
  
  // Handle word editing
  const handleWordEdit = useCallback((segmentIndex: number, wordIndex: number, oldWord: string, newWord: string) => {
    const newSegments = [...segments];
    if (newSegments[segmentIndex]?.words?.[wordIndex]) {
      newSegments[segmentIndex].words[wordIndex].word = newWord;
      // Update segment text
      newSegments[segmentIndex].text = newSegments[segmentIndex].words.map(w => w.word).join(' ');
      updateSegments(newSegments);
    }
  }, [segments, updateSegments]);
  
  // Handle word insertion
  const handleWordInsert = useCallback((segmentIndex: number, afterWordIndex: number, newWordText: string) => {
    const newSegments = [...segments];
    const segment = newSegments[segmentIndex];
    if (segment?.words) {
      const prevWord = segment.words[afterWordIndex];
      const nextWord = segment.words[afterWordIndex + 1];
      
      const newWord = {
        word: newWordText,
        start: prevWord?.end || segment.start,
        end: nextWord?.start || prevWord?.end || segment.end,
        score: 1.0
      };
      
      segment.words.splice(afterWordIndex + 1, 0, newWord);
      // Update segment text
      segment.text = segment.words.map(w => w.word).join(' ');
      updateSegments(newSegments);
    }
  }, [segments, updateSegments]);
  
  // Handle word deletion
  const handleWordDelete = useCallback((segmentIndex: number, wordIndex: number) => {
    const newSegments = [...segments];
    if (newSegments[segmentIndex]?.words && newSegments[segmentIndex].words.length > 1) {
      newSegments[segmentIndex].words.splice(wordIndex, 1);
      // Update segment text
      newSegments[segmentIndex].text = newSegments[segmentIndex].words.map(w => w.word).join(' ');
      updateSegments(newSegments);
    }
  }, [segments, updateSegments]);
  
  // Handle paragraph break
  const handleParagraphBreak = useCallback((segmentIndex: number, wordIndex: number, position: 'before' | 'after') => {
    const newSegments = [...segments];
    const segment = newSegments[segmentIndex];
    
    if (position === 'before' && wordIndex === 0) {
      // Add paragraph break before this segment
      newSegments[segmentIndex] = {
        ...segment,
        paragraphBreak: true
      };
    } else {
      // Split segment at word boundary
      const splitIndex = position === 'before' ? wordIndex : wordIndex + 1;
      
      const firstPart = {
        ...segment,
        words: segment.words?.slice(0, splitIndex) || [],
        text: segment.words?.slice(0, splitIndex).map((w: any) => w.word).join(' ') || '',
        end: segment.words?.[splitIndex - 1]?.end || segment.end
      };
      
      const secondPart = {
        ...segment,
        id: segment.id + '_split_' + Date.now(),
        words: segment.words?.slice(splitIndex) || [],
        text: segment.words?.slice(splitIndex).map((w: any) => w.word).join(' ') || '',
        start: segment.words?.[splitIndex]?.start || segment.start,
        paragraphBreak: true
      };
      
      newSegments.splice(segmentIndex, 1, firstPart, secondPart);
    }
    
    updateSegments(newSegments);
  }, [segments, updateSegments]);
  
  // Handle speaker name changes
  const handleSpeakerNameChange = useCallback((speakerId: string, newName: string) => {
    const updatedSpeakers = {
      ...projectState.globalSpeakers,
      [speakerId]: newName.trim()
    };
    projectActions.updateSpeakers(updatedSpeakers);
  }, [projectState.globalSpeakers, projectActions]);
  
  // Handle adding new speakers
  const handleSpeakerAdd = useCallback((speakerId: string, name: string) => {
    const updatedSpeakers = {
      ...projectState.globalSpeakers,
      [speakerId]: name.trim()
    };
    projectActions.updateSpeakers(updatedSpeakers);
  }, [projectState.globalSpeakers, projectActions]);
  
  // Handle word clicks for audio seeking
  const handleWordClick = useCallback((timestamp: number) => {
    // Update audio time - you might need to call audio context actions here
    console.log('Seeking to:', timestamp);
  }, []);
  
  return (
    <LexicalTranscriptEditor
      segments={segments}
      currentTime={audioState.currentTime}
      onSegmentsChange={updateSegments}
      onWordClick={handleWordClick}
      getSpeakerDisplayName={getSpeakerDisplayName}
      onSpeakerNameChange={handleSpeakerNameChange}
      speakers={projectState.globalSpeakers || {}}
      onWordEdit={handleWordEdit}
      onWordInsert={handleWordInsert}
      onWordDelete={handleWordDelete}
      onParagraphBreak={handleParagraphBreak}
      onSpeakerAdd={handleSpeakerAdd}
      isPlaying={audioState.isPlaying}
      readOnly={mode !== 'edit'}
    />
  );
};

export default EditModeTranscript;