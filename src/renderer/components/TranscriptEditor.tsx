import React, { useCallback, useMemo, useEffect } from 'react';
import { createEditor, Descendant, Transforms, Node, Range, Editor, Text } from 'slate';
import { Slate, Editable, withReact, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { Clip } from '../types';
import { AudioEditorState, AudioEditorActions } from '../hooks/useAudioEditor';
import { useClipEditor } from '../hooks/useClipEditor';

interface TranscriptEditorProps {
  audioState: AudioEditorState;
  audioActions: AudioEditorActions;
  clips: Clip[];
  fontSettings?: { size: number; family: string; lineHeight: number };
}

/**
 * TranscriptEditor: a Slate-based rich-text editor for transcripts.
 * Renders each clip as a paragraph of word nodes, allowing inline editing.
 */
export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  audioState,
  audioActions,
  clips,
  fontSettings = { size: 18, family: 'Inter', lineHeight: 1.6 },
}) => {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const clipEditor = useClipEditor(audioState, audioActions);

  // Build initial Slate value from clips
  const initialValue = useMemo<Descendant[]>(() => {
    const nodes: Descendant[] = clips.map(clip => ({
      type: 'paragraph',
      clipId: clip.id,
      children: clip.words.map((w, idx) => ({
        text: w.word + ' ',
        clipId: clip.id,
        wordIndex: idx,
        deleted: audioActions.isWordDeleted(clip.id, idx),
        highlight: audioState.currentWordId === `${clip.id}-word-${idx}`,
      })),
    }));
    // Ensure at least one paragraph for empty transcripts
    return nodes.length > 0
      ? nodes
      : [{ type: 'paragraph', children: [{ text: '' }] }];
  }, [clips, audioState.currentWordId, audioActions]);

  // Render each leaf: handle highlighting & deletion styling
  const renderLeaf = useCallback(props => {
    const { attributes, children, leaf } = props;
    const classNames = [];
    if (leaf.highlight) classNames.push('bg-yellow-200');
    if (leaf.deleted) classNames.push('line-through', 'text-gray-400');
    return <span {...attributes} className={classNames.join(' ')}>{children}</span>;
  }, []);

  // Handle clicks to seek or set cursor
  const onClick = useCallback((event: React.MouseEvent) => {
    const { selection } = editor;
    if (!selection || !Range.isCollapsed(selection)) return;
    const [nodeEntry] = Editor.nodes(editor, { match: n => Text.isText(n) });
    if (nodeEntry) {
      const [node] = nodeEntry;
      const { clipId, wordIndex } = node;
      if (audioState.mode === 'listen') {
        audioActions.seekToWord(clipId, wordIndex);
        if (!audioState.isPlaying) audioActions.play();
      } else {
        clipEditor.undo; // noop
      }
    }
  }, [editor, audioState.mode, audioActions]);

  // Handle Enter to split clip
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && audioState.mode === 'edit') {
      event.preventDefault();
      const { selection } = editor;
      if (!selection) return;
      const [nodeEntry] = Editor.nodes(editor, { match: n => Text.isText(n) });
      if (nodeEntry) {
        const [node] = nodeEntry;
        clipEditor.splitClip(node.clipId, node.wordIndex);
      }
    }
  }, [editor, audioState.mode, clipEditor]);

  useEffect(() => {
    // Reset content when underlying clips change
    Transforms.deselect(editor);
    editor.children = initialValue;
    Editor.normalize(editor, { force: true });
  }, [initialValue]);

  return (
    <Slate editor={editor} value={initialValue} onChange={() => {}}>
      <Editable
        renderLeaf={renderLeaf}
        onClick={onClick as any}
        onKeyDown={onKeyDown as any}
        readOnly={audioState.mode === 'listen'}
        style={{
          fontSize: fontSettings.size,
          fontFamily: fontSettings.family,
          lineHeight: fontSettings.lineHeight,
          whiteSpace: 'pre-wrap',
        }}
      />
    </Slate>
  );
};
