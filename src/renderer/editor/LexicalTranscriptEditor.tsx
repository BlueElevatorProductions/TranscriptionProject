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
import { ClipContainerNode } from './nodes/ClipContainerNode';
// SpeakerNode removed - using ClipSpeakerPlugin instead
import { ClipNode } from './nodes/ClipNode';
import { SpacerNode } from './nodes/SpacerNode';

import AudioSyncPlugin from './plugins/AudioSyncPlugin';
import SpeakerPlugin from './plugins/SpeakerPlugin';
import EditingPlugin from './plugins/EditingPlugin';
import ClipCreationPlugin from './plugins/ClipCreationPlugin';
import ActiveClipPlugin from './plugins/ActiveClipPlugin';
import ClipDndPlugin from './plugins/ClipDndPlugin';
import FormattingPlugin from './plugins/FormattingPlugin';
// Deprecated: replaced by ClipSpeakerPlugin which renders a unified dropdown
// import ClipHeaderPlugin from './plugins/ClipHeaderPlugin';
// import ClipSettingsPlugin from './plugins/ClipSettingsPlugin';
import ClipSpeakerPlugin from './plugins/ClipSpeakerPlugin';

import { 
  segmentsToEditorState,
  editorStateToSegments,
  clipsToEditorState,
  editorStateToClips,
} from './utils/converters';

import { Segment } from '../types';
import './lexical-editor.css';

interface LexicalTranscriptEditorProps {
  segments?: Segment[];
  clips?: import('../types').Clip[];
  currentTime?: number; // edited time (UI)
  enableClickSeek?: boolean; // allow click-to-seek behavior
  onSegmentsChange: (segments: Segment[]) => void;
  onClipsChange?: (clips: import('../types').Clip[]) => void;
  onWordClick?: (timestamp: number) => void;
  onWordSeek?: (clipId: string, wordIndex: number) => void;
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
  // Audio system integration
  audioState?: import('../hooks/useAudioEditor').AudioEditorState;
  audioActions?: import('../hooks/useAudioEditor').AudioEditorActions;
}

