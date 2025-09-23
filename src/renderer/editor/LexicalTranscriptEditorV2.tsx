/**
 * LexicalTranscriptEditor v2.0 - Segment-based transcript editor
 *
 * Uses v2.0 architecture:
 * - WordNodeV2, SpacerNodeV2, ClipNodeV2
 * - EditOperationsPlugin for atomic operations
 * - ProjectContextV2 integration
 * - Clean segment rendering
 */

import React, { useEffect, useMemo } from 'react';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
// v2.0 Nodes
import { WordNodeV2 } from './nodes/WordNodeV2';
import { SpacerNodeV2 } from './nodes/SpacerNodeV2';
import { ClipNodeV2 } from './nodes/ClipNodeV2';

// v2.0 Plugins
import EditOperationsPlugin from './plugins/EditOperationsPlugin';
import ListenModePlugin from './plugins/ListenModePlugin';
import EditTextModePlugin from './plugins/EditTextModePlugin';
import EditAudioModePlugin from './plugins/EditAudioModePlugin';
import ContentPopulationPlugin from './plugins/ContentPopulationPlugin';

// Context
import { useProjectV2 } from '../contexts/ProjectContextV2';

export interface LexicalTranscriptEditorV2Props {
  mode?: 'listen' | 'edit-text' | 'edit-audio';
  className?: string;
  onWordClick?: (clipId: string, segmentIndex: number) => void;
  onOperationComplete?: (operationType: string, success: boolean) => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  selectedClipId?: string | null;
  onClipSelect?: (clipId: string | null) => void;
  onClipReorder?: (clipId: string, newOrder: number) => void;
  audioPath?: string | null;
  duration?: number;
  isPlaying?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  onAudioSplit?: (time: number) => void;
  onAudioExport?: (startTime: number, endTime: number) => void;
}

const LexicalTranscriptEditorV2: React.FC<LexicalTranscriptEditorV2Props> = ({
  mode = 'edit-text',
  className = '',
  onWordClick,
  onOperationComplete,
  currentTime = 0,
  onSeek,
  onPlaybackStateChange,
  selectedClipId,
  onClipSelect,
  onClipReorder,
  audioPath,
  duration = 0,
  isPlaying = false,
  volume = 1,
  onVolumeChange,
  onAudioSplit,
  onAudioExport,
}) => {
  const { state: projectState } = useProjectV2();
  const isReadOnly = mode === 'listen';
  const isListenMode = mode === 'listen';
  const isEditTextMode = mode === 'edit-text';
  const isEditAudioMode = mode === 'edit-audio';

  // Lexical configuration
  const initialConfig = useMemo(() => ({
    namespace: 'TranscriptEditorV2',
    theme: {
      text: {
        bold: 'font-bold',
        italic: 'italic',
      },
      paragraph: 'mb-2',
    },
    onError: (error: Error) => {
      console.error('🔥 Lexical Editor v2.0 Error:', error);
    },
    nodes: [
      WordNodeV2,
      SpacerNodeV2,
      ClipNodeV2,
    ],
    editable: !isReadOnly,
  }), [isReadOnly]);


  // Debug project state
  useEffect(() => {
    console.log('📝 Lexical Editor v2.0 - Project State:', {
      clipCount: projectState.clips.length,
      mode,
      isReadOnly,
    });
  }, [projectState.clips.length, mode, isReadOnly]);

  // Handle word clicks
  const handleWordClick = (clipId: string, segmentIndex: number) => {
    console.log('🖱️ Word clicked:', { clipId, segmentIndex, mode });
    onWordClick?.(clipId, segmentIndex);
  };

  // Handle operation completion
  const handleOperationComplete = (operationType: string, success: boolean) => {
    console.log('⚡ Operation completed:', { operationType, success });
    onOperationComplete?.(operationType, success);
  };

  return (
    <div className={`lexical-editor-v2 ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          {/* Rich Text Plugin */}
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="lexical-content-editable min-h-[200px] p-4 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={
                  <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
                    {projectState.clips.length === 0
                      ? 'Import an audio file to start transcription...'
                      : 'Loading transcript...'
                    }
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          {/* Core Plugins */}
          <HistoryPlugin />
          <AutoFocusPlugin />

          {/* Content Population Plugin */}
          <ContentPopulationPlugin
            clips={projectState.clips}
            isReadOnly={isReadOnly}
          />

          {/* v2.0 Edit Operations Plugin */}
          <EditOperationsPlugin
            isReadOnly={isReadOnly}
            onWordEdit={(clipId, segmentIndex, oldText, newText) => {
              console.log('📝 Word edited:', { clipId, segmentIndex, oldText, newText });
            }}
            onClipSplit={(clipId, segmentIndex) => {
              console.log('✂️ Clip split:', { clipId, segmentIndex });
            }}
            onOperationComplete={handleOperationComplete}
          />

          {/* Listen Mode Plugin */}
          <ListenModePlugin
            isListenMode={isListenMode}
            currentTime={currentTime}
            onSeek={onSeek}
            onPlaybackStateChange={onPlaybackStateChange}
          />

          {/* Edit Text Mode Plugin */}
          <EditTextModePlugin
            isEditTextMode={isEditTextMode}
            selectedClipId={selectedClipId}
            onClipSelect={onClipSelect}
            onClipReorder={onClipReorder}
            onClipSplit={(clipId, segmentIndex) => {
              console.log('✂️ Clip split in Edit Text Mode:', { clipId, segmentIndex });
              // This will be handled by the existing EditOperationsPlugin
            }}
            onWordEdit={(clipId, segmentIndex, newText) => {
              console.log('📝 Word edited in Edit Text Mode:', { clipId, segmentIndex, newText });
              // This will trigger the existing word edit flow
            }}
          />

          {/* Edit Audio Mode Plugin */}
          <EditAudioModePlugin
            isEditAudioMode={isEditAudioMode}
            audioPath={audioPath}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            volume={volume}
            onSeek={onSeek}
            onPlayPause={onPlaybackStateChange}
            onVolumeChange={onVolumeChange}
            onAudioSplit={onAudioSplit}
            onAudioExport={onAudioExport}
            clips={projectState.clips.map(clip => ({
              id: clip.id,
              startTime: clip.startTime,
              endTime: clip.endTime,
              speaker: clip.speaker
            }))}
          />
        </div>

        {/* Mode indicator */}
        <div className="mt-2 text-xs text-muted-foreground">
          Mode: {mode} | Clips: {projectState.clips.length} |
          {isReadOnly ? ' Read-only' : ' Editable'}
          {isListenMode && (
            <span>
              {' | '}
              Time: {currentTime.toFixed(1)}s
            </span>
          )}
          {isEditTextMode && (
            <span>
              {' | '}
              Selected: {selectedClipId || 'None'}
              {' | '}
              Press Enter to split clips
            </span>
          )}
          {isEditAudioMode && (
            <span>
              {' | '}
              Audio: {audioPath ? 'Loaded' : 'None'}
              {' | '}
              Waveform view active
            </span>
          )}
        </div>
      </LexicalComposer>
    </div>
  );
};

export default LexicalTranscriptEditorV2;