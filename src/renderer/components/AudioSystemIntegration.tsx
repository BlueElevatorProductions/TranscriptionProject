/**
 * AudioSystemIntegration.tsx - Bridge between new audio system and existing project structure
 *
 * Handles integration with project context, speaker management, and clip persistence
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useProject } from '../contexts';
import { useAudioEditor } from '../hooks/useAudioEditor';
import { useKeyboardManager } from '../hooks/useKeyboardManager';
import { LexicalTranscriptEditor } from '../editor/LexicalTranscriptEditor';
import { AudioErrorBoundary } from './AudioErrorBoundary';
import { Clip } from '../types';
import { TimelinePosition, generateClipId } from '../audio/AudioAppState';
import type { ProjectData } from '../types';
import { GlassAudioPlayer } from './ui/GlassAudioPlayer';

interface AudioSystemIntegrationProps {
  mode: 'listen' | 'edit';
  fontSettings?: { family?: string; fontFamily?: string; size?: number; fontSize?: number };
  audioUrl?: string;
  disableAudio?: boolean;
  isGlassPlayerVisible?: boolean;
  onCloseGlassPlayer?: () => void;
}

export const AudioSystemIntegration: React.FC<AudioSystemIntegrationProps> = ({
  mode,
  fontSettings,
  audioUrl,
  disableAudio = false, // ✅ consistent
  isGlassPlayerVisible = false,
  onCloseGlassPlayer,
}) => {
  const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
  const AUDIO_TRACE = (import.meta as any).env?.VITE_AUDIO_TRACE === 'true';

  const { state: projectState, actions: projectActions } = useProject();

  // Local state
  const [localProjectData, setLocalProjectData] = useState<ProjectData>(
    projectState.projectData
  );
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  // Cursor/selection now come from audioState (via CursorTrackingPlugin)
  const [editorVersion, setEditorVersion] = useState(0);

  // Derive clips
  const clips = useMemo(() => {
    if (!projectState.projectData?.clips?.clips) return [];
    const projectClips = projectState.projectData.clips.clips as Clip[];
    return [...projectClips]; // force new array reference
  }, [projectState.projectData, projectState.projectData?.clips?.clips]);

  // Memoize filtered clips for editor to prevent unnecessary rebuilds on mode changes
  const editorClips = useMemo(() => {
    return mode === 'listen' ? clips.filter(c => c.status !== 'deleted') : clips;
  }, [clips, mode]);

  // Derive speakers
  const speakers = useMemo(() => {
    return projectState.globalSpeakers || {};
  }, [projectState.globalSpeakers]);

  // Audio editor state/actions
  const [audioState, audioActions] = useAudioEditor({
    onError: (error) => {
      console.error('Audio system error:', error);
      setInitializationError(error);
    },
    onWordHighlight: (wordId) => {
      if (wordId) {
        const el = document.querySelector(`[data-word-id="${wordId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    onClipChange: (clipId) => {
      if (AUDIO_TRACE) console.log('Current clip changed to:', clipId);
    },
    onStateChange: (newState) => {
      if (AUDIO_TRACE) console.log('[AudioSystemIntegration] Audio state changed:', newState);
    },
  });

  // Removed normalizeClipsForAudio to avoid unintended structural changes

  // Keep audio system mode in sync with UI toggle (Listen/Edit)
  useEffect(() => {
    try {
      audioActions.setMode(mode);
    } catch (err) {
      if (AUDIO_DEBUG) console.warn('[AudioSystemIntegration] setMode failed:', err);
    }
  }, [mode]);

  // Prevent multiple init attempts
  const initializationAttemptRef = useRef(false);
  
  // Track when manual reordering is happening to prevent useEffect from overriding
  const isReorderingRef = useRef(false);

  // Handle clip reorder from DnD plugin
useEffect(() => {
  const onClipReorder = (
    e: CustomEvent<{ srcClipId: string; targetClipId: string; placeBefore: boolean }>
  ) => {
    const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    const detail = e?.detail || ({} as any);
    const { srcClipId, targetClipId, placeBefore } = detail;

    if (AUDIO_DEBUG) {
      console.log('[AudioSystemIntegration] clip-reorder event received:', detail);
    }
    
    // Set flag to prevent useEffect from overriding our reordering
    isReorderingRef.current = true;

    const allSegments = (projectState.projectData?.clips?.clips || []) as Clip[];
    if (!allSegments.length || !srcClipId || !targetClipId) return;

    const srcIdx = allSegments.findIndex(c => c.id === srcClipId);
    const tgtIdx = allSegments.findIndex(c => c.id === targetClipId);

    if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) {
      if (AUDIO_DEBUG) {
        console.log('[AudioSystemIntegration] clip-reorder: invalid indexes', {
          srcIdx,
          tgtIdx,
        });
      }
      return;
    }

    // Build speech/gap partitions
    const speeches = allSegments.filter(c => c.type !== 'audio-only' && c.type !== 'initial');
    const gaps = allSegments.filter(c => c.type === 'audio-only');

    // Compute original-time ordering for speeches
    const speechesByOriginal = [...speeches].sort((a, b) => a.startTime - b.startTime);
    const earliestSpeechId = speechesByOriginal[0]?.id;

    // Helper to find trailing gap for a speech: gap whose start == speech.end (±eps)
    const EPS = 1e-3;
    const gapAfterBySpeechId = new Map<string, Clip | undefined>();
    for (let i = 0; i < speechesByOriginal.length; i++) {
      const sp = speechesByOriginal[i];
      const next = speechesByOriginal[i + 1];
      const trailing = gaps.find(g => Math.abs(g.startTime - sp.endTime) < 0.005 && (!next || Math.abs(g.endTime - next.startTime) < 0.01));
      gapAfterBySpeechId.set(sp.id, trailing);
    }
    // Leading gap: gap that ends exactly at earliestSpeech.start
    let leadingGap: Clip | undefined;
    if (earliestSpeechId) {
      const earliestSpeech = speechesByOriginal[0];
      leadingGap = gaps.find(g => Math.abs(g.endTime - earliestSpeech.startTime) < 0.01 && g.startTime <= 0 + 10);
    }

    // Build edited speech order by moving src speech before/after target speech
    const speechOrder = speeches.map(c => c.id);
    const srcSpeechIdx = speechOrder.indexOf(srcClipId);
    const tgtSpeechIdx = speechOrder.indexOf(targetClipId);
    if (srcSpeechIdx === -1 || tgtSpeechIdx === -1) return;
    const [movedSpeechId] = speechOrder.splice(srcSpeechIdx, 1);
    const speechInsertAt = placeBefore ? tgtSpeechIdx : tgtSpeechIdx + 1;
    speechOrder.splice(speechInsertAt, 0, movedSpeechId);

    // Rebuild final sequence: for each speech in edited order,
    // - If it is the earliest-by-original, prepend its leading gap (if exists)
    // - Append its trailing gap (if exists)
    const byId = new Map(allSegments.map(c => [c.id, c] as const));
    const rebuilt: Clip[] = [];
    for (const speechId of speechOrder) {
      if (speechId === earliestSpeechId && leadingGap) {
        rebuilt.push({ ...leadingGap });
      }
      const speech = byId.get(speechId)!;
      rebuilt.push({ ...speech });
      const trailing = gapAfterBySpeechId.get(speechId);
      if (trailing) rebuilt.push({ ...trailing });
    }

    // Preserve any gaps not matched (safety) by appending them at the end, maintaining original order
    const usedIds = new Set(rebuilt.map(c => c.id));
    for (const g of gaps) { if (!usedIds.has(g.id)) rebuilt.push({ ...g }); }

    // Renumber final sequence
    const renumbered = rebuilt.map((seg, i) => ({ ...seg, order: i } as Clip));

    // Persist to project + audio
    const nextProject = {
      ...projectState.projectData!,
      clips: {
        ...projectState.projectData!.clips,
        clips: renumbered,
      },
    };
    projectActions.updateProjectData(nextProject);
    
    if (AUDIO_DEBUG) {
      console.log('[onClipReorder] sending to JUCE (renumbered order):', renumbered.map(c => `${c.type}-${c.id.slice(-4)}:${c.order}`));
    }
    
    audioActions.updateClips(renumbered);

    // optional: force editor refresh
    setEditorVersion(v => v + 1);

    if (AUDIO_DEBUG) {
      const first10 = renumbered
        .slice(0, 10)
        .map(c => `${c.type}-${c.id.slice(0, 4)}(order:${c.order})`);
      console.log('[AudioSystemIntegration] clip-reorder complete', {
        srcIdx,
        tgtIdx,
        insertAt,
        totalSegments: renumbered.length,
        first10,
      });
    }
    
    // Clear the reordering flag after a brief delay to allow this operation to complete
    // before the useEffect can run again
    setTimeout(() => {
      isReorderingRef.current = false;
    }, 50);
  };

  window.addEventListener('clip-reorder', onClipReorder as any);
  return () => window.removeEventListener('clip-reorder', onClipReorder as any);
}, [projectState.projectData, projectActions, audioActions]);

// Handle audio seek events from ClipsPanel
useEffect(() => {
  const onAudioSeek = (e: CustomEvent<{ time: number; shouldPlay?: boolean }>) => {
    const { time, shouldPlay } = e.detail || {};
    if (typeof time === 'number' && audioState.isInitialized) {
      if (AUDIO_DEBUG) {
        console.log('[AudioSystemIntegration] Seeking to time from ClipsPanel:', time, shouldPlay ? '(and play)' : '');
      }
      audioActions.seekToOriginalTime(time);
      
      // Start playing if requested
      if (shouldPlay && !audioState.isPlaying) {
        audioActions.play().catch(err => {
          console.error('Failed to start playback from ClipsPanel:', err);
        });
      }
    }
  };

  window.addEventListener('audio-seek-to-time', onAudioSeek as any);
  return () => window.removeEventListener('audio-seek-to-time', onAudioSeek as any);
}, [audioActions, audioState.isInitialized, audioState.isPlaying]);

  useEffect(() => {
    if (disableAudio) return;
    if (clips.length > 0 && audioUrl && !audioState.isInitialized && !initializationAttemptRef.current) {
      initializationAttemptRef.current = true;
      setInitializationError(null);

      console.log('[AudioSystemIntegration] Attempting to initialize audio with:', {
        audioUrl,
        clipsCount: clips.length,
        audioUrlType: typeof audioUrl,
        audioUrlExists: audioUrl ? 'yes' : 'no'
      });

      // Store audio path for error screen
      setAudioPath(audioUrl);

      audioActions
        .initialize(audioUrl, clips)
        .then(() => {
          if (AUDIO_TRACE) console.log('[AudioSystemIntegration] Initialized audio');
        })
        .catch((err) => {
          console.error('Failed to init audio system:', err);
          setInitializationError(`Failed to load audio: ${err.message || err}`);
          console.warn('Audio system initialization failed, but continuing with transcript-only mode');
        })
        .finally(() => {
          initializationAttemptRef.current = false;
        });
    }
  }, [clips.length, audioUrl, audioState.isInitialized, disableAudio]);

  // Keep clips in sync (but don't override manual reordering). De-dupe to avoid
  // rapid redundant updates that can interrupt playback.
  const lastSentClipsHashRef = useRef<string>('');
  useEffect(() => {
    if (!audioState.isInitialized || clips.length === 0 || isReorderingRef.current) {
      if (isReorderingRef.current && AUDIO_DEBUG) {
        console.log('[AudioSystemIntegration] Skipping clip sync - reordering in progress');
      }
      return;
    }
    if (audioState.edlApplying) {
      if (AUDIO_DEBUG) console.log('[AudioSystemIntegration] Skipping clip sync - EDL applying');
      return;
    }
    const hash = clips
      .map((c) => `${c.id}:${c.order}:${c.type}:${c.speaker || ''}:${c.startTime.toFixed(3)}:${c.endTime.toFixed(3)}:${c.words?.length || 0}`)
      .join('|');
    if (hash === lastSentClipsHashRef.current) {
      return; // No-op changes; avoid interrupting playback
    }
    lastSentClipsHashRef.current = hash;
    if (AUDIO_DEBUG) {
      console.log('[AudioSystemIntegration] Syncing clips to audio system (de-duped)');
    }
    // Only push if deduped hash says clips changed; raw clips are used to avoid artificial diffs
    audioActions.updateClips(clips);
  }, [clips, audioState.isInitialized]);

  // Recovery
  const handleRecoveryAttempt = useCallback(() => {
    setInitializationError(null);
    if (clips.length > 0 && audioUrl) {
      setTimeout(() => {
        audioActions.initialize(audioUrl, clips).catch((err) => {
          setInitializationError(`Recovery failed: ${err.message || err}`);
        });
      }, 1000);
    }
  }, [clips, audioUrl, audioActions]);

  // Keyboard manager
  // Implement Enter-to-split via Lexical plugin (token split)
  const handleClipSplit = useCallback((clipId: string, _localWordIndex: number) => {
    const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    if (AUDIO_DEBUG) console.log('[AudioSystemIntegration] token-split scheduled', { clipId });
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent('token-split', { detail: { clipId } })); } catch {}
    }, 0);
  }, []);

  useKeyboardManager({
    audioActions,
    audioState,
    mode,
    cursorPosition: audioState.cursorPosition,
    selectedWordIds: audioState.selectedWordIds,
    onClipSplit: handleClipSplit,
    onWordDelete: () => {},
    onModeSwitch: () => {},
    onNextClip: () => {},
    onPreviousClip: () => {},
    onGoToStart: () => {},
    onGoToEnd: () => {},
  });

  // Decide what to render
  let content;

  if (initializationError) {
    content = (
      <div className="flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Audio System Error</h3>
          <p className="text-gray-600 mb-4 text-sm">{initializationError}</p>
          <button
            onClick={handleRecoveryAttempt}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  } else if (!audioState.isInitialized && clips.length > 0 && audioUrl) {
    content = (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing audio system...</p>
        </div>
      </div>
    );
  } else if (clips.length === 0) {
    content = (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No transcript available</p>
          <p className="text-sm text-gray-500">Import an audio file and run transcription to get started.</p>
        </div>
      </div>
    );
  } else if (!audioUrl) {
    content = (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No audio file available</p>
          <p className="text-sm text-gray-500">Import an audio file to enable playback and editing.</p>
        </div>
      </div>
    );
  } else {
    if (AUDIO_DEBUG)
      console.log('[AudioSystemIntegration] Rendering editor key:', `editor-v${editorVersion}`);

    content = (
      <AudioErrorBoundary onRecoveryAttempt={handleRecoveryAttempt}>
        <LexicalTranscriptEditor
          key={`editor-v${editorVersion}`}
          clips={editorClips}
          currentTime={audioState.currentTime}
          enableClickSeek={mode === 'listen'}
          isPlaying={audioState.isPlaying}
          readOnly={mode === 'listen' && !initializationError}
          onSegmentsChange={() => {}}
          onClipsChange={(updatedClips) => {
            if (!projectState.projectData) return;

            // Check if clips have actually changed to prevent unnecessary project updates
            // Exclude volatile fields like timestamps that change on every editorStateToClips call
            const currentClips = projectState.projectData.clips?.clips as Clip[] || [];

            const clipsChanged = updatedClips.length !== currentClips.length ||
              updatedClips.some((clip, i) => {
                const current = currentClips[i];
                if (!current) return true;

                // Compare structural fields only, ignoring volatile timestamps
                return clip.id !== current.id ||
                  clip.order !== current.order ||
                  clip.speaker !== current.speaker ||
                  clip.status !== current.status ||
                  clip.type !== current.type ||
                  Math.abs(clip.startTime - current.startTime) > 0.001 ||
                  Math.abs(clip.endTime - current.endTime) > 0.001 ||
                  clip.text !== current.text ||
                  (clip.words?.length ?? 0) !== (current.words?.length ?? 0) ||
                  clip.startWordIndex !== current.startWordIndex ||
                  clip.endWordIndex !== current.endWordIndex;
              });

            if (!clipsChanged) {
              const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
              if (AUDIO_DEBUG) {
                console.log('[AudioSystemIntegration] onClipsChange: skipping project update - no changes detected');
              }
              return;
            }

            const next = {
              ...projectState.projectData,
              clips: { ...projectState.projectData.clips, clips: updatedClips },
            } as any;
            projectActions.updateProjectData(next);
            // Avoid pushing EDL updates from generic onClipsChange while in Edit mode.
            // Reordering sends a dedicated 'clip-reorder' event that updates audio once.
            if (mode === 'listen' && audioState.isInitialized) {
              if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
                console.log('[AudioSystemIntegration] onClipsChange -> updateClips (listen mode)');
              }
              audioActions.updateClips(updatedClips);
            } else {
              if ((import.meta as any).env?.VITE_AUDIO_DEBUG === 'true') {
                console.log('[AudioSystemIntegration] onClipsChange: suppressed audio update in edit mode');
              }
            }
          }}
          onWordSeek={(clipId, wordIndex) => {
            const AUDIO_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
            if (AUDIO_DEBUG) {
              console.log('[AudioSystemIntegration] onWordSeek:', { clipId, wordIndex });
            }
            audioActions.seekToWord(clipId, wordIndex);
            if (mode === 'listen' && !audioState.isPlaying) {
              // Give backend a brief moment to process seek before starting playback
              setTimeout(() => {
                audioActions.play().catch(() => {});
              }, 60);
            }
          }}
          onWordClick={(t) => {
            // Fallback only; identity-based seek is preferred
            if (typeof t === 'number') {
              audioActions.seekToTime(t);
            }
            if (mode === 'listen' && !audioState.isPlaying) {
              audioActions.play().catch(() => {});
            }
          }}
          getSpeakerDisplayName={(id) => speakers[id] || id}
          onSpeakerNameChange={(id, newName) => {
            const updated = { ...speakers, [id]: newName };
            projectActions.updateSpeakers(updated);
          }}
          speakers={speakers}
          fontFamily={fontSettings?.family || fontSettings?.fontFamily}
          fontSize={fontSettings?.size || fontSettings?.fontSize}
          onWordEdit={() => {}}
          getSpeakerColor={() => '#3b82f6'}
          audioState={audioState}
          audioActions={audioActions}
        />
      </AudioErrorBoundary>
    );
  }

  // Implement clip navigation functions
  const handleSkipToClipStart = useCallback(() => {
    const visibleClips = audioActions.getVisibleClips();
    const currentClip = audioActions.getClipAtTime(audioState.currentTime);
    
    if (currentClip) {
      // Skip to the start of the current clip
      audioActions.seekToTime(currentClip.startTime);
      if (audioState.isPlaying) {
        audioActions.play().catch(() => {});
      }
    }
  }, [audioActions, audioState.currentTime, audioState.isPlaying]);

  const handleSkipToNextClip = useCallback(() => {
    const visibleClips = audioActions.getVisibleClips();
    const currentClipIndex = visibleClips.findIndex(clip => 
      audioState.currentTime >= clip.startTime && audioState.currentTime <= clip.endTime
    );
    
    if (currentClipIndex >= 0 && currentClipIndex < visibleClips.length - 1) {
      const nextClip = visibleClips[currentClipIndex + 1];
      audioActions.seekToTime(nextClip.startTime);
      if (audioState.isPlaying) {
        audioActions.play().catch(() => {});
      }
    }
  }, [audioActions, audioState.currentTime, audioState.isPlaying]);

  return (
    <>
      {content}
      
      {/* Glass Audio Player */}
      <GlassAudioPlayer
        isVisible={isGlassPlayerVisible}
        isPlaying={audioState.isPlaying}
        currentTime={audioState.currentTime}
        duration={audioState.totalDuration}
        volume={audioState.volume}
        speed={audioState.playbackRate}
        fileName={audioPath ? audioPath.split('/').pop() || 'Audio' : 'Audio'}
        onPlayPause={() => audioActions.togglePlayPause()}
        onSeek={(time) => audioActions.seekToTime(time)}
        onSkipToClipStart={handleSkipToClipStart}
        onSkipToClipEnd={handleSkipToNextClip}
        onVolume={(volume) => audioActions.setVolume(volume)}
        onSpeedChange={(speed) => audioActions.setPlaybackRate(speed)}
        onClose={onCloseGlassPlayer}
      />
    </>
  );
};