// Inner component that has access to the Lexical editor context
function LexicalTranscriptEditorContent({
  segments,
  clips,
  currentTime,
  enableClickSeek,
  onSegmentsChange,
  onClipsChange,
  onWordClick,
  onWordSeek,
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
  audioState,
  audioActions,
}: Omit<LexicalTranscriptEditorProps, 'className' | 'readOnly'> & { 
  readOnly?: boolean; 
  clips?: any[]; 
  onClipsChange?: (clips: any[]) => void; 
  audioState?: import('../hooks/useAudioEditor').AudioEditorState; 
  audioActions?: import('../hooks/useAudioEditor').AudioEditorActions; 
}) {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);
  const suppressOnChangeRef = useRef(false);
  const dragModeRef = useRef(false);
  const lastClipsHashRef = useRef<string | null>(null);

  // Create available speakers array from both clips and speakers list
  const availableSpeakers = useMemo(() => {
    const speakersMap = new Map();
    
    // Add speakers from the global speakers object
    Object.keys(speakers).forEach(speakerId => {
      if (!speakersMap.has(speakerId)) {
        speakersMap.set(speakerId, {
          id: speakerId,
          name: getSpeakerDisplayName(speakerId)
        });
      }
    });
    
    // Add speakers from clips (in case there are speakers not in the global list)
    if (clips && clips.length > 0) {
      clips.forEach((clip: any) => {
        if (clip.speaker && !speakersMap.has(clip.speaker)) {
          speakersMap.set(clip.speaker, {
            id: clip.speaker,
            name: getSpeakerDisplayName(clip.speaker)
          });
        }
      });
    }
    
    const speakersArray = Array.from(speakersMap.values());
    // Make available speakers globally accessible for SpeakerNode components
    (globalThis as any).__LEXICAL_AVAILABLE_SPEAKERS__ = speakersArray;
    // Make audio system accessible for SpeakerNode dropdown functionality
    (globalThis as any).__LEXICAL_AUDIO_STATE__ = audioState;
    (globalThis as any).__LEXICAL_AUDIO_ACTIONS__ = audioActions;
    // Make clips available for SpeakerNode to determine clip index and operations
    (globalThis as any).__LEXICAL_CLIPS__ = clips;
    return speakersArray;
  }, [clips, speakers, getSpeakerDisplayName, audioState, audioActions]);

  // Initialize editor with segments data
  useEffect(() => {
    if (initializedRef.current) return;
    if (clips && clips.length > 0) {
      clipsToEditorState(editor, clips, {
        includeSpeakerLabels: true,
        getSpeakerDisplayName,
        getSpeakerColor,
      });
      initializedRef.current = true;
      return;
    }
    if (segments && segments.length > 0) {
      segmentsToEditorState(editor, segments, {
        includeSpeakerLabels: true,
        groupBySpeaker: true,
        insertParagraphBreaks: true,
        getSpeakerDisplayName,
        getSpeakerColor,
      });
      initializedRef.current = true;
    }
  }, [editor, clips, segments, getSpeakerDisplayName, getSpeakerColor]);

  // Listen for drag-drop events to suppress onChange during drag operations
  useEffect(() => {
    const handleDragStart = () => {
      dragModeRef.current = true;
      const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
      if (UI_DEBUG) console.log('[LexicalTranscriptEditor] Entering drag mode - suppressing onClipsChange');
    };

    const handleDragEnd = () => {
      // Exit drag mode and force a visual refresh after ProjectContext updates
      setTimeout(() => {
        dragModeRef.current = false;
        const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
        if (UI_DEBUG) console.log('[LexicalTranscriptEditor] Exiting drag mode - clearing hash to trigger rebuild on next clips update');
        
        // Clear hash to force rebuild on next clips update from ProjectContext
        lastClipsHashRef.current = null;
        
        // The forced rebuild will happen automatically when the ProjectContext 
        // updates and the clips prop changes, triggering the useEffect with the new hash
      }, 200); // Longer timeout to ensure ProjectContext has been updated
    };

    window.addEventListener('clip-drag-start', handleDragStart);
    window.addEventListener('clip-drag-end', handleDragEnd);
    return () => {
      window.removeEventListener('clip-drag-start', handleDragStart);
      window.removeEventListener('clip-drag-end', handleDragEnd);
    };
  }, []);

  // Handle editor state changes
  const handleEditorChange = useCallback((editorState: EditorState, editor: LexicalEditor) => {
    // In Listen mode, never push structural changes back to project/audio.
    if (readOnly) {
      const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
      if (UI_DEBUG) console.log('[LexicalTranscriptEditor] Suppressing onClipsChange due to readOnly (listen mode)');
      return;
    }
    if (suppressOnChangeRef.current) {
      // Ignore synthetic changes caused by external rebuilds
      return;
    }
    if (dragModeRef.current) {
      // Suppress onClipsChange during drag-drop operations to prevent order resets
      const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
      if (UI_DEBUG) console.log('[LexicalTranscriptEditor] Suppressing onClipsChange due to drag mode');
      return;
    }
    if (isPlaying) {
      // Suppress onClipsChange during audio playback to prevent order resets
      const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
      if (UI_DEBUG) console.log('[LexicalTranscriptEditor] Suppressing onClipsChange due to playback');
      return;
    }
    if (!readOnly && clips && clips.length > 0 && onClipsChange) {
      const updatedClips = editorStateToClips(editor, clips);
      // Preserve audio-only clips that were filtered out from rendering
      const audioOnlyClips = clips.filter(c => c.type === 'audio-only');
      const allClips = [...updatedClips, ...audioOnlyClips].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
      if (UI_DEBUG) {
        console.log('[LexicalTranscriptEditor] onClipsChange fired:', { 
          editorClips: updatedClips.length, 
          audioOnlyClips: audioOnlyClips.length,
          total: allClips.length,
          firstFewClipOrders: allClips.slice(0, 10).map(c => `${c.id.slice(-6)}:${c.order}`)
        });
        console.trace('[LexicalTranscriptEditor] onClipsChange call stack');
      }
      onClipsChange(allClips);
    } else {
      const updatedSegments = editorStateToSegments(editor);
      onSegmentsChange(updatedSegments);
    }
  }, [onSegmentsChange, onClipsChange, clips]);

  // Ensure editability matches readOnly prop
  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Rebuild editor when external clips change (e.g., programmatic split/reorder)
  useEffect(() => {
    if (!clips || clips.length === 0) return;
    
    // Skip rebuilds during drag mode to avoid interfering with drag operation
    if (dragModeRef.current) {
      const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
      if (UI_DEBUG) console.log('[LexicalTranscriptEditor] Skipping rebuild during drag mode');
      return;
    }
    
    // Compute a lightweight hash of clips order and lengths to detect external updates
    // Include speaker and status so UI rebuilds on these changes too
    const hash = clips
      .map((c: any) => `${c.id}:${c.order}:${c.words?.length ?? 0}:${c.speaker ?? ''}:${c.status ?? 'active'}`)
      .join('|');
    const UI_DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
    if (UI_DEBUG) console.log('[LexicalTranscriptEditor] External clips hash check:', {
      currentHash: hash.substring(0, 100) + '...',
      lastHash: (lastClipsHashRef.current || '').substring(0, 100) + '...',
      hashMatch: hash === lastClipsHashRef.current,
      dragMode: dragModeRef.current,
      firstFewOrders: clips.slice(0, 10).map(c => `${c.id.slice(-6)}:${c.order}`)
    });
    if (hash === lastClipsHashRef.current) return;
    lastClipsHashRef.current = hash;
    suppressOnChangeRef.current = true;
    if (UI_DEBUG) console.log('[LexicalTranscriptEditor] Rebuilding editor due to external clip changes');
    clipsToEditorState(editor, clips, {
      includeSpeakerLabels: true,
      getSpeakerDisplayName,
      getSpeakerColor,
    });
    // Allow onChange again on next tick
    setTimeout(() => { suppressOnChangeRef.current = false; }, 0);
  }, [editor, clips]);

  return (
    <>
      <RichTextPlugin
        contentEditable={
          <ContentEditable 
            className="transcript-editor-content outline-none text-[35px] leading-[1.4] font-transcript p-8" 
            style={{ 
              minHeight: '400px',
              color: 'hsl(var(--transcript-text))'
            }}
            autoFocus
          />
        }
        placeholder={
          <div className="transcript-editor-placeholder absolute top-8 left-8 text-[35px] pointer-events-none" style={{ color: 'hsl(var(--transcript-text) / 0.6)' }}>
            {segments.length === 0 ? 'No transcript loaded. Import an audio file to begin.' : 'Loading transcript...'}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <OnChangePlugin onChange={handleEditorChange} />
      <HistoryPlugin />
      
      {/* Audio synchronization plugin */}
      <AudioSyncPlugin
        currentTime={currentTime}
        onSeekAudio={onWordClick}
        onSeekWord={onWordSeek}
        isPlaying={isPlaying}
        enableClickSeek={!!enableClickSeek}
        deletedWordIds={audioState?.deletedWordIds}
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
          if (UI_DEBUG) console.log('Clip created:', clip);
          // Handle clip creation
        }}
        onClipEdit={(clipId, updates) => {
          if (UI_DEBUG) console.log('Clip edited:', clipId, updates);
          // Handle clip editing
        }}
        onClipDelete={(clipId) => {
          if (UI_DEBUG) console.log('Clip deleted:', clipId);
          // Handle clip deletion
        }}
        onClipPlay={onWordClick}
      />
      
      {/* Text formatting plugin */}
      <FormattingPlugin 
        fontFamily={fontFamily}
        fontSize={fontSize}
      />
      
      {/* Speaker dropdowns - rendered outside editable content */}
      <ClipSpeakerPlugin
        availableSpeakers={availableSpeakers}
        audioState={audioState}
        audioActions={audioActions}
        readOnly={readOnly}
        getSpeakerDisplayName={getSpeakerDisplayName}
      />
      
      {/* Highlight and scope editing to active clip */}
      {!readOnly && <ActiveClipPlugin />}
      {!readOnly && <ClipDndPlugin />}
    </>
  );
}

