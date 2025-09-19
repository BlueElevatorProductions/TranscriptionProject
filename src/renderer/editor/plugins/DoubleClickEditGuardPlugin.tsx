/**
 * DoubleClickEditGuardPlugin
 *
 * In Edit mode, keep the editor non-editable by default and only enable
 * text editing after a user double-clicks. Editing is disabled again on blur
 * or when the user presses Escape.
 */

import { useEffect, useRef } from 'react';
import { $createRangeSelection, $setSelection } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface Props {
  enabled: boolean; // true in Edit mode (readOnly=false)
}

export default function DoubleClickEditGuardPlugin({ enabled }: Props) {
  const [editor] = useLexicalComposerContext();
  const isTemporarilyEditableRef = useRef(false);
  const lastEditWordKeyRef = useRef<string | null>(null);
  const lastEnableAtRef = useRef<number>(0);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';

    // Initialize: if guard is enabled, lock editing until double-click
    if (enabled) {
      editor.setEditable(false);
      isTemporarilyEditableRef.current = false;
    }

    const handleDblClick = (e: MouseEvent) => {
      if (!enabled) return;
      // Only activate if the double-click is inside the editor root
      const targetNode = e.target as Node;
      if (!root.contains(targetNode)) return;
      // Resolve HTMLElement for closest() even when target is a Text node
      const baseEl = (targetNode as any).nodeType === 1
        ? (targetNode as HTMLElement)
        : ((targetNode as any).parentElement as HTMLElement | null);
      // Require the double-click to occur on or within a word node
      const wordEl = baseEl?.closest?.('.lexical-word-node');
      if (!wordEl) return;
      if (DEBUG) console.log('[TranscriptGuard] dblclick on word; enabling typing');
      editor.setEditable(true);
      isTemporarilyEditableRef.current = true;
      lastEnableAtRef.current = Date.now();
      // Remember which word was activated (best effort)
      try {
        const key = wordEl.getAttribute('data-lexical-node-key');
        if (key) lastEditWordKeyRef.current = key;
      } catch {}
      // Programmatically select the word to guarantee caret inside WordNode
      try {
        const key = wordEl.getAttribute('data-lexical-node-key');
        if (key) {
          editor.update(() => {
            const map: any = editor.getEditorState()._nodeMap;
            const node: any = map.get(key);
            if (node && typeof node.getTextContent === 'function') {
              const len = node.getTextContent().length;
              const range = $createRangeSelection();
              // @ts-ignore anchor/focus API available in this version
              range.anchor.set(node.getKey(), 0, 'text');
              // @ts-ignore
              range.focus.set(node.getKey(), len, 'text');
              $setSelection(range);
            }
          });
        }
      } catch {}
    };

    window.addEventListener('dblclick', handleDblClick, true);
    
    // Allow other plugins (e.g., context menu) to explicitly enable editing
    const handleEnable = () => {
      if (DEBUG) console.log('[TranscriptGuard] external enable editing');
      editor.setEditable(true);
      isTemporarilyEditableRef.current = true;
      lastEnableAtRef.current = Date.now();
    };
    window.addEventListener('transcript-enable-editing', handleEnable as any);

    // Block typing when editing is not enabled yet
    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (!enabled) return;
      if (isTemporarilyEditableRef.current) return;
      // Allow control/meta shortcuts (copy/paste/select all, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const printable = k.length === 1;
      const editingKeys = printable || k === 'Backspace' || k === 'Delete' || k === 'Enter' || k === ' ' || k === 'Tab';
      if (editingKeys) {
        if (DEBUG) console.log('[TranscriptGuard] key blocked before enable:', k);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    root.addEventListener('keydown', onKeyDownCapture, true);

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
      // Grace period after enabling to let selection settle on the double-clicked word
      if (Date.now() - lastEnableAtRef.current < 300) return;
      editorState.read(() => {
        const sel: any = editor.getEditorState()._selection || null;
        // Only act on RangeSelection; ignore node selection changes
        if (!sel || typeof sel.getNodes !== 'function' || typeof sel.anchor?.getNode !== 'function') return;
        // Ascend from anchor to detect if we're within a WordNode
        let n: any = sel.anchor.getNode();
        let inWord = false;
        const safety = 20;
        let hop = 0;
        while (n && hop++ < safety) {
          if (typeof n.getType === 'function' && n.getType() === 'word') { inWord = true; break; }
          n = n.getParent && n.getParent();
        }
        if (!inWord) {
          if (DEBUG) console.log('[TranscriptGuard] selection left word; disabling typing');
          editor.setEditable(false);
          isTemporarilyEditableRef.current = false;
          lastEditWordKeyRef.current = null;
        }
      });
    });

    return () => {
      window.removeEventListener('dblclick', handleDblClick, true);
      window.removeEventListener('transcript-enable-editing', handleEnable as any);
      root.removeEventListener('keydown', onKeyDownCapture, true);
      root.removeEventListener('mousedown', handleMouseDown, true);
      unregister();
    };
  }, [editor, enabled]);

  return null;
}
