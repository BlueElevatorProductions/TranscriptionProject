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
}

export const AudioSystemIntegration: React.FC<AudioSystemIntegrationProps> = ({
  mode,
  fontSettings,
  audioUrl,
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

  // Segments source for Lexical editor
  const segments = useMemo(() => {
    const segs = projectState.projectData?.transcription?.segments || [];
    console.log('[AudioSystemIntegration] Segments from project:', segs.length);
    return segs;
  }, [projectState.projectData?.transcription?.segments]);

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
  }, [clips.length, audioUrl, audioState.isInitialized]);

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
    segmentCount: segments.length
  });

  return (
    <AudioErrorBoundary onRecoveryAttempt={handleRecoveryAttempt}>
      <LexicalTranscriptEditor
        segments={segments}
        currentTime={audioState.currentTime}
        isPlaying={audioState.isPlaying}
        readOnly={mode === 'listen'}
        onSegmentsChange={(updated) => {
          if (!projectState.projectData) return;
          const next = {
            ...projectState.projectData,
            transcription: {
              ...projectState.projectData.transcription,
              segments: updated,
            },
          };
          projectActions.updateProjectData(next);
          // Also keep ProjectContext.editedSegments in sync for save flow
          try {
            // @ts-ignore optional action
            projectActions.updateSegments(updated);
          } catch (e) {
            console.warn('updateSegments not available?', e);
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
