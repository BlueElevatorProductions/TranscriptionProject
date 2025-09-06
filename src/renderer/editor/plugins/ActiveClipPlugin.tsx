/**
 * ActiveClipPlugin - Visually highlight and scope editing to the active clip.
 *
 * - Highlights the ClipContainerNode that contains the current selection.
 * - Sets contenteditable=false on non-active clip containers to avoid accidental edits.
 */

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $isElementNode } from 'lexical';
import { ClipContainerNode } from '../nodes/ClipContainerNode';

export default function ActiveClipPlugin() {
  const [editor] = useLexicalComposerContext();
  const lastActiveKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        // Ascend from anchor to nearest ClipContainerNode
        let node: any = selection.anchor.getNode();
        while (node && !(node instanceof ClipContainerNode)) {
          node = node.getParent && node.getParent();
        }

        const activeKey: string | null = node instanceof ClipContainerNode ? node.getKey() : null;

        if (activeKey === lastActiveKeyRef.current) {
          return; // nothing to change
        }

        // Iterate top-level children; toggle contenteditable and active class
        const root = editor.getEditorState()._nodeMap.get('root');
        // Safer approach: query DOM elements for clip containers
        const containerEls = editor.getRootElement()?.querySelectorAll('.lexical-clip-container');
        containerEls?.forEach((el) => {
          // Default: non-active
          el.setAttribute('contenteditable', 'false');
          el.classList.remove('active-clip');
        });

        if (activeKey) {
          const activeEl = editor.getElementByKey(activeKey);
          if (activeEl) {
            activeEl.setAttribute('contenteditable', 'true');
            activeEl.classList.add('active-clip');
          }
        }

        lastActiveKeyRef.current = activeKey;
      });
    });
  }, [editor]);

  return null;
}

