/**
 * LexicalTranscriptEditor - Complete Lexical-based transcript editor with all plugins
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

import {
  EditorState,
  LexicalEditor,
  ParagraphNode,
} from 'lexical';

import { WordNode } from './nodes/WordNode';
import { SegmentNode } from './nodes/SegmentNode';
import { SpeakerNode } from './nodes/SpeakerNode';
import { ClipNode } from './nodes/ClipNode';

import AudioSyncPlugin from './plugins/AudioSyncPlugin';
import SpeakerPlugin from './plugins/SpeakerPlugin';
import EditingPlugin from './plugins/EditingPlugin';
import ClipCreationPlugin from './plugins/ClipCreationPlugin';
import FormattingPlugin from './plugins/FormattingPlugin';

import { 
  segmentsToEditorState,
  editorStateToSegments,
} from './utils/converters';

import { Segment } from '../types';
import './lexical-editor.css';

interface LexicalTranscriptEditorProps {
  segments: Segment[];
  currentTime?: number;
  onSegmentsChange: (segments: Segment[]) => void;
  onWordClick?: (timestamp: number) => void;
  getSpeakerDisplayName: (speakerId: string) => string;
  onSpeakerNameChange?: (speakerId: string, newName: string) => void;
  speakers?: { [key: string]: string };
  className?: string;
  readOnly?: boolean;
  isPlaying?: boolean;
  // Font settings
  fontFamily?: string;
  fontSize?: number;
  // Editing callbacks
  onWordEdit?: (segmentIndex: number, wordIndex: number, oldWord: string, newWord: string) => void;
  onWordInsert?: (segmentIndex: number, wordIndex: number, newWord: string) => void;
  onWordDelete?: (segmentIndex: number, wordIndex: number) => void;
  onParagraphBreak?: (segmentIndex: number, wordIndex: number, position: 'before' | 'after') => void;
  onSpeakerAdd?: (speakerId: string, name: string) => void;
  getSpeakerColor?: (speakerId: string) => string;
}

// Inner component that has access to the Lexical editor context
function LexicalTranscriptEditorContent({
  segments,
  currentTime,
  onSegmentsChange,
  onWordClick,
  getSpeakerDisplayName,
  onSpeakerNameChange,
  speakers = {},
  isPlaying = false,
  fontFamily,
  fontSize,
  onWordEdit,
  onWordInsert,
  onWordDelete,
  onParagraphBreak,
  onSpeakerAdd,
  getSpeakerColor,
  readOnly = false,
}: Omit<LexicalTranscriptEditorProps, 'className' | 'readOnly'> & { readOnly?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  // Initialize editor with segments data
  useEffect(() => {
    if (!initializedRef.current && segments.length > 0) {
      segmentsToEditorState(editor, segments, {
        includeSpeakerLabels: true,
        groupBySpeaker: true,
        insertParagraphBreaks: true,
        getSpeakerDisplayName,
        getSpeakerColor,
      });
      initializedRef.current = true;
    }
  }, [editor, segments, getSpeakerDisplayName, getSpeakerColor]);

  // Handle editor state changes
  const handleEditorChange = useCallback((editorState: EditorState, editor: LexicalEditor) => {
    const updatedSegments = editorStateToSegments(editor);
    onSegmentsChange(updatedSegments);
  }, [onSegmentsChange]);

  return (
    <>
      <RichTextPlugin
        contentEditable={
          <ContentEditable 
            className="transcript-editor-content outline-none text-[35px] leading-[1.4] text-gray-900 font-transcript p-8" 
            style={{ minHeight: '400px' }}
          />
        }
        placeholder={
          <div className="transcript-editor-placeholder absolute top-8 left-8 text-gray-500 text-[35px] pointer-events-none">
            {segments.length === 0 ? 'No transcript loaded. Import an audio file to begin.' : 'Loading transcript...'}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <OnChangePlugin onChange={handleEditorChange} />
      <HistoryPlugin />
      
      {/* Audio synchronization plugin */}
      <AudioSyncPlugin
        currentTime={currentTime || 0}
        onSeekAudio={onWordClick}
        isPlaying={isPlaying}
      />
      
      {/* Speaker management plugin */}
      <SpeakerPlugin
        speakers={speakers}
        onSpeakerChange={onSpeakerNameChange}
        onSpeakerAdd={onSpeakerAdd}
        getSpeakerDisplayName={getSpeakerDisplayName}
        getSpeakerColor={getSpeakerColor}
      />
      
      {/* Editing operations plugin */}
      <EditingPlugin
        onWordEdit={onWordEdit}
        onWordInsert={onWordInsert}
        onWordDelete={onWordDelete}
        onParagraphBreak={onParagraphBreak}
        readOnly={readOnly}
      />
      
      {/* Clip creation plugin */}
      <ClipCreationPlugin
        onClipCreate={(clip) => {
          console.log('Clip created:', clip);
          // Handle clip creation
        }}
        onClipEdit={(clipId, updates) => {
          console.log('Clip edited:', clipId, updates);
          // Handle clip editing
        }}
        onClipDelete={(clipId) => {
          console.log('Clip deleted:', clipId);
          // Handle clip deletion
        }}
        onClipPlay={onWordClick}
      />
      
      {/* Text formatting plugin */}
      <FormattingPlugin 
        fontFamily={fontFamily}
        fontSize={fontSize}
      />
    </>
  );
}

export function LexicalTranscriptEditor({
  segments,
  currentTime,
  onSegmentsChange,
  onWordClick,
  getSpeakerDisplayName,
  onSpeakerNameChange,
  speakers = {},
  className = '',
  readOnly = false,
  isPlaying = false,
  fontFamily,
  fontSize,
  onWordEdit,
  onWordInsert,
  onWordDelete,
  onParagraphBreak,
  onSpeakerAdd,
  getSpeakerColor,
}: LexicalTranscriptEditorProps) {
  // Editor configuration
  const editorConfig = useMemo(() => ({
    namespace: 'lexical-transcript-editor',
    nodes: [
      WordNode,
      SegmentNode,
      SpeakerNode,
      ClipNode,
      ParagraphNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical transcript editor error:', error);
    },
    editable: !readOnly,
    theme: {
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        highlight: 'bg-yellow-200 rounded px-1',
      },
      paragraph: 'mb-6',
      root: 'transcript-editor-root relative',
    },
  }), [readOnly]);

  if (segments.length === 0) {
    return (
      <main className="flex-1 p-8 bg-white font-transcript overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 text-center py-12 text-[35px]">
            No transcript loaded. Import an audio file to begin.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={`flex-1 bg-white font-transcript overflow-y-auto ${className}`}>
      <div className="max-w-4xl mx-auto relative">
        <LexicalComposer initialConfig={editorConfig}>
          <div className="lexical-transcript-editor-wrapper">
            <LexicalTranscriptEditorContent
              segments={segments}
              currentTime={currentTime}
              onSegmentsChange={onSegmentsChange}
              onWordClick={onWordClick}
              getSpeakerDisplayName={getSpeakerDisplayName}
              onSpeakerNameChange={onSpeakerNameChange}
              speakers={speakers}
              isPlaying={isPlaying}
              fontFamily={fontFamily}
              fontSize={fontSize}
              onWordEdit={onWordEdit}
              onWordInsert={onWordInsert}
              onWordDelete={onWordDelete}
              onParagraphBreak={onParagraphBreak}
              onSpeakerAdd={onSpeakerAdd}
              getSpeakerColor={getSpeakerColor}
            />
          </div>
        </LexicalComposer>
      </div>
    </main>
  );
}

export default LexicalTranscriptEditor;
