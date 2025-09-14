/**
 * SimpleTranscript.tsx - Clean transcript component for the new audio system
 * 
 * Handles both Listen and Edit modes with proper word highlighting and editing
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { Clip } from '../types';
import { AudioEditorState, AudioEditorActions } from '../hooks/useAudioEditor';
import { useClipEditor } from '../hooks/useClipEditor';
import { generateWordId } from '../audio/AudioAppState';
import SpeakerDropdown from './shared/SpeakerDropdown';

interface SimpleTranscriptProps {
  // Audio system
  audioState: AudioEditorState;
  audioActions: AudioEditorActions;
  
  // Styling
  fontSettings?: {
    size: number;
    family: string;
    lineHeight: number;
  };
  
  // Speakers
  speakerNames?: { [key: string]: string };
  onSpeakerChange?: (clipId: string, newSpeaker: string) => void;
  
  // Editing
  onWordEdit?: (clipId: string, wordIndex: number, newText: string) => void;
  onClipSplit?: (clipId: string, wordIndex: number) => void;
}

interface EditingState {
  clipId: string | null;
  wordIndex: number | null;
  originalText: string;
  currentText: string;
}

export const SimpleTranscript: React.FC<SimpleTranscriptProps> = ({
  audioState,
  audioActions,
  fontSettings = { size: 18, family: 'Inter', lineHeight: 1.6 },
  speakerNames = {},
  onSpeakerChange,
  onWordEdit,
  onClipSplit,
}) => {
  const [editingState, setEditingState] = React.useState<EditingState | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Get visible clips based on current mode
  const visibleClips = audioActions.getVisibleClips();

  // Handle word click - different behavior for Listen vs Edit mode
  const handleWordClick = useCallback((clip: Clip, wordIndex: number) => {
    if (audioState.mode === 'listen') {
      // Listen mode: immediately seek to word and play if not playing
      audioActions.seekToWord(clip.id, wordIndex);
      if (!audioState.isPlaying) {
        audioActions.play();
      }
    } else {
      // Edit mode: position cursor, seek if not playing
      audioActions.setCursor({
        editedTime: 0, // Will be calculated by audio system
        originalTime: clip.words[wordIndex]?.start || 0,
        clipId: clip.id,
        wordIndex: clip.startWordIndex + wordIndex,
        localWordIndex: wordIndex,
      });
      
      // If not playing, seek to word position
      if (!audioState.isPlaying) {
        audioActions.seekToWord(clip.id, wordIndex);
      }
    }
  }, [audioState.mode, audioState.isPlaying, audioActions]);

  // Handle word double-click for editing
  const handleWordDoubleClick = useCallback((clip: Clip, wordIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (audioState.mode !== 'edit') return;

    const word = clip.words[wordIndex];
    if (!word) return;

    setEditingState({
      clipId: clip.id,
      wordIndex,
      originalText: word.word,
      currentText: word.word,
    });
  }, [audioState.mode]);

  // Handle editing input changes
  const handleEditingChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingState) return;
    
    setEditingState({
      ...editingState,
      currentText: event.target.value,
    });
  }, [editingState]);

  // Handle saving word edit
  const handleSaveEdit = useCallback(() => {
    if (!editingState || !editingState.currentText.trim()) {
      setEditingState(null);
      return;
    }

    const { clipId, wordIndex, currentText } = editingState;
    
    // Update the word through callbacks
    onWordEdit?.(clipId, wordIndex, currentText.trim());
    
    // Clear editing state
    setEditingState(null);
  }, [editingState, onWordEdit]);

  // Handle canceling word edit
  const handleCancelEdit = useCallback(() => {
    setEditingState(null);
  }, []);

  // Handle Enter and Escape keys during editing
  const handleEditingKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingState && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingState]);

  // Handle speaker change
  const handleSpeakerChange = useCallback((clipId: string, newSpeaker: string) => {
    onSpeakerChange?.(clipId, newSpeaker);
  }, [onSpeakerChange]);

  // Check if word should be highlighted (currently playing)
  const isWordHighlighted = useCallback((clipId: string, wordIndex: number) => {
    if (audioState.mode !== 'listen' || !audioState.isPlaying) return false;
    
    const wordId = generateWordId(clipId, wordIndex);
    return audioState.currentWordId === wordId;
  }, [audioState.mode, audioState.isPlaying, audioState.currentWordId]);

  // Check if word is deleted
  const isWordDeleted = useCallback((clipId: string, wordIndex: number) => {
    return audioActions.isWordDeleted(clipId, wordIndex);
  }, [audioActions]);

  // Render a single word
  const renderWord = (clip: Clip, word: any, wordIndex: number) => {
    const isEditing = editingState?.clipId === clip.id && editingState.wordIndex === wordIndex;
    const isHighlighted = isWordHighlighted(clip.id, wordIndex);
    const isDeleted = isWordDeleted(clip.id, wordIndex);
    
    if (isEditing) {
      return (
        <input
          ref={editInputRef}
          type="text"
          value={editingState.currentText}
          onChange={handleEditingChange}
          onKeyDown={handleEditingKeyDown}
          onBlur={handleSaveEdit}
          className="inline-block px-1 py-0 border border-blue-500 rounded text-inherit bg-white"
          style={{ 
            fontSize: 'inherit',
            fontFamily: 'inherit',
            width: Math.max(50, editingState.currentText.length * 8) + 'px',
          }}
        />
      );
    }

    // Build CSS classes and styles
    const classes = [
      'inline cursor-pointer px-1 py-0.5 mx-0.5 rounded transition-all duration-75',
    ];

    // Apply clip styles
    const clipStyle = clip.style || {};
    const inlineStyles: React.CSSProperties = {};
    
    if (clipStyle.bold) {
      classes.push('font-bold');
    }
    if (clipStyle.italic) {
      classes.push('italic');
    }
    if (clipStyle.underline) {
      classes.push('underline');
    }
    if (clipStyle.strikethrough) {
      classes.push('line-through');
    }
    if (clipStyle.highlightColor) {
      inlineStyles.backgroundColor = clipStyle.highlightColor;
    }

    if (isHighlighted) {
      classes.push('bg-blue-500 text-white');
    } else {
      classes.push('hover:bg-blue-100');
    }

    if (isDeleted) {
      if (audioState.mode === 'edit') {
        classes.push('text-gray-400 line-through');
      } else {
        // In listen mode, don't render deleted words
        return null;
      }
    }

    const wordId = generateWordId(clip.id, wordIndex);
    
    return (
      <span
        key={wordId}
        data-word-id={wordId}
        data-clip-id={clip.id}
        data-word-index={wordIndex}
        className={classes.join(' ')}
        style={inlineStyles}
        onClick={() => {
          console.log('handleWordClick', clip.id, wordIndex);
          handleWordClick(clip, wordIndex);
        }}
        onDoubleClick={(e) => handleWordDoubleClick(clip, wordIndex, e)}
        title={audioState.mode === 'edit' ? 'Double-click to edit' : 'Click to seek'}
      >
        {word.word}
      </span>
    );
  };

  // Use clip editor for merge/delete operations
  const clipEditor = useClipEditor(audioState, audioActions);

  // Get available speakers for dropdown
  const availableSpeakers = Object.entries(speakerNames).map(([id, name]) => ({
    id,
    name,
  }));

  // Render speaker label
  const renderSpeakerLabel = (clip: Clip, clipIndex: number) => {
    const speakerId = clip.speaker || '';
    const displayName = speakerNames[speakerId] || speakerId || 'Unknown';
    const isActiveClip = audioState.currentClipId === clip.id;
    
    // If current speaker isn't in project speakers, use first available or empty
    const validSpeakerId = speakerNames[speakerId] ? speakerId : (availableSpeakers[0]?.id || '');

    return (
      <div className={`flex items-center mb-2 ${isActiveClip ? 'font-semibold' : ''}`}>
        {audioState.mode === 'edit' ? (
          <>
            <SpeakerDropdown
              currentSpeakerId={validSpeakerId}
              displayName={displayName}
              availableSpeakers={availableSpeakers}
              clipIndex={clipIndex}
              totalClips={visibleClips.length}
              onSpeakerChange={(newSpeakerId) => handleSpeakerChange(clip.id, newSpeakerId)}
              onMergeAbove={() => {
                if (clipIndex > 0) {
                  const prevClip = visibleClips[clipIndex - 1];
                  if (prevClip) {
                    clipEditor.mergeClips(prevClip.id, clip.id);
                  }
                }
              }}
              onMergeBelow={() => {
                if (clipIndex < visibleClips.length - 1) {
                  const nextClip = visibleClips[clipIndex + 1];
                  if (nextClip) {
                    clipEditor.mergeClips(clip.id, nextClip.id);
                  }
                }
              }}
              onDeleteClip={() => {
                clipEditor.deleteClip(clip.id);
              }}
              disabled={availableSpeakers.length === 0}
            />
            <span className="text-sm font-medium text-gray-600 mr-3">:</span>
          </>
        ) : (
          <span className="text-sm font-medium text-gray-600 mr-3 min-w-0 flex-shrink-0">
            {displayName}:
          </span>
        )}
      </div>
    );
  };

  // Render a single clip
  const renderClip = (clip: Clip, clipIndex: number) => {
    // In listen mode, don't show deleted clips
    if (audioState.mode === 'listen' && !audioActions.isClipActive(clip.id)) {
      return null;
    }

    const isActiveClip = audioState.currentClipId === clip.id;
    
    return (
      <div
        key={clip.id}
        className={`mb-6 p-4 rounded-lg transition-all duration-200 ${
          isActiveClip ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
        }`}
      >
        {renderSpeakerLabel(clip, clipIndex)}
        
        <div
          className="leading-relaxed break-words"
          contentEditable={audioState.mode === 'edit'}
          suppressContentEditableWarning
          style={{
            fontSize: `${fontSettings.size}px`,
            fontFamily: fontSettings.family,
            lineHeight: fontSettings.lineHeight,
            whiteSpace: 'pre-wrap',
          }}
        >
          {clip.words.map((word, wordIndex) => renderWord(clip, word, wordIndex))}
        </div>
        
        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-gray-400 space-x-4">
            <span>ID: {clip.id}</span>
            <span>Duration: {clip.duration?.toFixed(2)}s</span>
            <span>Words: {clip.words.length}</span>
            <span>Status: {clip.status || 'active'}</span>
          </div>
        )}
      </div>
    );
  };

  // Show loading state
  if (!audioState.isInitialized) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transcript...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (audioState.error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading transcript</p>
          <p className="text-sm text-gray-600">{audioState.error}</p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (visibleClips.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600">
            {audioState.mode === 'listen' 
              ? 'No clips to display. Import audio to get started.'
              : 'No clips available. Import audio or check edit mode settings.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto prose dark:prose-invert break-words">
      {/* Mode indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Mode: <span className="font-medium capitalize">{audioState.mode}</span>
          {audioState.mode === 'edit' && (
            <span className="ml-2 text-xs">
              Double-click words to edit • Click to position cursor
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-500">
          {visibleClips.length} clip{visibleClips.length !== 1 ? 's' : ''}
          {audioState.totalDuration > 0 && (
            <span className="ml-2">
              • {Math.round(audioState.totalDuration)}s total
            </span>
          )}
        </div>
      </div>

      {/* Transcript content */}
      <div
        className="space-y-4"
        contentEditable={audioState.mode === 'edit'}
        suppressContentEditableWarning
        onKeyDown={event => {
          if (event.key === 'Enter' && audioState.mode === 'edit') {
            event.preventDefault();
            const sel = window.getSelection();
            if (sel && sel.anchorNode) {
              const span = (sel.anchorNode as HTMLElement).parentElement?.closest('span[data-clip-id]');
              if (span) {
                const clipId = span.getAttribute('data-clip-id')!;
                const wordIndex = Number(span.getAttribute('data-word-index'));
                onClipSplit?.(clipId, wordIndex);
              }
            }
          }
        }}
      >
        {visibleClips.map((clip, index) => renderClip(clip, index))}
      </div>
    </div>
  );
};