export function LexicalTranscriptEditor({
  segments,
  clips,
  currentTime,
  enableClickSeek,
  onSegmentsChange,
  onClipsChange,
  onWordClick,
  onWordSeek,
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
  audioState,
  audioActions,
}: LexicalTranscriptEditorProps) {
  // Editor configuration
  const editorConfig = useMemo(() => ({
    namespace: 'lexical-transcript-editor',
    nodes: [
      WordNode,
      SegmentNode,
      ClipContainerNode,
      ClipNode,
      SpacerNode,
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
        highlight: 'lexical-highlight',
      },
      paragraph: 'mb-6',
      root: 'transcript-editor-root relative',
    },
  }), [readOnly]);

  const hasClips = (Array.isArray((clips as any)) && (clips as any)!.length > 0);
  const safeSegments = segments || [];
  if (!hasClips && safeSegments.length === 0) {
    return (
      <main className="flex-1 p-8 font-transcript overflow-y-auto" style={{ backgroundColor: 'hsl(var(--transcript-bg))', color: 'hsl(var(--transcript-text))' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center py-12 text-[35px]" style={{ color: 'hsl(var(--transcript-text) / 0.6)' }}>
            No transcript loaded. Import an audio file to begin.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={`flex-1 font-transcript overflow-y-auto ${className}`} style={{ backgroundColor: 'hsl(var(--transcript-bg))', color: 'hsl(var(--transcript-text))' }}>
      <div className={`max-w-4xl mx-auto relative lexical-transcript-editor-wrapper ${readOnly ? 'listen-mode' : 'edit-mode'}`}>
        {/* Persistent overlay for clip speaker dropdowns. Kept inside the editor wrapper */}
        <div
          id="clip-speaker-layer"
          className="clip-speaker-layer"
          style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, zIndex: 1000, pointerEvents: 'none' }}
        />
        <LexicalComposer initialConfig={editorConfig}>
          <div className="lexical-transcript-editor-wrapper">
            <LexicalTranscriptEditorContent
              segments={safeSegments}
              clips={clips}
          currentTime={currentTime}
          enableClickSeek={enableClickSeek}
          onSegmentsChange={onSegmentsChange}
          onClipsChange={onClipsChange}
          onWordClick={onWordClick}
          onWordSeek={onWordSeek}
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
              readOnly={readOnly}
              audioState={audioState}
              audioActions={audioActions}
            />
          </div>
        </LexicalComposer>
      </div>
    </main>
  );
}

export default LexicalTranscriptEditor;
