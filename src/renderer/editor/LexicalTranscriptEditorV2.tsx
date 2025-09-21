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

// Context
import { useProjectV2 } from '../contexts/ProjectContextV2';

export interface LexicalTranscriptEditorV2Props {
  mode?: 'listen' | 'edit';
  className?: string;
  onWordClick?: (clipId: string, segmentIndex: number) => void;
  onOperationComplete?: (operationType: string, success: boolean) => void;
}

const LexicalTranscriptEditorV2: React.FC<LexicalTranscriptEditorV2Props> = ({
  mode = 'edit',
  className = '',
  onWordClick,
  onOperationComplete,
}) => {
  const { state: projectState } = useProjectV2();
  const isReadOnly = mode === 'listen';

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
        </div>

        {/* Mode indicator */}
        <div className="mt-2 text-xs text-muted-foreground">
          Mode: {mode} | Clips: {projectState.clips.length} |
          {isReadOnly ? ' Read-only' : ' Editable'}
        </div>
      </LexicalComposer>
    </div>
  );
};

export default LexicalTranscriptEditorV2;