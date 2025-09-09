/**
 * AudioSystemIntegration.tsx - Bridge between new audio system and existing project structure
 * 
 * Handles integration with project context, speaker management, and clip persistence
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useProject } from '../contexts';
import { useAudioEditor } from '../hooks/useAudioEditor';
import { useKeyboardManager } from '../hooks/useKeyboardManager';
import { SimpleTranscript } from './SimpleTranscript';
import { LexicalTranscriptEditor } from '../editor/LexicalTranscriptEditor';
import { AudioErrorBoundary } from './AudioErrorBoundary';
import { Clip } from '../types';
import { generateWordId, TimelinePosition } from '../audio/AudioAppState';

interface AudioSystemIntegrationProps {
  mode: 'listen' | 'edit';
  fontSettings?: {
    size: number;
    family: string;
    lineHeight: number;
  };
  audioUrl?: string;
  disableAudio?: boolean;
}

export const AudioSystemIntegration: React.FC<AudioSystemIntegrationProps> = ({
  mode,
  fontSettings,
  audioUrl,
  disableAudio = false,
}) => {
  const { state: projectState, actions: projectActions } = useProject();
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<TimelinePosition | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  // Get clips from project data
  const clips = useMemo(() => {
    if (!projectState.projectData?.clips?.clips) {
      console.log('[AudioSystemIntegration] No clips found in project data');
      return [];
    }
    const projectClips = projectState.projectData.clips.clips as Clip[];
    console.log('[AudioSystemIntegration] Clips from project data:', {
      clipCount: projectClips.length,
      clipTypes: projectClips.map(c => c.type),
      clipIds: projectClips.map(c => c.id),
      hasTranscribedClips: projectClips.some(c => c.type === 'transcribed'),
      firstClipPreview: projectClips[0] ? {
        id: projectClips[0].id,
        type: projectClips[0].type,
        wordCount: projectClips[0].words?.length || 0,
        text: projectClips[0].text?.substring(0, 100) + (projectClips[0].text?.length > 100 ? '...' : '')
      } : null
    });
    return projectClips;
  }, [projectState.projectData]);

  // Get speakers from project data
  const speakers = useMemo(() => {
    return projectState.globalSpeakers || {};
  }, [projectState.globalSpeakers]);


  // Initialize audio editor
  const [audioState, audioActions] = useAudioEditor({
    onError: (error) => {
      console.error('Audio system error:', error);
      setInitializationError(error);
    },
    onWordHighlight: (wordId) => {
      // Optional: Add visual feedback for word highlighting
      if (wordId) {
        const element = document.querySelector(`[data-word-id="${wordId}"]`);
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest' 
          });
        }
      }
    },
    onClipChange: (clipId) => {
      // Optional: Add feedback for clip changes
      console.log('Current clip changed to:', clipId);
    },
    onStateChange: (newState) => {
      console.log('[AudioSystemIntegration] Audio state changed:', {
        isInitialized: newState.isInitialized,
        isPlaying: newState.isPlaying,
        currentTime: newState.currentTime,
        isReady: newState.isReady,
        error: newState.error
      });
    }
  });

  // Track initialization to prevent concurrent attempts
  const initializationAttemptRef = useRef(false);

  // Initialize audio system when clips and audio URL are available
  useEffect(() => {
    if (disableAudio) return;
    if (clips.length > 0 && audioUrl && !audioState.isInitialized && !initializationAttemptRef.current) {
      console.log('[AudioSystemIntegration] Initializing audio system with audioUrl:', audioUrl);
      console.log({ clipCount: clips.length, isInitialized: audioState.isInitialized });
      
      initializationAttemptRef.current = true;
      setInitializationError(null);
      
      audioActions.initialize(audioUrl, clips)
        .then(() => {
          console.log('[AudioSystemIntegration] Audio system initialized successfully');
        })
        .catch((error) => {
          console.error('Failed to initialize audio system:', error);
          setInitializationError(`Failed to load audio: ${error.message || error}`);
        })
        .finally(() => {
          initializationAttemptRef.current = false;
        });
    }
  }, [clips.length, audioUrl, audioState.isInitialized, disableAudio]);

  // Update clips when they change (after initialization)
  useEffect(() => {
    if (audioState.isInitialized && clips.length > 0) {
      console.log('[AudioSystemIntegration] Updating clips in audio system:', {
        clipCount: clips.length,
        clipTypes: clips.map(c => c.type),
        hasTranscribedClips: clips.some(c => c.type === 'transcribed')
      });
      
      audioActions.updateClips(clips);
    }
  }, [clips, audioState.isInitialized]);

  // Handle clip split requests from editor
  useEffect(() => {
    const onClipSplit = (e: any) => {
      const { clipId, wordIndex } = e.detail || {};
      if (!clipId || typeof wordIndex !== 'number') return;
      const current = projectState.projectData?.clips?.clips as Clip[];
      if (!current) return;

      const idx = current.findIndex((c) => c.id === clipId);
      if (idx === -1) return;
      const clip = current[idx];
      const words = clip.words || [];
      if (wordIndex <= 0 || wordIndex >= words.length) return;

      const aWords = words.slice(0, wordIndex);
      const bWords = words.slice(wordIndex);
      const now = Date.now();
      const a: Clip = {
        ...clip,
        id: clip.id, // keep id for first part
        words: aWords as any,
        startTime: aWords[0]?.start ?? clip.startTime,
        endTime: aWords[aWords.length - 1]?.end ?? clip.startTime,
        text: aWords.map((w: any) => w.word).join(' '),
        duration: (aWords[aWords.length - 1]?.end ?? clip.startTime) - (aWords[0]?.start ?? clip.startTime),
        modifiedAt: now,
        type: clip.type === 'transcribed' ? 'user-created' : clip.type,
      };
      const newId = `clip_${now}`;
      const b: Clip = {
        ...clip,
        id: newId,
        words: bWords as any,
        startTime: bWords[0]?.start ?? clip.endTime,
        endTime: bWords[bWords.length - 1]?.end ?? clip.endTime,
        text: bWords.map((w: any) => w.word).join(' '),
        duration: (bWords[bWords.length - 1]?.end ?? clip.endTime) - (bWords[0]?.start ?? clip.endTime),
        createdAt: now,
        modifiedAt: now,
        type: 'user-created',
      };

      // Build new clips array: replace clip at idx with [a, b]
      const next = [...current.slice(0, idx), a, b, ...current.slice(idx + 1)];
      // Reindex order
      next.forEach((c, i) => (c.order = i));

      const updated = {
        ...projectState.projectData!,
        clips: { ...projectState.projectData!.clips, clips: next },
      } as any;
      projectActions.updateProjectData(updated);
      if (audioState.isInitialized) audioActions.updateClips(next);
    };

    window.addEventListener('clip-split' as any, onClipSplit as any);
    return () => window.removeEventListener('clip-split' as any, onClipSplit as any);
  }, [projectState.projectData, audioState.isInitialized]);

  // Handle clip reorder from DnD plugin
  useEffect(() => {
    const onClipReorder = (e: any) => {
      const { srcClipId, targetClipId, placeBefore } = e.detail || {};
      const current = projectState.projectData?.clips?.clips as Clip[];
      if (!current || !srcClipId || !targetClipId) return;
      if (srcClipId === targetClipId) return;
      const srcIdx = current.findIndex((c) => c.id === srcClipId);
      const tgtIdx = current.findIndex((c) => c.id === targetClipId);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const arr = current.slice();
      const [moved] = arr.splice(srcIdx, 1);
      const insertIdx = tgtIdx + (placeBefore ? 0 : 1) - (srcIdx < tgtIdx ? 1 : 0);
      arr.splice(Math.max(0, Math.min(arr.length, insertIdx)), 0, moved);
      arr.forEach((c, i) => (c.order = i));
      const updated = {
        ...projectState.projectData!,
        clips: { ...projectState.projectData!.clips, clips: arr },
      } as any;
      projectActions.updateProjectData(updated);
      if (audioState.isInitialized) audioActions.updateClips(arr);
    };
    window.addEventListener('clip-reorder' as any, onClipReorder as any);
    return () => window.removeEventListener('clip-reorder' as any, onClipReorder as any);
  }, [projectState.projectData, audioState.isInitialized]);

  // Update mode when prop changes
  useEffect(() => {
    if (audioState.isInitialized && audioState.mode !== mode) {
      audioActions.setMode(mode);
    }
  }, [mode, audioState.isInitialized, audioState.mode, audioActions]);

  // Handle word editing
  const handleWordEdit = useCallback((clipId: string, wordIndex: number, newText: string) => {
    // Find the clip and update the word
    const updatedClips = clips.map(clip => {
      if (clip.id === clipId) {
        const newWords = [...clip.words];
        if (wordIndex >= 0 && wordIndex < newWords.length) {
          newWords[wordIndex] = {
            ...newWords[wordIndex],
            word: newText,
          };
          
          return {
            ...clip,
            words: newWords,
            text: newWords.map(w => w.word).join(' '),
            modifiedAt: Date.now(),
          };
        }
      }
      return clip;
    });

    // Update clips in audio system
    audioActions.updateClips(updatedClips);

    // Persist to project
    if (projectState.projectData) {
      const updatedProjectData = {
        ...projectState.projectData,
        clips: {
          ...projectState.projectData.clips,
          clips: updatedClips,
        },
      };
      
      projectActions.updateProjectData(updatedProjectData);
    }
  }, [clips, audioActions, projectState.projectData, projectActions]);

  // Handle speaker changes
  const handleSpeakerChange = useCallback((clipId: string, newSpeaker: string) => {
    // Validate that the speaker exists in project speakers
    if (!speakers[newSpeaker]) {
      console.warn('Attempted to assign non-existent speaker:', newSpeaker);
      return;
    }
    
    const updatedClips = clips.map(clip => 
      clip.id === clipId 
        ? { ...clip, speaker: newSpeaker, modifiedAt: Date.now() }
        : clip
    );

    // Update clips in audio system
    audioActions.updateClips(updatedClips);

    // Persist to project
    if (projectState.projectData) {
      const updatedProjectData = {
        ...projectState.projectData,
        clips: {
          ...projectState.projectData.clips,
          clips: updatedClips,
        },
      };
      
      projectActions.updateProjectData(updatedProjectData);
    }
  }, [clips, audioActions, projectState.projectData, projectActions, speakers]);

  // Handle clip splitting
  const handleClipSplit = useCallback((clipId: string, wordIndex: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip || wordIndex <= 0 || wordIndex >= clip.words.length) return;

    // Create two new clips
    const firstWords = clip.words.slice(0, wordIndex);
    const secondWords = clip.words.slice(wordIndex);

    const firstClip: Clip = {
      ...clip,
      id: `${clipId}-1`,
      endTime: firstWords[firstWords.length - 1].end,
      endWordIndex: clip.startWordIndex + wordIndex - 1,
      words: firstWords,
      text: firstWords.map(w => w.word).join(' '),
      duration: firstWords[firstWords.length - 1].end - clip.startTime,
      type: 'user-created',
      modifiedAt: Date.now(),
    };

    const secondClip: Clip = {
      ...clip,
      id: `${clipId}-2`,
      startTime: secondWords[0].start,
      startWordIndex: clip.startWordIndex + wordIndex,
      words: secondWords,
      text: secondWords.map(w => w.word).join(' '),
      duration: clip.endTime - secondWords[0].start,
      type: 'user-created',
      order: (clip.order || 0) + 0.5, // Place after original clip
      modifiedAt: Date.now(),
    };

    // Replace original clip with two new clips
    const clipIndex = clips.findIndex(c => c.id === clipId);
    const updatedClips = [
      ...clips.slice(0, clipIndex),
      firstClip,
      secondClip,
      ...clips.slice(clipIndex + 1),
    ];

    // Update clips in audio system
    audioActions.updateClips(updatedClips);

    // Persist to project
    if (projectState.projectData) {
      const updatedProjectData = {
        ...projectState.projectData,
        clips: {
          ...projectState.projectData.clips,
          clips: updatedClips,
        },
      };
      
      projectActions.updateProjectData(updatedProjectData);
    }
  }, [clips, audioActions, projectState.projectData, projectActions]);

  // Handle audio system recovery
  const handleRecoveryAttempt = useCallback(() => {
    console.log('Attempting audio system recovery...');
    
    // Clear error state
    setInitializationError(null);
    
    // Try to re-initialize if we have the necessary data
    if (clips.length > 0 && audioUrl) {
      setTimeout(() => {
        audioActions.initialize(audioUrl, clips)
          .catch((error) => {
            setInitializationError(`Recovery failed: ${error.message || error}`);
          });
      }, 1000);
    }
  }, [clips, audioUrl, audioActions]);


  const handleWordDelete = useCallback((wordIds: string[]) => {
    audioActions.deleteWords(wordIds);
    setSelectedWordIds(new Set()); // Clear selection after deletion
  }, [audioActions]);

  const handleModeSwitch = useCallback((newMode: 'listen' | 'edit') => {
    audioActions.setMode(newMode);
    setSelectedWordIds(new Set()); // Clear selection when switching modes
    setCursorPosition(null); // Clear cursor position
  }, [audioActions]);

  const handleNextClip = useCallback(() => {
    const currentTime = audioState.currentTime;
    const activeClips = audioState.clips.filter(clip => audioState.activeClipIds.has(clip.id));
    const nextClip = activeClips.find(clip => clip.startTime > currentTime);
    
    if (nextClip) {
      audioActions.seekToWord(nextClip.id, 0);
      if (!audioState.isPlaying) {
        audioActions.play();
      }
    }
  }, [audioState, audioActions]);

  const handlePreviousClip = useCallback(() => {
    const currentTime = audioState.currentTime;
    const activeClips = audioState.clips.filter(clip => audioState.activeClipIds.has(clip.id));
    const previousClips = activeClips.filter(clip => clip.endTime < currentTime);
    const previousClip = previousClips[previousClips.length - 1]; // Get the last one before current time
    
    if (previousClip) {
      audioActions.seekToWord(previousClip.id, 0);
      if (!audioState.isPlaying) {
        audioActions.play();
      }
    }
  }, [audioState, audioActions]);

  const handleGoToStart = useCallback(() => {
    audioActions.seekToTime(0);
  }, [audioActions]);

  const handleGoToEnd = useCallback(() => {
    audioActions.seekToTime(audioState.duration - 1);
  }, [audioActions, audioState.duration]);

  // Initialize keyboard manager with context
  useKeyboardManager({
    audioActions,
    audioState,
    mode,
    cursorPosition,
    selectedWordIds,
    onClipSplit: handleClipSplit,
    onWordDelete: handleWordDelete,
    onModeSwitch: handleModeSwitch,
    onNextClip: handleNextClip,
    onPreviousClip: handlePreviousClip,
    onGoToStart: handleGoToStart,
    onGoToEnd: handleGoToEnd,
  });

  // Show error state if initialization failed
  if (initializationError) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold text-red-600 mb-2">
            Audio System Error
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            {initializationError}
          </p>
          <button
            onClick={handleRecoveryAttempt}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (!audioState.isInitialized && clips.length > 0 && audioUrl) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing audio system...</p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (clips.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No transcript available</p>
          <p className="text-sm text-gray-500">
            Import an audio file and run transcription to get started.
          </p>
        </div>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No audio file available</p>
          <p className="text-sm text-gray-500">
            Import an audio file to enable playback and editing.
          </p>
        </div>
      </div>
    );
  }

  // Debug what's being passed to editor
  console.log('[AudioSystemIntegration] Rendering Transcript Editor with audio state:', {
    audioStateClipCount: audioState.clips?.length || 0,
    audioStateClipTypes: audioState.clips?.map(c => c.type) || [],
    audioStateFirstClip: audioState.clips?.[0] ? {
      id: audioState.clips[0].id,
      type: audioState.clips[0].type,
      wordCount: audioState.clips[0].words?.length || 0,
      text: audioState.clips[0].text?.substring(0, 50) + (audioState.clips[0].text?.length > 50 ? '...' : '')
    } : null,
    audioStateIsInitialized: audioState.isInitialized,
    audioStateIsReady: audioState.isReady,
    // segmentCount removed in clip-first mode
  });

  return (
    <AudioErrorBoundary onRecoveryAttempt={handleRecoveryAttempt}>
      <LexicalTranscriptEditor
        clips={mode === 'listen' ? clips.filter(c => c.status !== 'deleted') : clips}
        currentTime={audioState.currentTime}
        isPlaying={audioState.isPlaying}
        readOnly={mode === 'listen'}
        onSegmentsChange={() => { /* not used in clip mode */ }}
        onClipsChange={(updatedClips) => {
          if (!projectState.projectData) return;
          console.log('[AudioSystemIntegration] onClipsChange received:', {
            count: updatedClips.length,
            deletedCount: updatedClips.filter(c => c.status === 'deleted').length,
          });
          const next = {
            ...projectState.projectData,
            clips: {
              ...projectState.projectData.clips,
              clips: updatedClips,
            },
          } as any;
          projectActions.updateProjectData(next);
          if (audioState.isInitialized) {
            audioActions.updateClips(updatedClips);
          }
        }}
        onWordClick={(ts) => {
          // Seek audio and play if in listen mode
          audioActions.seekToTime(ts);
          if (mode === 'listen' && !audioState.isPlaying) {
            audioActions.play().catch(() => {});
          }
        }}
        getSpeakerDisplayName={(id) => speakers[id] || id}
        onSpeakerNameChange={(id, newName) => {
          // Update global speakers map
          const updated = { ...speakers, [id]: newName };
          projectActions.updateSpeakers(updated);
        }}
        speakers={speakers}
        fontFamily={fontSettings?.family || fontSettings?.fontFamily}
        fontSize={fontSettings?.size || fontSettings?.fontSize}
        onWordEdit={(_, __, ___, ____) => {/* optional: clips sync could be added */}}
        getSpeakerColor={(id) => '#3b82f6'}
      />
    </AudioErrorBoundary>
  );
};
