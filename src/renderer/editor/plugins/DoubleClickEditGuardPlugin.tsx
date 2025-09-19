/**
 * DoubleClickEditGuardPlugin
 *
 * In Edit mode, keep the editor non-editable by default and only enable
 * text editing after a user double-clicks. Editing is disabled again on blur
 * or when the user presses Escape.
 */

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface Props {
  enabled: boolean; // true in Edit mode (readOnly=false)
}

export default function DoubleClickEditGuardPlugin({ enabled }: Props) {
  const [editor] = useLexicalComposerContext();
  const isTemporarilyEditableRef = useRef(false);
  const lastEditWordKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    // Initialize: if guard is enabled, lock editing until double-click
    if (enabled) {
      editor.setEditable(false);
      isTemporarilyEditableRef.current = false;
    }

    const handleDblClick = (e: MouseEvent) => {
      if (!enabled) return;
      // Only activate if the double-click is inside the editor root
      if (!root.contains(e.target as Node)) return;
      // Require the double-click to occur on a word node
      const wordEl = (e.target as HTMLElement)?.closest?.('.lexical-word-node');
      if (!wordEl) return;
      editor.setEditable(true);
      isTemporarilyEditableRef.current = true;
      // Remember which word was activated (best effort)
      try {
        const key = wordEl.getAttribute('data-lexical-node-key');
        if (key) lastEditWordKeyRef.current = key;
      } catch {}
    };

    window.addEventListener('dblclick', handleDblClick, true);
    
    // If user clicks anywhere that is not a word node, lock editing again.
    const handleMouseDown = (e: MouseEvent) => {
      if (!enabled) return;
      if (!isTemporarilyEditableRef.current) return;
      if (!root.contains(e.target as Node)) return;
      const wordEl = (e.target as HTMLElement)?.closest?.('.lexical-word-node');
      if (!wordEl) {
        editor.setEditable(false);
        isTemporarilyEditableRef.current = false;
        lastEditWordKeyRef.current = null;
      }
    };
    root.addEventListener('mousedown', handleMouseDown, true);

    // Monitor selection: if selection leaves a word node entirely, disable editing
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      if (!enabled) return;
      if (!isTemporarilyEditableRef.current) return;
      editorState.read(() => {
        const selection: any = editor.getEditorState()._selection || null;
        if (!selection || typeof selection.getNodes !== 'function') return;
        const nodes = selection.getNodes();
        const hasWord = nodes.some((n: any) => n?.getType?.() === 'word');
        if (!hasWord) {
          editor.setEditable(false);
          isTemporarilyEditableRef.current = false;
          lastEditWordKeyRef.current = null;
        }
      });
    });

    return () => {
      window.removeEventListener('dblclick', handleDblClick, true);
      root.removeEventListener('mousedown', handleMouseDown, true);
      unregister();
    };
  }, [editor, enabled]);

  return null;
}
