import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProject, useAudio, useSelectedJob } from '../../contexts';
import { Segment, Clip } from '../../types';
import ModernContextMenu, { createContextMenuItem } from '../TranscriptEdit/ModernContextMenu';
import { useClips } from '../TranscriptEdit/useClips';
import { FontSettings } from '../shared/FontsPanel';

interface ClipBasedTranscriptProps {
  mode: string;
  fontSettings?: FontSettings;
  clipsHook?: {
    clips: Clip[];
    selectedClipId: string | null;
    findClipByWordIndex: (wordIndex: number) => Clip | null;
    selectClip: (clipId: string) => void;
    createNewClip: (splitWordIndex: number) => boolean;
    splitClip?: (clipId: string, splitAtWordIndex: number) => void;
    updateClipWord?: (clipId: string, wordIndex: number, newWord: string) => void;
    updateClipSpeaker?: (clipId: string, newSpeaker: string) => void;
    mergeClipWithAbove?: (clipId: string) => boolean;
    addNewSpeakerLabel: (wordIndex: number, speakerName: string) => boolean;
    getAdjustedPlaybackTime?: (deletedWordIds: Set<string>, targetTime: number) => number;
    getOriginalTimeFromAdjusted?: (deletedWordIds: Set<string>, adjustedTime: number) => number;
  };
  onDeletedWordsChange?: (deletedWords: Set<string>) => void;
  onClipsChange?: (clips: Clip[]) => void;
  // Audio props for cursor-based seeking in Edit Mode
  isPlaying?: boolean;
  onSeek?: (timestamp: number) => void;
  onPlay?: () => void;
  onCustomPlay?: (customPlayHandler: () => void) => void;
  // Virtual timeline functions (for Listen Mode)
  onVirtualTimelineFunctions?: (functions: {
    getVirtualTime: (originalTime: number) => number;
    getOriginalTime: (virtualTime: number) => number;
    getVirtualDuration: () => number;
    getActiveClips: () => Clip[];
  }) => void;
}

interface CursorPosition {
  clipId: string;
  wordIndex: number; // Word index within the clip
  position: 'before' | 'after';
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordData?: {
    word: any;
    wordIndex: number;
    clipId: string;
    globalWordIndex: number;
  };
}

interface EditingState {
  clipId: string | null;
  wordIndex: number | null;
  text: string;
}

export const ClipBasedTranscript: React.FC<ClipBasedTranscriptProps> = ({ 
  mode, 
  fontSettings, 
  clipsHook: externalClipsHook, 
  onDeletedWordsChange,
  onClipsChange,
  isPlaying = false,
  onSeek,
  onPlay,
  onCustomPlay,
  onVirtualTimelineFunctions
}) => {
  const { state: audioState } = useAudio();
  const { state: projectState, actions: projectActions } = useProject();
  const { selectedJob } = useSelectedJob();
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Get segments
  const segments: Segment[] = React.useMemo(() => {
    if (selectedJob?.result?.segments) {
      return selectedJob.result.segments;
    } else if (projectState.projectData?.transcription?.segments) {
      return projectState.projectData.transcription.segments;
    }
    return [];
  }, [selectedJob, projectState.projectData]);
  
  // Use external clips hook if provided, otherwise use our own (for backwards compatibility)
  const {
    clips,
    selectedClipId,
    findClipByWordIndex,
    selectClip,
    createNewClip,
    splitClip,
    updateClipWord,
    updateClipSpeaker,
    mergeClipWithAbove,
    addNewSpeakerLabel,
    getAdjustedPlaybackTime,
    getOriginalTimeFromAdjusted
  } = externalClipsHook || useClips({
    segments,
    speakerNames: projectState.globalSpeakers,
    setSpeakerNames: (speakers) => projectActions.updateSpeakers(speakers)
  });
  
  // Edit state
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [lastCursorTime, setLastCursorTime] = useState<number | null>(null);
  const [wordCursorPosition, setWordCursorPosition] = useState<{ clipId: string; wordIndex: number; position: 'before' | 'after' } | null>(null);
  
  // Selection state for word deletion
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set()); // wordIds
  
  // Debug selection changes
  useEffect(() => {
    console.log('ClipBasedTranscript - selectedWords changed:', selectedWords.size, 'words selected');
    if (selectedWords.size === 0) {
      console.log('ClipBasedTranscript - Selection cleared!');
      console.trace('Selection cleared from:');
    }
  }, [selectedWords]);

  // Override setSelectedWords with debugging
  const debugSetSelectedWords = useCallback((newSelection: Set<string>, context?: string) => {
    const stackTrace = new Error().stack;
    const isClearing = newSelection.size === 0 && selectedWords.size > 0;
    const isJumping = newSelection.size > 0 && selectedWords.size > 0 && 
      Array.from(newSelection)[0] !== Array.from(selectedWords)[0] && newSelection.size === 1;
    
    console.log('🔵 SELECTION UPDATE:', {
      context: context || 'unknown',
      timestamp: Date.now(),
      previousSize: selectedWords.size,
      newSize: newSelection.size,
      isClearing,
      isJumping,
      previousWords: Array.from(selectedWords).slice(0, 3), // Show first 3 for brevity
      newWords: Array.from(newSelection).slice(0, 3),
      stackTrace: stackTrace?.split('\n').slice(1, 4).map(line => line.trim())
    });
    
    if (isClearing) {
      console.log('⚠️  SELECTION CLEARED! Previous selection had', selectedWords.size, 'words');
      console.trace('Selection cleared from:');
    }
    
    if (isJumping) {
      console.log('⚠️  SELECTION JUMPED! From', Array.from(selectedWords)[0], 'to', Array.from(newSelection)[0]);
      console.trace('Selection jumped from:');
    }
    
    setSelectedWords(newSelection);
  }, [selectedWords]);
  const [selectionAnchor, setSelectionAnchor] = useState<{ clipId: string; wordIndex: number } | null>(null);
  
  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ clipId: string; wordIndex: number; x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ clipId: string; wordIndex: number } | null>(null);
  const [hasDraggedMinDistance, setHasDraggedMinDistance] = useState(false);
  const [editingWord, setEditingWord] = useState<EditingState>({ clipId: null, wordIndex: null, text: '' });
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  const [speakerDropdownOpen, setSpeakerDropdownOpen] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [deletedWords, setDeletedWords] = useState<Set<string>>(new Set()); // Track deleted words by unique ID
  
  // Calculate global word index from clip and local word index
  const getGlobalWordIndex = useCallback((clipId: string, localWordIndex: number): number => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return -1;
    return clip.startWordIndex + localWordIndex;
  }, [clips]);
  
  // Get unique word ID for tracking deletions
  const getWordId = useCallback((clip: Clip, wordIndex: number): string => {
    return `${clip.id}-${wordIndex}`;
  }, []);

  // Get active clips in playback order (for virtual timeline)
  const getActiveClips = useCallback(() => {
    return clips
      .filter(clip => clip.status === 'active')
      .sort((a, b) => a.order - b.order);
  }, [clips]);

  // Map original timestamp to virtual timeline position
  const getVirtualTime = useCallback((originalTime: number): number => {
    const activeClips = getActiveClips();
    let virtualTime = 0;
    
    for (const clip of activeClips) {
      if (originalTime >= clip.startTime && originalTime <= clip.endTime) {
        // Time falls within this clip
        return virtualTime + (originalTime - clip.startTime);
      } else if (originalTime > clip.endTime) {
        // Time is after this clip, add the clip's duration
        virtualTime += clip.duration;
      } else {
        // Time is before this clip, return current virtual time
        break;
      }
    }
    
    return virtualTime;
  }, [getActiveClips]);

  // Map virtual timeline position back to original timestamp
  const getOriginalTime = useCallback((virtualTime: number): number => {
    const activeClips = getActiveClips();
    let accumulatedTime = 0;
    
    for (const clip of activeClips) {
      if (virtualTime >= accumulatedTime && virtualTime <= accumulatedTime + clip.duration) {
        // Virtual time falls within this clip
        return clip.startTime + (virtualTime - accumulatedTime);
      }
      accumulatedTime += clip.duration;
    }
    
    // If beyond all clips, return the last clip's end time
    const lastClip = activeClips[activeClips.length - 1];
    return lastClip ? lastClip.endTime : 0;
  }, [getActiveClips]);

  // Get total virtual duration (sum of active clip durations)
  const getVirtualDuration = useCallback((): number => {
    return getActiveClips().reduce((total, clip) => total + clip.duration, 0);
  }, [getActiveClips]);
  
  // Handle word click for cursor positioning, selection (Edit Mode), and seeking (Listen Mode)
  const handleWordClick = useCallback((clip: Clip, wordIndex: number, event?: React.MouseEvent) => {
    // Don't handle clicks if we're actively dragging
    if (isDragging) {
      return;
    }
    
    // Don't handle clicks if we just finished a drag selection (give time for drag state to clear)
    if (selectedWords.size > 1 || hasDraggedMinDistance) {
      console.log('Ignoring word click - drag selection exists with', selectedWords.size, 'words or just finished dragging');
      return;
    }
    
    const word = clip.words[wordIndex];
    
    console.log('👆 WORD CLICKED:', { 
      timestamp: Date.now(),
      mode, 
      clipId: clip.id, 
      wordIndex, 
      word: word.word,
      shiftKey: event?.shiftKey,
      ctrlKey: event?.ctrlKey,
      metaKey: event?.metaKey,
      hasAnchor: !!selectionAnchor,
      anchorWord: selectionAnchor ? `${selectionAnchor.clipId}-${selectionAnchor.wordIndex}` : null,
      currentSelectionSize: selectedWords.size,
      currentSelection: Array.from(selectedWords).slice(0, 3),
      isDragging,
      hasDraggedMinDistance
    });
    
    // Focus the transcript for arrow keys
    if (mode === 'edit' && transcriptRef.current) {
      transcriptRef.current.focus();
    }
    
    if (mode === 'edit') {
      // Edit Mode: Handle selection and cursor positioning
      const wordId = getWordId(clip, wordIndex);
      
      // Handle selection logic
      if (event?.shiftKey && selectionAnchor) {
        console.log('ClipBasedTranscript - Shift-click selection extension');
        // Shift-click: extend selection within the same clip
        if (selectionAnchor.clipId === clip.id) {
          const startIndex = Math.min(selectionAnchor.wordIndex, wordIndex);
          const endIndex = Math.max(selectionAnchor.wordIndex, wordIndex);
          
          const newSelection = new Set<string>();
          for (let i = startIndex; i <= endIndex; i++) {
            newSelection.add(getWordId(clip, i));
          }
          console.log('ClipBasedTranscript - New selection size:', newSelection.size);
          debugSetSelectedWords(newSelection, 'word-click-extend');
        }
      } else if (event?.ctrlKey || event?.metaKey) {
        // Ctrl/Cmd-click: toggle individual word selection
        console.log('ClipBasedTranscript - Ctrl/Cmd-click toggle selection');
        const newSelection = new Set(selectedWords);
        if (newSelection.has(wordId)) {
          newSelection.delete(wordId);
        } else {
          newSelection.add(wordId);
        }
        debugSetSelectedWords(newSelection, 'word-click-extend-multi');
        setSelectionAnchor({ clipId: clip.id, wordIndex });
      } else {
        // Normal click: select single word and set anchor
        console.log('ClipBasedTranscript - Normal click, selecting word:', wordId);
        const newSelection = new Set<string>();
        newSelection.add(wordId);
        debugSetSelectedWords(newSelection, 'word-click-single');
        setSelectionAnchor({ clipId: clip.id, wordIndex });
        
        // Set cursor position for legacy use
        setCursorPosition({
          clipId: clip.id,
          wordIndex,
          position: 'before'
        });
        
        // Set word cursor position for visual cursor
        setWordCursorPosition({
          clipId: clip.id,
          wordIndex,
          position: 'before'
        });
        
        // Get word timestamp for seeking
        if (word && word.start !== undefined) {
          const timestamp = word.start;
          // Always update cursor time, regardless of playback state
          setLastCursorTime(timestamp);
          
          // Smart seeking logic:
          // - If audio is stopped, seek immediately
          // - If audio is playing, don't interrupt (cursor moves silently)
          if (!isPlaying && onSeek) {
            onSeek(timestamp);
          }
        }
      }
    } else if (mode === 'listen') {
      // Listen Mode: Use virtual timeline for seeking
      if (word && word.start !== undefined && onSeek) {
        // Check if this clip is active (not deleted)
        if (clip.status === 'active') {
          // Map original word time to virtual timeline
          const virtualTime = getVirtualTime(word.start);
          onSeek(virtualTime);
        }
        // If clip is deleted, clicking words does nothing in Listen Mode
      }
    }
  }, [mode, isPlaying, onSeek, selectedWords, selectionAnchor, getWordId, getVirtualTime, isDragging]);

  // Handle play with cursor resume logic
  const handlePlay = useCallback(() => {
    if (mode === 'edit' && !isPlaying && lastCursorTime !== null && onSeek && onPlay) {
      // If we have a cursor position and audio is stopped, seek to cursor position before playing
      onSeek(lastCursorTime);
      onPlay();
    } else if (onPlay) {
      // Normal play behavior
      onPlay();
    }
  }, [mode, isPlaying, lastCursorTime, onSeek, onPlay]);

  // Register custom play handler with parent component
  React.useEffect(() => {
    if (mode === 'edit' && onCustomPlay) {
      onCustomPlay(handlePlay);
    }
  }, [mode, onCustomPlay, handlePlay]);

  // Register virtual timeline functions with parent component
  React.useEffect(() => {
    if (onVirtualTimelineFunctions) {
      onVirtualTimelineFunctions({
        getVirtualTime,
        getOriginalTime,
        getVirtualDuration,
        getActiveClips
      });
    }
  }, [onVirtualTimelineFunctions, getVirtualTime, getOriginalTime, getVirtualDuration, getActiveClips]);

  // Handle word double-click for editing
  const handleWordDoubleClick = useCallback((clip: Clip, wordIndex: number) => {
    setEditingWord({
      clipId: clip.id,
      wordIndex,
      text: clip.words[wordIndex]?.word || ''
    });
  }, []);
  
  // Handle word edit save
  const handleWordEditSave = useCallback(() => {
    if (editingWord.clipId && editingWord.wordIndex !== null && editingWord.text.trim()) {
      if (updateClipWord) {
        // Use the new clips-first approach
        updateClipWord(editingWord.clipId, editingWord.wordIndex, editingWord.text.trim());
      } else {
        // Fallback to old segments approach for compatibility
        const globalWordIndex = getGlobalWordIndex(editingWord.clipId, editingWord.wordIndex);
        if (globalWordIndex >= 0) {
          // Find the actual segment and word to update
          let runningIndex = 0;
          const newSegments = [...segments];
          
          for (let segIndex = 0; segIndex < newSegments.length; segIndex++) {
            const segment = newSegments[segIndex];
            if (segment.words) {
              for (let wordIdx = 0; wordIdx < segment.words.length; wordIdx++) {
                if (runningIndex === globalWordIndex) {
                  newSegments[segIndex].words[wordIdx].word = editingWord.text.trim();
                  projectActions.updateSegments(newSegments);
                  break;
                }
                runningIndex++;
              }
            } else {
              runningIndex++;
            }
          }
        }
      }
    }
    setEditingWord({ clipId: null, wordIndex: null, text: '' });
  }, [editingWord, updateClipWord, segments, projectActions, getGlobalWordIndex]);
  
  // Handle word right-click for context menu
  const handleWordRightClick = useCallback((
    event: React.MouseEvent,
    clip: Clip,
    wordIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    
    const word = clip.words[wordIndex];
    const globalWordIndex = getGlobalWordIndex(clip.id, wordIndex);
    
    
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      wordData: {
        word,
        wordIndex,
        clipId: clip.id,
        globalWordIndex
      }
    });
  }, [getGlobalWordIndex]);
  
  // Handle word deletion (strikethrough)
  const handleWordDelete = useCallback((clip: Clip, wordIndex: number) => {
    const wordId = getWordId(clip, wordIndex);
    setDeletedWords(prev => {
      const newSet = new Set([...prev, wordId]);
      onDeletedWordsChange?.(newSet);
      return newSet;
    });
  }, [getWordId, onDeletedWordsChange]);
  
  // Handle word restore (remove strikethrough)
  const handleWordRestore = useCallback((clip: Clip, wordIndex: number) => {
    const wordId = getWordId(clip, wordIndex);
    setDeletedWords(prev => {
      const newSet = new Set(prev);
      newSet.delete(wordId);
      onDeletedWordsChange?.(newSet);
      return newSet;
    });
  }, [getWordId, onDeletedWordsChange]);

  // Handle selection deletion (creates clips and marks as deleted)
  const handleSelectionDelete = useCallback(() => {
    if (selectedWords.size === 0) return;
    
    console.log('ClipBasedTranscript - Delete key pressed, selected words:', selectedWords.size);
    
    // Find which clip contains the selected words (selection is within one clip)
    let targetClip: Clip | null = null;
    let selectedWordIndices: number[] = [];
    
    for (const clip of clips) {
      const clipWordIds = clip.words.map((_, idx) => getWordId(clip, idx));
      const intersection = clipWordIds.filter(id => selectedWords.has(id));
      
      if (intersection.length > 0) {
        targetClip = clip;
        selectedWordIndices = clipWordIds
          .map((id, idx) => selectedWords.has(id) ? idx : -1)
          .filter(idx => idx !== -1)
          .sort((a, b) => a - b);
        break;
      }
    }
    
    if (!targetClip || selectedWordIndices.length === 0) {
      console.log('ClipBasedTranscript - No target clip or word indices found');
      return;
    }
    
    console.log('ClipBasedTranscript - Found target clip:', targetClip.id, 'selected indices:', selectedWordIndices);
    
    // Check if selection is contiguous
    const isContiguous = selectedWordIndices.every((idx, i) => 
      i === 0 || idx === selectedWordIndices[i - 1] + 1
    );
    
    const startIdx = selectedWordIndices[0];
    const endIdx = selectedWordIndices[selectedWordIndices.length - 1];
    
    console.log('ClipBasedTranscript - Selection details:', { isContiguous, startIdx, endIdx, clipWordsLength: targetClip.words.length });
    
    if (!isContiguous) {
      console.log('ClipBasedTranscript - Non-contiguous selection - marking individual words as deleted');
      // For non-contiguous selections, just mark individual words as deleted
      selectedWords.forEach(wordId => {
        setDeletedWords(prev => {
          const newSet = new Set([...prev, wordId]);
          onDeletedWordsChange?.(newSet);
          return newSet;
        });
      });
    } else {
      // For contiguous selections, create a new clip for the selected portion and mark it as deleted
      if (startIdx === 0 && endIdx === targetClip.words.length - 1) {
        console.log('ClipBasedTranscript - Marking entire clip as deleted');
        // Selection is the entire clip - just mark the clip as deleted
        const updatedClips = clips.map(clip => 
          clip.id === targetClip.id 
            ? { ...clip, status: 'deleted' as const, modifiedAt: Date.now() }
            : clip
        );
        
        console.log('ClipBasedTranscript - Calling onClipsChange with updated clips:', updatedClips.length);
        onClipsChange?.(updatedClips);
      } else {
        console.log('ClipBasedTranscript - Need to split clip for partial selection');
        // Need to split the clip to isolate the selected portion
        const updatedClips = [...clips];
        
        if (startIdx === 0 && endIdx === 0) {
          // Single first word - mark it as deleted and keep the rest
          const deletedWord = {
            ...targetClip,
            id: `${targetClip.id}-deleted`,
            endTime: targetClip.words[0].end,
            endWordIndex: targetClip.startWordIndex,
            words: [targetClip.words[0]],
            text: targetClip.words[0].word,
            duration: targetClip.words[0].end - targetClip.words[0].start,
            status: 'deleted' as const,
            modifiedAt: Date.now()
          };
          
          const remainingPart = {
            ...targetClip,
            id: `${targetClip.id}-active`,
            startTime: targetClip.words[1].start,
            startWordIndex: targetClip.startWordIndex + 1,
            words: targetClip.words.slice(1),
            text: targetClip.words.slice(1).map(w => w.word).join(' '),
            duration: targetClip.endTime - targetClip.words[1].start,
            status: 'active' as const,
            order: targetClip.order + 0.1,
            modifiedAt: Date.now()
          };
          
          const clipIndex = updatedClips.findIndex(c => c.id === targetClip.id);
          updatedClips.splice(clipIndex, 1, deletedWord, remainingPart);
          
        } else if (startIdx === 0) {
          // Selection starts at beginning (multiple words) - split at end and mark first part as deleted
          const firstPart = {
            ...targetClip,
            id: `${targetClip.id}-deleted`,
            endTime: targetClip.words[endIdx].end,
            endWordIndex: targetClip.startWordIndex + endIdx,
            words: targetClip.words.slice(0, endIdx + 1),
            text: targetClip.words.slice(0, endIdx + 1).map(w => w.word).join(' '),
            duration: targetClip.words[endIdx].end - targetClip.startTime,
            status: 'deleted' as const,
            modifiedAt: Date.now()
          };
          
          const secondPart = {
            ...targetClip,
            id: `${targetClip.id}-active`,
            startTime: targetClip.words[endIdx + 1].start,
            startWordIndex: targetClip.startWordIndex + endIdx + 1,
            words: targetClip.words.slice(endIdx + 1),
            text: targetClip.words.slice(endIdx + 1).map(w => w.word).join(' '),
            duration: targetClip.endTime - targetClip.words[endIdx + 1].start,
            status: 'active' as const,
            order: targetClip.order + 0.1,
            modifiedAt: Date.now()
          };
          
          const clipIndex = updatedClips.findIndex(c => c.id === targetClip.id);
          updatedClips.splice(clipIndex, 1, firstPart, secondPart);
          
        } else if (endIdx === targetClip.words.length - 1) {
          // Selection ends at end - split at start and mark second part as deleted
          const firstPart = {
            ...targetClip,
            id: `${targetClip.id}-active`,
            endTime: targetClip.words[startIdx - 1].end,
            endWordIndex: targetClip.startWordIndex + startIdx - 1,
            words: targetClip.words.slice(0, startIdx),
            text: targetClip.words.slice(0, startIdx).map(w => w.word).join(' '),
            duration: targetClip.words[startIdx - 1].end - targetClip.startTime,
            status: 'active' as const,
            modifiedAt: Date.now()
          };
          
          const secondPart = {
            ...targetClip,
            id: `${targetClip.id}-deleted`,
            startTime: targetClip.words[startIdx].start,
            startWordIndex: targetClip.startWordIndex + startIdx,
            words: targetClip.words.slice(startIdx),
            text: targetClip.words.slice(startIdx).map(w => w.word).join(' '),
            duration: targetClip.endTime - targetClip.words[startIdx].start,
            status: 'deleted' as const,
            order: targetClip.order + 0.1,
            modifiedAt: Date.now()
          };
          
          const clipIndex = updatedClips.findIndex(c => c.id === targetClip.id);
          updatedClips.splice(clipIndex, 1, firstPart, secondPart);
          
        } else {
          // Selection is in middle - create three clips
          const firstPart = {
            ...targetClip,
            id: `${targetClip.id}-start`,
            endTime: targetClip.words[startIdx - 1].end,
            endWordIndex: targetClip.startWordIndex + startIdx - 1,
            words: targetClip.words.slice(0, startIdx),
            text: targetClip.words.slice(0, startIdx).map(w => w.word).join(' '),
            duration: targetClip.words[startIdx - 1].end - targetClip.startTime,
            status: 'active' as const,
            modifiedAt: Date.now()
          };
          
          const deletedPart = {
            ...targetClip,
            id: `${targetClip.id}-deleted`,
            startTime: targetClip.words[startIdx].start,
            endTime: targetClip.words[endIdx].end,
            startWordIndex: targetClip.startWordIndex + startIdx,
            endWordIndex: targetClip.startWordIndex + endIdx,
            words: targetClip.words.slice(startIdx, endIdx + 1),
            text: targetClip.words.slice(startIdx, endIdx + 1).map(w => w.word).join(' '),
            duration: targetClip.words[endIdx].end - targetClip.words[startIdx].start,
            status: 'deleted' as const,
            order: targetClip.order + 0.1,
            modifiedAt: Date.now()
          };
          
          const lastPart = {
            ...targetClip,
            id: `${targetClip.id}-end`,
            startTime: targetClip.words[endIdx + 1].start,
            startWordIndex: targetClip.startWordIndex + endIdx + 1,
            words: targetClip.words.slice(endIdx + 1),
            text: targetClip.words.slice(endIdx + 1).map(w => w.word).join(' '),
            duration: targetClip.endTime - targetClip.words[endIdx + 1].start,
            status: 'active' as const,
            order: targetClip.order + 0.2,
            modifiedAt: Date.now()
          };
          
          const clipIndex = updatedClips.findIndex(c => c.id === targetClip.id);
          updatedClips.splice(clipIndex, 1, firstPart, deletedPart, lastPart);
        }
        
        console.log('ClipBasedTranscript - Calling onClipsChange with split clips:', updatedClips.length);
        updatedClips.forEach((c, idx) => {
          console.log(`ClipBasedTranscript - Clip ${idx}:`, { 
            id: c.id, 
            status: c.status || 'undefined',
            order: c.order,
            words: c.words.length,
            text: c.text.substring(0, 30) + '...'
          });
        });
        onClipsChange?.(updatedClips);
      }
    }
    
    // Clear selection
    debugSetSelectedWords(new Set(), 'after-delete');
    setSelectionAnchor(null);
    console.log('ClipBasedTranscript - Selection cleared after deletion');
    
  }, [selectedWords, clips, getWordId, onClipsChange, debugSetSelectedWords, setSelectionAnchor, setDeletedWords, onDeletedWordsChange]);
  
  // Handle selection split (creates clips at selection boundaries)
  const handleSelectionSplit = useCallback(() => {
    if (selectedWords.size === 0) return;
    
    console.log('ClipBasedTranscript - Enter key pressed, selected words:', selectedWords.size);
    
    // Find which clip contains the selected words (selection is within one clip)
    let targetClip: Clip | null = null;
    let selectedWordIndices: number[] = [];
    
    for (const clip of clips) {
      const clipWordIds = clip.words.map((_, idx) => getWordId(clip, idx));
      const intersection = clipWordIds.filter(id => selectedWords.has(id));
      
      if (intersection.length > 0) {
        targetClip = clip;
        selectedWordIndices = clipWordIds
          .map((id, idx) => selectedWords.has(id) ? idx : -1)
          .filter(idx => idx !== -1)
          .sort((a, b) => a - b);
        break;
      }
    }
    
    if (!targetClip || selectedWordIndices.length === 0) {
      console.log('ClipBasedTranscript - No target clip or word indices found');
      return;
    }

    console.log('ClipBasedTranscript - Found target clip:', targetClip.id, 'selected indices:', selectedWordIndices);

    // Check if selection is contiguous
    const isContiguous = selectedWordIndices.every((idx, i) => 
      i === 0 || idx === selectedWordIndices[i - 1] + 1
    );

    if (!isContiguous) {
      console.log('ClipBasedTranscript - Non-contiguous selection - cannot split');
      return;
    }

    const startIdx = selectedWordIndices[0];
    const endIdx = selectedWordIndices[selectedWordIndices.length - 1];

    console.log('ClipBasedTranscript - Split selection details:', { startIdx, endIdx, clipWordsLength: targetClip.words.length });

    // For contiguous selections, create clips at boundaries like delete does
    const updatedClips = [...clips];

    if (startIdx === 0 && endIdx === targetClip.words.length - 1) {
      console.log('ClipBasedTranscript - Cannot split entire clip');
      // Cannot split entire clip - just clear selection
    } else if (startIdx === 0) {
      // Selection starts at beginning - split after selection
      console.log('ClipBasedTranscript - Splitting after selection at index:', endIdx + 1);
      if (splitClip) {
        const globalSplitIndex = targetClip.startWordIndex + endIdx + 1;
        splitClip(targetClip.id, globalSplitIndex);
      }
    } else if (endIdx === targetClip.words.length - 1) {
      // Selection ends at end - split before selection
      console.log('ClipBasedTranscript - Splitting before selection at index:', startIdx);
      if (splitClip) {
        const globalSplitIndex = targetClip.startWordIndex + startIdx;
        splitClip(targetClip.id, globalSplitIndex);
      }
    } else {
      // Selection is in middle - create three clips directly
      console.log('ClipBasedTranscript - Creating three clips at boundaries:', startIdx, 'and', endIdx + 1);
      
      const firstPart = {
        ...targetClip,
        id: `${targetClip.id}-start`,
        endTime: targetClip.words[startIdx - 1].end,
        endWordIndex: targetClip.startWordIndex + startIdx - 1,
        words: targetClip.words.slice(0, startIdx),
        text: targetClip.words.slice(0, startIdx).map(w => w.word).join(' '),
        duration: targetClip.words[startIdx - 1].end - targetClip.startTime,
        status: 'active' as const,
        modifiedAt: Date.now()
      };
      
      const middlePart = {
        ...targetClip,
        id: `${targetClip.id}-middle`,
        startTime: targetClip.words[startIdx].start,
        endTime: targetClip.words[endIdx].end,
        startWordIndex: targetClip.startWordIndex + startIdx,
        endWordIndex: targetClip.startWordIndex + endIdx,
        words: targetClip.words.slice(startIdx, endIdx + 1),
        text: targetClip.words.slice(startIdx, endIdx + 1).map(w => w.word).join(' '),
        duration: targetClip.words[endIdx].end - targetClip.words[startIdx].start,
        status: 'active' as const,
        order: targetClip.order + 0.1,
        modifiedAt: Date.now()
      };
      
      const lastPart = {
        ...targetClip,
        id: `${targetClip.id}-end`,
        startTime: targetClip.words[endIdx + 1].start,
        startWordIndex: targetClip.startWordIndex + endIdx + 1,
        words: targetClip.words.slice(endIdx + 1),
        text: targetClip.words.slice(endIdx + 1).map(w => w.word).join(' '),
        duration: targetClip.endTime - targetClip.words[endIdx + 1].start,
        status: 'active' as const,
        order: targetClip.order + 0.2,
        modifiedAt: Date.now()
      };
      
      const updatedClips = [...clips];
      const clipIndex = updatedClips.findIndex(c => c.id === targetClip.id);
      updatedClips.splice(clipIndex, 1, firstPart, middlePart, lastPart);
      
      console.log('ClipBasedTranscript - Created 3 clips, calling onClipsChange');
      onClipsChange?.(updatedClips);
    }

    // Clear selection
    debugSetSelectedWords(new Set(), 'after-split');
    setSelectionAnchor(null);
    console.log('ClipBasedTranscript - Selection cleared after split');
    
  }, [selectedWords, clips, getWordId, splitClip, onClipsChange, debugSetSelectedWords, setSelectionAnchor]);
  
  // Handle speaker click to show dropdown
  const handleSpeakerClick = useCallback((clipId: string, currentSpeaker: string) => {
    setSpeakerDropdownOpen(clipId);
    setEditingSpeaker(null); // Close any text editing
  }, []);

  // Handle speaker change for a specific clip - NEW APPROACH: use the hook's method
  const handleSpeakerChange = useCallback((clipId: string, newSpeakerId: string) => {
    console.log('handleSpeakerChange called', { clipId, newSpeakerId, hasUpdateClipSpeaker: !!updateClipSpeaker });
    
    if (updateClipSpeaker) {
      // Use the hook's updateClipSpeaker method which handles persistence
      console.log('Using updateClipSpeaker method');
      updateClipSpeaker(clipId, newSpeakerId);
    } else {
      // Fallback for old clip system
      console.log('Using fallback method');
      const updatedClips = clips.map(clip => 
        clip.id === clipId 
          ? { ...clip, speaker: newSpeakerId, modifiedAt: Date.now() }
          : clip
      );
      projectActions.updateClips(updatedClips);
    }
    setSpeakerDropdownOpen(null);
  }, [updateClipSpeaker, clips, projectActions]);
  
  // Handle speaker edit save
  const handleSpeakerEditSave = useCallback(() => {
    if (editingSpeaker && tempSpeakerName.trim()) {
      const updatedSpeakers = {
        ...projectState.globalSpeakers,
        [editingSpeaker]: tempSpeakerName.trim()
      };
      projectActions.updateSpeakers(updatedSpeakers);
    }
    setEditingSpeaker(null);
    setTempSpeakerName('');
  }, [editingSpeaker, tempSpeakerName, projectState.globalSpeakers, projectActions]);
  
  // Handle paragraph break / clip creation
  const handleCreateClip = useCallback((clip: Clip, wordIndex: number) => {
    // With persisted clips, we use splitClip which takes clipId and the global word index to split at
    if (splitClip) {
      // The wordIndex here is local to the clip, so we need to convert to global
      const globalWordIndex = clip.startWordIndex + wordIndex;
      splitClip(clip.id, globalWordIndex);
    } else {
      // Fallback to old method for compatibility
      const globalWordIndex = getGlobalWordIndex(clip.id, wordIndex);
      if (globalWordIndex >= 0) {
        createNewClip(globalWordIndex);
      }
    }
  }, [getGlobalWordIndex, createNewClip, splitClip]);

  // Handle merge with previous clip
  const handleMergeWithAbove = useCallback((clipId: string) => {
    
    if (mergeClipWithAbove) {
      mergeClipWithAbove(clipId);
    }
  }, [mergeClipWithAbove]);

  // Handle clip restoration
  const handleRestoreClip = useCallback((clipId: string) => {
    if (updateClipSpeaker) {
      // Find the clip and update its status to active
      const updatedClips = clips.map(clip => 
        clip.id === clipId 
          ? { ...clip, status: 'active' as const, modifiedAt: Date.now() }
          : clip
      );
      
      // Use the project action to update clips
      projectActions.updateClips(updatedClips);
    } else {
      console.warn('Cannot restore clip: updateClipSpeaker method not available');
    }
  }, [clips, updateClipSpeaker, projectActions]);
  
  // Context menu items
  const contextMenuItems = React.useMemo(() => {
    const wordData = contextMenu.wordData;
    if (!wordData) return [];
    
    const wordId = getWordId(clips.find(c => c.id === wordData.clipId)!, wordData.wordIndex);
    const isDeleted = deletedWords.has(wordId);
    
    const items = [
      createContextMenuItem(
        "Edit Word",
        () => {
          const clip = clips.find(c => c.id === wordData.clipId);
          if (clip) {
            handleWordDoubleClick(clip, wordData.wordIndex);
          }
        },
        'edit'
      ),
      createContextMenuItem(
        isDeleted ? "Restore Word" : "Delete Word",
        () => {
          const clip = clips.find(c => c.id === wordData.clipId);
          if (clip) {
            if (isDeleted) {
              handleWordRestore(clip, wordData.wordIndex);
            } else {
              handleWordDelete(clip, wordData.wordIndex);
            }
          }
        },
        isDeleted ? 'restore' : 'delete'
      ),
      { label: "", isSeparator: true },
      createContextMenuItem(
        "Split Clip Here",
        () => {
          const clip = clips.find(c => c.id === wordData.clipId);
          if (clip) {
            handleCreateClip(clip, wordData.wordIndex);
          }
        },
        'split'
      )
    ];
    
    return items;
  }, [contextMenu.wordData, clips, deletedWords, getWordId, handleWordDoubleClick, handleWordDelete, handleWordRestore, handleCreateClip]);
  

  
  // Clear browser selections in Edit Mode (only within transcript)
  useEffect(() => {
    if (mode === 'edit') {
      const clearSelection = () => {
        // Don't clear selection if we're actively dragging
        if (isDragging || hasDraggedMinDistance) {
          return;
        }
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          // Only clear selection if it's within the transcript area
          const range = selection.getRangeAt(0);
          if (transcriptRef.current && transcriptRef.current.contains(range.commonAncestorContainer)) {
            selection.removeAllRanges();
          }
        }
      };
      
      // Clear selection immediately
      clearSelection();
      
      // Also clear on any selection change events
      document.addEventListener('selectionchange', clearSelection);
      return () => document.removeEventListener('selectionchange', clearSelection);
    }
  }, [mode, isDragging, hasDraggedMinDistance]);

  // Focus transcript when entering edit mode
  useEffect(() => {
    if (mode === 'edit' && transcriptRef.current) {
      // Delay focus to ensure DOM is ready
      setTimeout(() => {
        transcriptRef.current?.focus();
      }, 100);
    }
  }, [mode]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };
    
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);
  
  // Get available speakers for dropdown (must be before early return)
  const availableSpeakers = React.useMemo(() => {
    const speakers: Array<{id: string, name: string}> = [];
    
    // Add all known speakers from globalSpeakers
    if (projectState.globalSpeakers && Object.keys(projectState.globalSpeakers).length > 0) {
      Object.entries(projectState.globalSpeakers).forEach(([id, name]) => {
        speakers.push({ id, name });
      });
    } else {
      // If no globalSpeakers, create from unique clip speakers
      const uniqueSpeakers = new Set<string>();
      clips.forEach(clip => {
        if (clip.speaker && !uniqueSpeakers.has(clip.speaker)) {
          uniqueSpeakers.add(clip.speaker);
          speakers.push({ 
            id: clip.speaker, 
            name: clip.speaker // Use speaker ID as display name when no mapping exists
          });
        }
      });
    }
    
    return speakers;
  }, [projectState.globalSpeakers, clips]);

  

  // Get clips to display based on current mode
  const displayClips = React.useMemo(() => {
    if (mode === 'edit') {
      // Edit Mode: Show all clips in original order
      const sortedClips = clips.sort((a, b) => a.order - b.order);
      console.log('ClipBasedTranscript - Display clips in Edit Mode:', sortedClips.map(c => ({
        id: c.id,
        status: c.status,
        order: c.order,
        words: c.words.length
      })));
      return sortedClips;
    } else {
      // Listen Mode: Show only active clips in order
      return getActiveClips();
    }
  }, [clips, mode, getActiveClips]);

  // Helper function to find word above or below current position
  const findWordInDirection = useCallback((
    currentPos: { clipId: string; wordIndex: number; position: 'before' | 'after' },
    direction: 'up' | 'down'
  ): { clipId: string; wordIndex: number; position: 'before' | 'after' } | null => {
    
    console.log('findWordInDirection called:', { currentPos, direction });
    
    try {
      // Find the current word element to get its position
      const currentWordElement = document.querySelector(`[data-word-id="${currentPos.clipId}-${currentPos.wordIndex}"]`);
      console.log('Current word element found:', !!currentWordElement, `[data-word-id="${currentPos.clipId}-${currentPos.wordIndex}"]`);
      
      if (!currentWordElement) return null;
      
      const currentRect = currentWordElement.getBoundingClientRect();
      const currentX = currentRect.left + (currentRect.width / 2); // Center of current word
      const currentY = currentRect.top + (currentRect.height / 2);
      
      console.log('Current word position:', { x: currentX, y: currentY, rect: currentRect });
      
      let targetY: number;
      if (direction === 'up') {
        targetY = currentY - currentRect.height - 10; // Look above current line
      } else {
        targetY = currentY + currentRect.height + 10; // Look below current line  
      }
      
      console.log('Target Y position:', targetY);
      
      // Find all word elements and their positions
      const allWordElements = document.querySelectorAll('[data-word-id]');
      console.log('Total word elements found:', allWordElements.length);
      
      let closestWord: { element: Element; distance: number; clipId: string; wordIndex: number; y: number } | null = null;
      
      for (const wordElement of allWordElements) {
        const wordRect = wordElement.getBoundingClientRect();
        const wordY = wordRect.top + (wordRect.height / 2);
        const wordX = wordRect.left + (wordRect.width / 2);
        
        // Check if this word is on the target line (roughly)
        const yDiff = Math.abs(wordY - targetY);
        
        // More generous line detection
        const isOnTargetLine = yDiff < currentRect.height * 1.5;
        
        // Also check if it's actually in the right direction
        const isCorrectDirection = direction === 'up' ? wordY < currentY - 5 : wordY > currentY + 5;
        
        if (!isOnTargetLine || !isCorrectDirection) continue;
        
        // Calculate horizontal distance from current cursor position
        const xDistance = Math.abs(wordX - currentX);
        
        if (!closestWord || xDistance < closestWord.distance) {
          const wordId = wordElement.getAttribute('data-word-id');
          if (wordId && wordId !== `${currentPos.clipId}-${currentPos.wordIndex}`) { // Don't select current word
            // Parse word ID more carefully - last part after final dash is word index
            const lastDashIndex = wordId.lastIndexOf('-');
            const clipId = wordId.substring(0, lastDashIndex);
            const wordIndexStr = wordId.substring(lastDashIndex + 1);
            const wordIndex = parseInt(wordIndexStr);
            
            console.log('Parsing word ID:', { wordId, clipId, wordIndexStr, wordIndex });
            
            closestWord = {
              element: wordElement,
              distance: xDistance,
              clipId,
              wordIndex,
              y: wordY
            };
          }
        }
      }
      
      console.log('Closest word found:', closestWord);
      
      if (closestWord) {
        return {
          clipId: closestWord.clipId,
          wordIndex: closestWord.wordIndex,
          position: 'before'
        };
      }
      
    } catch (error) {
      console.warn('Error in findWordInDirection:', error);
    }
    
    console.log('No word found in direction:', direction);
    return null;
  }, []);

  // Helper function to move cursor by words
  const moveCursorByWord = useCallback((direction: 'left' | 'right' | 'up' | 'down', extendSelection: boolean = false) => {
    if (!wordCursorPosition) {
      // If no cursor position, start at beginning of first clip
      if (displayClips.length > 0) {
        const startPosition = {
          clipId: displayClips[0].id,
          wordIndex: 0,
          position: 'before' as const
        };
        setWordCursorPosition(startPosition);
        
        // If extending selection, set anchor
        if (extendSelection) {
          setSelectionAnchor({ clipId: displayClips[0].id, wordIndex: 0 });
        }
      }
      return;
    }

    const currentClip = displayClips.find(c => c.id === wordCursorPosition.clipId);
    if (!currentClip) return;

    const currentClipIndex = displayClips.findIndex(c => c.id === wordCursorPosition.clipId);
    let newPosition: { clipId: string; wordIndex: number; position: 'before' | 'after' } | null = null;
    
    if (direction === 'up' || direction === 'down') {
      // Vertical navigation: find word above or below current cursor position
      console.log('moveCursorByWord - calling findWordInDirection with:', { wordCursorPosition, direction });
      newPosition = findWordInDirection(wordCursorPosition, direction);
      console.log('moveCursorByWord - findWordInDirection returned:', newPosition);
    } else if (direction === 'left') {
      // Left arrow: move to before previous word (skip over spaces)
      if (wordCursorPosition.wordIndex > 0) {
        // Move to before previous word in same clip
        newPosition = {
          clipId: wordCursorPosition.clipId,
          wordIndex: wordCursorPosition.wordIndex - 1,
          position: 'before'
        };
      } else if (currentClipIndex > 0) {
        // Move to before last word of previous clip
        const prevClip = displayClips[currentClipIndex - 1];
        newPosition = {
          clipId: prevClip.id,
          wordIndex: prevClip.words.length - 1,
          position: 'before'
        };
      }
      // If at very beginning, do nothing
    } else { // direction === 'right'
      // Right arrow: move to before next word (skip over spaces)
      if (wordCursorPosition.wordIndex < currentClip.words.length - 1) {
        // Move to before next word in same clip
        newPosition = {
          clipId: wordCursorPosition.clipId,
          wordIndex: wordCursorPosition.wordIndex + 1,
          position: 'before'
        };
      } else if (currentClipIndex < displayClips.length - 1) {
        // Move to beginning of next clip
        const nextClip = displayClips[currentClipIndex + 1];
        newPosition = {
          clipId: nextClip.id,
          wordIndex: 0,
          position: 'before'
        };
      }
      // If at very end, do nothing
    }
    
    if (newPosition) {
      console.log('moveCursorByWord - setting new position:', newPosition);
      setWordCursorPosition(newPosition);
      
      // Handle selection logic
      if (extendSelection) {
        // If we don't have a selection anchor, set it to current position
        if (!selectionAnchor) {
          setSelectionAnchor({ 
            clipId: wordCursorPosition.clipId, 
            wordIndex: wordCursorPosition.wordIndex 
          });
        }
        
        // Calculate selection between anchor and new cursor position
        updateSelectionFromAnchor(newPosition);
      } else {
        // Clear selection if not extending
        debugSetSelectedWords(new Set(), 'moveCursor-no-extend');
        setSelectionAnchor(null);
      }
    } else {
      console.log('moveCursorByWord - no new position found for direction:', direction);
    }
  }, [wordCursorPosition, displayClips, selectionAnchor]);
  
  // Helper function to update selection based on anchor and cursor position
  const updateSelectionFromAnchor = useCallback((cursorPos: { clipId: string; wordIndex: number; position: 'before' | 'after' }) => {
    if (!selectionAnchor) return;
    
    // Only support selection within the same clip for now
    if (selectionAnchor.clipId !== cursorPos.clipId) return;
    
    const clip = displayClips.find(c => c.id === cursorPos.clipId);
    if (!clip) return;
    
    // Determine the actual word indices for selection
    let anchorWordIndex = selectionAnchor.wordIndex;
    let cursorWordIndex = cursorPos.wordIndex;
    
    // Adjust cursor word index based on position
    if (cursorPos.position === 'before' && cursorWordIndex > 0) {
      cursorWordIndex -= 1; // Select up to the word before cursor
    }
    
    // Create selection between anchor and cursor
    const startIndex = Math.min(anchorWordIndex, cursorWordIndex);
    const endIndex = Math.max(anchorWordIndex, cursorWordIndex);
    
    const newSelection = new Set<string>();
    for (let i = startIndex; i <= endIndex; i++) {
      newSelection.add(getWordId(clip, i));
    }
    
    debugSetSelectedWords(newSelection, 'updateSelection-from-anchor');
  }, [selectionAnchor, displayClips, getWordId]);

  // Helper function to find word at mouse coordinates
  const findWordAtPosition = useCallback((x: number, y: number): { clipId: string; wordIndex: number } | null => {
    const elementAtPoint = document.elementFromPoint(x, y);
    if (!elementAtPoint) return null;
    
    // Check if we hit a word element directly
    const wordElement = elementAtPoint.closest('[data-word-id]');
    if (wordElement) {
      const wordId = wordElement.getAttribute('data-word-id');
      if (wordId) {
        const lastDashIndex = wordId.lastIndexOf('-');
        const clipId = wordId.substring(0, lastDashIndex);
        const wordIndex = parseInt(wordId.substring(lastDashIndex + 1));
        return { clipId, wordIndex };
      }
    }
    
    return null;
  }, []);

  // Helper function to find closest word when clicking between words
  const findClosestWord = useCallback((x: number, y: number, clipId: string): { clipId: string; wordIndex: number } | null => {
    const clip = displayClips.find(c => c.id === clipId);
    if (!clip || !clip.words.length) {
      console.log('findClosestWord: No clip found or no words:', clipId);
      return null;
    }
    
    let closestWord = null;
    let closestDistance = Infinity;
    
    // Get all word elements in this clip
    const wordElements = document.querySelectorAll(`[data-word-id^="${clipId}-"]`);
    console.log('findClosestWord: Found word elements:', wordElements.length);
    
    for (const wordElement of wordElements) {
      const rect = wordElement.getBoundingClientRect();
      const wordCenterX = rect.left + rect.width / 2;
      const wordCenterY = rect.top + rect.height / 2;
      
      // Calculate distance from click point to word center
      const distance = Math.sqrt(
        Math.pow(x - wordCenterX, 2) + Math.pow(y - wordCenterY, 2)
      );
      
      if (distance < closestDistance) {
        const wordId = wordElement.getAttribute('data-word-id');
        if (wordId) {
          const lastDashIndex = wordId.lastIndexOf('-');
          const parsedClipId = wordId.substring(0, lastDashIndex);
          const wordIndex = parseInt(wordId.substring(lastDashIndex + 1));
          
          if (parsedClipId === clipId) {
            closestWord = { clipId: parsedClipId, wordIndex };
            closestDistance = distance;
          }
        }
      }
    }
    
    console.log('findClosestWord: Closest word found:', closestWord, 'distance:', closestDistance);
    return closestWord;
  }, [displayClips]);

  // Helper function to update drag selection
  const updateDragSelection = useCallback(() => {
    console.log('updateDragSelection called:', { dragStart, dragCurrent, isDragging });
    if (!dragStart || !dragCurrent) {
      console.log('updateDragSelection: missing dragStart or dragCurrent, not updating selection');
      return;
    }
    
    // Only allow selection within the same clip
    if (dragStart.clipId !== dragCurrent.clipId) {
      console.log('updateDragSelection: different clips, not updating selection');
      return;
    }
    
    const clip = displayClips.find(c => c.id === dragStart.clipId);
    if (!clip) {
      console.log('updateDragSelection: clip not found, not updating selection');
      return;
    }
    
    const startIndex = Math.min(dragStart.wordIndex, dragCurrent.wordIndex);
    const endIndex = Math.max(dragStart.wordIndex, dragCurrent.wordIndex);
    
    const newSelection = new Set<string>();
    for (let i = startIndex; i <= endIndex; i++) {
      newSelection.add(getWordId(clip, i));
    }
    
    console.log('updateDragSelection: setting selection with', newSelection.size, 'words');
    debugSetSelectedWords(newSelection, 'drag-update');
    setSelectionAnchor({ clipId: dragStart.clipId, wordIndex: dragStart.wordIndex });
  }, [dragStart, dragCurrent, displayClips, getWordId, isDragging]);

  // Update selection when drag changes (only during active dragging)
  useEffect(() => {
    console.log('Drag useEffect triggered:', { isDragging, dragStart: !!dragStart, dragCurrent: !!dragCurrent });
    // Only update selection if we're actively dragging
    if (isDragging && dragStart && dragCurrent) {
      console.log('Drag useEffect: calling updateDragSelection');
      updateDragSelection();
    } else {
      console.log('Drag useEffect: NOT calling updateDragSelection - either not dragging or missing drag data');
      // Don't do anything when drag ends - handleMouseUp manages final selection
    }
  }, [isDragging, dragStart, dragCurrent, updateDragSelection]);

  // Handle mouse events for drag selection
  const handleMouseDown = useCallback((e: React.MouseEvent, clipId: string) => {
    console.log('🖱️  MOUSE DOWN:', {
      timestamp: Date.now(),
      clipId,
      clientX: e.clientX,
      clientY: e.clientY,
      target: (e.target as HTMLElement)?.tagName,
      targetDataWordId: (e.target as HTMLElement)?.getAttribute('data-word-id'),
      button: e.button,
      currentSelection: Array.from(selectedWords).slice(0, 3),
      selectionSize: selectedWords.size
    });

    if (mode !== 'edit') return;
    if (e.button !== 0) return; // Only left mouse button
    
    // Try to find word at mouse position first
    let wordAtMouse = findWordAtPosition(e.clientX, e.clientY);
    console.log('🎯 WORD DETECTION:', {
      directHit: !!wordAtMouse,
      wordAtMouse,
      targetClipId: clipId
    });
    
    if (!wordAtMouse || wordAtMouse.clipId !== clipId) {
      // Clicked between words - find the closest word in this clip
      console.log('🔍 Finding closest word in clip:', clipId);
      wordAtMouse = findClosestWord(e.clientX, e.clientY, clipId);
      console.log('🎯 CLOSEST WORD:', wordAtMouse);
    }
    
    if (wordAtMouse && wordAtMouse.clipId === clipId) {
      console.log('Mouse down starting drag from word:', wordAtMouse);
      const dragStartWithCoords = { ...wordAtMouse, x: e.clientX, y: e.clientY };
      setDragStart(dragStartWithCoords);
      setDragCurrent(wordAtMouse);
      setHasDraggedMinDistance(false);
      
      // Prevent default to avoid text selection
      e.preventDefault();
    } else {
      console.log('No word found for drag start in clip:', clipId);
    }
  }, [mode, findWordAtPosition, findClosestWord]);

  const handleMouseMove = useCallback((e: React.MouseEvent, clipId: string) => {
    if (!dragStart) return;
    if (dragStart.clipId !== clipId) return; // Stay within same clip
    
    // Check if we've moved enough to start dragging
    if ('x' in dragStart && 'y' in dragStart) {
      const deltaX = Math.abs(e.clientX - dragStart.x);
      const deltaY = Math.abs(e.clientY - dragStart.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (!hasDraggedMinDistance && distance > 10) {
        console.log('🏁 DRAG STARTING:', {
          distance,
          deltaX,
          deltaY,
          from: dragStart,
          to: { x: e.clientX, y: e.clientY }
        });
        setIsDragging(true);
        setHasDraggedMinDistance(true);
      }
    }
    
    if (isDragging || hasDraggedMinDistance) {
      console.log('🖱️  MOUSE MOVE (dragging):', {
        clipId,
        clientX: e.clientX,
        clientY: e.clientY,
        isDragging,
        hasDraggedMinDistance
      });
      let wordAtMouse = findWordAtPosition(e.clientX, e.clientY);
      
      if (!wordAtMouse || wordAtMouse.clipId !== clipId) {
        // If not directly over a word, find closest word in this clip
        wordAtMouse = findClosestWord(e.clientX, e.clientY, clipId);
      }
      
      if (wordAtMouse && wordAtMouse.clipId === clipId) {
        setDragCurrent(wordAtMouse);
      }
    }
  }, [isDragging, dragStart, hasDraggedMinDistance, findWordAtPosition, findClosestWord]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && hasDraggedMinDistance) {
      console.log('Drag selection ended - finalizing selection');
      
      // Create final selection directly without relying on updateDragSelection
      if (dragStart && dragCurrent) {
        console.log('Creating final selection directly');
        
        // Only allow selection within the same clip
        if (dragStart.clipId === dragCurrent.clipId) {
          const clip = displayClips.find(c => c.id === dragStart.clipId);
          if (clip) {
            const startIndex = Math.min(dragStart.wordIndex, dragCurrent.wordIndex);
            const endIndex = Math.max(dragStart.wordIndex, dragCurrent.wordIndex);
            
            const finalSelection = new Set<string>();
            for (let i = startIndex; i <= endIndex; i++) {
              finalSelection.add(getWordId(clip, i));
            }
            
            console.log('Setting final drag selection with', finalSelection.size, 'words');
            debugSetSelectedWords(finalSelection, 'drag-final');
            setSelectionAnchor({ clipId: dragStart.clipId, wordIndex: dragStart.wordIndex });
          }
        }
      }
      
      // Clear drag state immediately
      console.log('Clearing drag state after successful drag selection');
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      // Keep hasDraggedMinDistance true for a moment to prevent immediate word clicks
      setTimeout(() => {
        setHasDraggedMinDistance(false);
      }, 100);
    } else if (dragStart && !hasDraggedMinDistance) {
      console.log('Click detected (no drag movement)');
      // This was just a click, clear drag state but don't interfere with word clicks
      setDragStart(null);
      setDragCurrent(null);
      setHasDraggedMinDistance(false);
    }
  }, [isDragging, hasDraggedMinDistance, dragStart, dragCurrent, displayClips, getWordId]);

  // Global mouse up handler to catch mouse up outside component
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  // Handle keyboard events (only when transcript is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      
      // Debug logging
      console.log('ClipBasedTranscript - Key event detected:', {
        key: e.key,
        mode,
        activeElement: activeElement?.tagName,
        activeElementClass: activeElement?.className,
        isInput: activeElement?.tagName === 'INPUT',
        isTextarea: activeElement?.tagName === 'TEXTAREA',
        isSelect: activeElement?.tagName === 'SELECT',
        isInTranscript: transcriptRef.current?.contains(activeElement),
        editingWord: !!editingWord.clipId,
        editingSpeaker: !!editingSpeaker,
        hasWordCursor: !!wordCursorPosition
      });
      
      // Only block if we're actually in a form input field (not in the transcript)
      const isFormInput = activeElement && (
        (activeElement.tagName === 'INPUT' && activeElement !== transcriptRef.current) ||
        (activeElement.tagName === 'TEXTAREA' && activeElement !== transcriptRef.current) ||
        activeElement.tagName === 'SELECT'
      ) && !transcriptRef.current?.contains(activeElement);
      
      if (isFormInput) {
        console.log('ClipBasedTranscript - Blocking key event for form input');
        return; // Let the form field handle the event normally
      }
      
      console.log('ClipBasedTranscript - Processing key event:', {
        key: e.key,
        mode,
        editingWord: !!editingWord.clipId,
        editingSpeaker: !!editingSpeaker,
        selectedWordsSize: selectedWords.size,
        repeat: e.repeat,
        hasWordCursor: !!wordCursorPosition
      });
      
      if (editingWord.clipId || editingSpeaker) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (editingWord.clipId) handleWordEditSave();
          if (editingSpeaker) handleSpeakerEditSave();
        } else if (e.key === 'Escape') {
          setEditingWord({ clipId: null, wordIndex: null, text: '' });
          setEditingSpeaker(null);
          setTempSpeakerName('');
        }
      } else if (mode === 'edit') {
        // Handle spacebar for play/pause in Edit Mode
        if (e.key === ' ' && !e.repeat) {
          console.log('ClipBasedTranscript - Spacebar pressed, calling handlePlay');
          e.preventDefault();
          handlePlay();
        }
        // Handle Delete key for selection deletion
        else if (e.key === 'Delete' || e.key === 'Backspace') {
          console.log('ClipBasedTranscript - Delete/Backspace pressed, calling handleSelectionDelete');
          e.preventDefault();
          handleSelectionDelete();
        }
        // Handle Enter key for selection splitting or cursor splitting
        else if (e.key === 'Enter') {
          console.log('ClipBasedTranscript - Enter pressed, selectedWords:', selectedWords.size, 'hasWordCursor:', !!wordCursorPosition);
          e.preventDefault();
          
          if (selectedWords.size > 0) {
            // If there's a selection, split at selection boundaries
            console.log('ClipBasedTranscript - Using handleSelectionSplit for selection');
            handleSelectionSplit();
          } else if (wordCursorPosition) {
            // If there's a cursor position but no selection, split at cursor
            console.log('ClipBasedTranscript - Using handleCreateClip for cursor position');
            const clip = clips.find(c => c.id === wordCursorPosition.clipId);
            if (clip) {
              let splitPosition = wordCursorPosition.wordIndex;
              if (wordCursorPosition.position === 'after') {
                splitPosition = wordCursorPosition.wordIndex + 1;
              }
              // Ensure split position is within bounds
              splitPosition = Math.max(0, Math.min(splitPosition, clip.words.length - 1));
              handleCreateClip(clip, splitPosition);
            }
          }
        }
        // Handle Escape to clear selection
        else if (e.key === 'Escape') {
          console.log('ClipBasedTranscript - Escape pressed, clearing selection');
          debugSetSelectedWords(new Set(), 'escape-key');
          setSelectionAnchor(null);
          setWordCursorPosition(null); // Also clear cursor position
        }
        // Handle arrow keys for word navigation
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          console.log('ClipBasedTranscript - Global arrow key pressed:', e.key, 'shiftKey:', e.shiftKey);
          e.preventDefault();
          
          let direction: 'left' | 'right' | 'up' | 'down';
          if (e.key === 'ArrowLeft') direction = 'left';
          else if (e.key === 'ArrowRight') direction = 'right';
          else if (e.key === 'ArrowUp') direction = 'up';
          else direction = 'down';
          
          const extendSelection = e.shiftKey;
          console.log('ClipBasedTranscript - Calling moveCursorByWord:', direction, extendSelection ? 'with selection' : 'without selection');
          moveCursorByWord(direction, extendSelection);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, editingWord, editingSpeaker, handleWordEditSave, handleSpeakerEditSave, handlePlay, handleSelectionDelete, handleSelectionSplit, handleCreateClip, moveCursorByWord, wordCursorPosition, updateSelectionFromAnchor, selectedWords, clips]);

  // Early return for empty clips (after all hooks)
  if (clips.length === 0) {
    return (
      <main className="flex-1 p-8 bg-white font-transcript overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 text-center py-12">
            No transcript loaded. Import an audio file to begin.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main 
      className="flex-1 p-8 bg-white font-transcript overflow-y-auto" 
      ref={transcriptRef}
      tabIndex={0}
      onFocus={() => console.log('Transcript focused')}
      style={{ outline: 'none' }}
    >
      <div className="max-w-4xl mx-auto">
        {displayClips.map((clip, clipIndex) => {
          const isDeleted = clip.status === 'deleted';
          const baseClasses = `mb-12 p-6 border-l-4 rounded-r-lg shadow-sm ${selectedClipId === clip.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`;
          const statusClasses = isDeleted 
            ? 'opacity-60 bg-red-50 border-red-300' 
            : clip.type === 'user-created' 
              ? 'bg-green-50 border-green-400' 
              : 'bg-white';
          
          return (
          <div 
            key={clip.id} 
            data-clip-id={clip.id}
            className={`${baseClasses} ${statusClasses}`}
            onClick={() => selectClip(clip.id)}
          >
            {/* Clip header with speaker and controls */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 relative">
                {speakerDropdownOpen === clip.id ? (
                  <div className="relative">
                    <select
                      value={clip.speaker}
                      onChange={(e) => {
                        handleSpeakerChange(clip.id, e.target.value);
                        setSpeakerDropdownOpen(null);
                      }}
                      onBlur={(e) => {
                        // Use setTimeout to allow click events on options to fire first
                        setTimeout(() => {
                          setSpeakerDropdownOpen(null);
                        }, 200);
                      }}
                      className="text-sm font-semibold text-blue-600 uppercase tracking-wide bg-blue-50 border border-blue-300 rounded px-2 py-1 outline-none"
                      autoFocus
                    >
                      {availableSpeakers.map(speaker => (
                        <option key={speaker.id} value={speaker.id}>
                          {speaker.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span
                    className="text-sm font-semibold text-blue-600 uppercase tracking-wide cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeakerClick(clip.id, clip.speaker);
                    }}
                  >
                    {projectState.globalSpeakers?.[clip.speaker] || clip.speaker}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {new Date(clip.startTime * 1000).toISOString().substr(14, 5)} - {new Date(clip.endTime * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
              <div className="flex gap-2">
                {isDeleted ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestoreClip(clip.id);
                    }}
                    className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 rounded text-green-700"
                    title="Restore deleted clip"
                  >
                    ↶ Restore
                  </button>
                ) : (
                  mode === 'edit' && clipIndex > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMergeWithAbove(clip.id);
                      }}
                      className="text-xs px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded text-orange-700"
                      title="Merge with clip above"
                    >
                      ↑ Merge
                    </button>
                  )
                )}
              </div>
            </div>
            
            {/* Clip content - editable words */}
            <div 
              className={`leading-[1.4] ${isDeleted ? 'line-through text-gray-500' : 'text-gray-900'}`}
              style={{
                fontFamily: fontSettings?.fontFamily || 'Avenir',
                fontSize: `${fontSettings?.fontSize || 35}px`,
                userSelect: mode === 'edit' ? 'none' : 'text',
                caretColor: 'transparent' // Hide the browser cursor completely
              }}
              contentEditable={mode === 'edit' && !editingWord.clipId && !editingSpeaker && !isDeleted}
              suppressContentEditableWarning={true}
              onMouseDown={(e) => handleMouseDown(e, clip.id)}
              onMouseMove={(e) => handleMouseMove(e, clip.id)}
              onMouseUp={handleMouseUp}
              onClick={(e) => {
                // Handle clicks between words to position cursor
                console.log('📍 EMPTY SPACE CLICK:', {
                  timestamp: Date.now(),
                  clipId: clip.id,
                  isEmptySpaceClick: e.target === e.currentTarget,
                  target: (e.target as HTMLElement)?.tagName,
                  targetId: (e.target as HTMLElement)?.id,
                  currentTarget: (e.currentTarget as HTMLElement)?.tagName,
                  selectedWordsSize: selectedWords.size,
                  hasDraggedMinDistance,
                  isDragging,
                  willIgnore: selectedWords.size > 1 || hasDraggedMinDistance
                });

                if (mode === 'edit' && e.target === e.currentTarget) {
                  // Don't clear selection if we just finished a drag or have multiple words selected
                  if (selectedWords.size > 1 || hasDraggedMinDistance) {
                    console.log('⏭️  IGNORING empty space click - drag selection exists or just finished dragging');
                    return;
                  }
                  
                  console.log('🧹 CLEARING selection from empty space click');
                  e.preventDefault();
                  // Clear word selection when clicking in empty space
                  debugSetSelectedWords(new Set(), 'empty-space-click');
                  setSelectionAnchor(null);
                  
                  // Position cursor at end of clip
                  setWordCursorPosition({
                    clipId: clip.id,
                    wordIndex: clip.words.length - 1,
                    position: 'after'
                  });
                  
                  // Clear any browser selection to prevent character cursor
                  const selection = window.getSelection();
                  if (selection) {
                    selection.removeAllRanges();
                  }
                }
              }}
              onKeyDown={(e) => {
                console.log('ClipBasedTranscript - ContentEditable keydown:', {
                  key: e.key,
                  mode,
                  shiftKey: e.shiftKey,
                  clipId: clip.id
                });
                
                // Handle arrow keys for word-by-word navigation directly here
                if (mode === 'edit' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  let direction: 'left' | 'right' | 'up' | 'down';
                  if (e.key === 'ArrowLeft') direction = 'left';
                  else if (e.key === 'ArrowRight') direction = 'right';
                  else if (e.key === 'ArrowUp') direction = 'up';
                  else direction = 'down';
                  
                  const extendSelection = e.shiftKey;
                  console.log('ClipBasedTranscript - Arrow key in contentEditable:', direction, extendSelection ? 'with selection' : 'without selection');
                  moveCursorByWord(direction, extendSelection);
                  return;
                }
                
                // Prevent other cursor movement keys
                if (mode === 'edit' && (
                  e.key === 'Home' || e.key === 'End' ||
                  e.key === 'PageUp' || e.key === 'PageDown'
                )) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
              }}
              onInput={(e) => {
                // Prevent any text input in Edit Mode to maintain word-only editing
                if (mode === 'edit') {
                  e.preventDefault();
                  return false;
                }
              }}
            >
              {clip.words.map((word, wordIndex) => {
                const isEditing = editingWord.clipId === clip.id && editingWord.wordIndex === wordIndex;
                const wordId = getWordId(clip, wordIndex);
                const isDeleted = deletedWords.has(wordId);
                const isSelected = selectedWords.has(wordId);
                
                return (
                  <React.Fragment key={`${clip.id}-${wordIndex}`}>
                    {/* Cursor indicator before word */}
                    {mode === 'edit' && wordCursorPosition?.clipId === clip.id && wordCursorPosition?.wordIndex === wordIndex && wordCursorPosition?.position === 'before' && (
                      <span 
                        className="inline-block relative mx-1 animate-pulse" 
                        style={{ 
                          top: '2px',
                          width: '2px',
                          height: `${fontSettings?.fontSize || 35}px`
                        }}
                      >
                        {/* Classic text cursor with serifs */}
                        <svg 
                          width="8" 
                          height={fontSettings?.fontSize || 35}
                          viewBox={`0 0 8 ${fontSettings?.fontSize || 35}`}
                          className="absolute left-[-3px] top-0"
                          style={{ color: '#3B82F6' }}
                        >
                          {/* Top serif */}
                          <line x1="1" y1="1" x2="7" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          {/* Main vertical line */}
                          <line x1="4" y1="1" x2="4" y2={`${(fontSettings?.fontSize || 35) - 1}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          {/* Bottom serif */}
                          <line x1="1" y1={`${(fontSettings?.fontSize || 35) - 1}`} x2="7" y2={`${(fontSettings?.fontSize || 35) - 1}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                    
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingWord.text}
                        onChange={(e) => setEditingWord(prev => ({ ...prev, text: e.target.value }))}
                        onBlur={handleWordEditSave}
                        className="inline-block border-b-2 border-blue-500 outline-none bg-transparent"
                        style={{ 
                          width: `${editingWord.text.length + 1}ch`,
                          fontFamily: fontSettings?.fontFamily || 'Avenir',
                          fontSize: `${fontSettings?.fontSize || 35}px`
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`
                          cursor-pointer hover:bg-blue-100 transition-colors rounded px-1
                          ${isDeleted ? 'line-through text-gray-400 opacity-60' : ''}
                          ${isSelected ? 'bg-yellow-200 shadow-sm' : ''}
                          ${cursorPosition?.clipId === clip.id && cursorPosition?.wordIndex === wordIndex ? 'bg-blue-200' : ''}
                        `}
                        onClick={(e) => handleWordClick(clip, wordIndex, e)}
                        onDoubleClick={() => handleWordDoubleClick(clip, wordIndex)}
                        onContextMenu={(e) => handleWordRightClick(e, clip, wordIndex)}
                        data-word-id={wordId}
                        title={
                          isDeleted 
                            ? 'Deleted word (right-click to restore)' 
                            : isSelected 
                              ? 'Selected word (press Delete to remove)'
                              : undefined
                        }
                      >
                        {word.word}
                      </span>
                    )}
                    
                    {/* Cursor indicator after word */}
                    {mode === 'edit' && wordCursorPosition?.clipId === clip.id && wordCursorPosition?.wordIndex === wordIndex && wordCursorPosition?.position === 'after' && (
                      <span 
                        className="inline-block relative mx-1 animate-pulse" 
                        style={{ 
                          top: '2px',
                          width: '2px',
                          height: `${fontSettings?.fontSize || 35}px`
                        }}
                      >
                        {/* Classic text cursor with serifs */}
                        <svg 
                          width="8" 
                          height={fontSettings?.fontSize || 35}
                          viewBox={`0 0 8 ${fontSettings?.fontSize || 35}`}
                          className="absolute left-[-3px] top-0"
                          style={{ color: '#3B82F6' }}
                        >
                          {/* Top serif */}
                          <line x1="1" y1="1" x2="7" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          {/* Main vertical line */}
                          <line x1="4" y1="1" x2="4" y2={`${(fontSettings?.fontSize || 35) - 1}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          {/* Bottom serif */}
                          <line x1="1" y1={`${(fontSettings?.fontSize || 35) - 1}`} x2="7" y2={`${(fontSettings?.fontSize || 35) - 1}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                    
                    <span 
                      className="cursor-text"
                      onClick={(e) => {
                        if (mode === 'edit') {
                          e.preventDefault();
                          e.stopPropagation();
                          // Clear word selection and position cursor after this word
                          debugSetSelectedWords(new Set(), 'word-double-click');
                          setSelectionAnchor(null);
                          setWordCursorPosition({
                            clipId: clip.id,
                            wordIndex,
                            position: 'after'
                          });
                        }
                      }}
                    >
                      {' '}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
        })}
      </div>
      
      {/* Context Menu */}
      <ModernContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0 })}
        visible={contextMenu.visible}
      />
    </main>
  );
};

export default ClipBasedTranscript;