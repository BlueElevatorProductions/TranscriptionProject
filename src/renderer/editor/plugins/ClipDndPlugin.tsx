/**
 * ClipDndPlugin - Drag and drop reordering of ClipContainerNode blocks.
 */

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { ClipContainerNode } from '../nodes/ClipContainerNode';

export default function ClipDndPlugin() {
  const [editor] = useLexicalComposerContext();
  const dragKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const rootEl = editor.getRootElement();
    if (!rootEl) return;

    const refreshDraggables = () => {
      const els = rootEl.querySelectorAll('.lexical-clip-container');
      els.forEach((el) => {
        el.setAttribute('draggable', 'true');
      });
    };

    const onDragStart = (e: DragEvent) => {
      const target = (e.target as HTMLElement)?.closest('.lexical-clip-container') as HTMLElement | null;
      if (!target) return;
      const key = target.getAttribute('data-lexical-node-key') || target.getAttribute('data-lexical-key');
      if (!key) return;
      dragKeyRef.current = key;
      e.dataTransfer?.setData('text/plain', key);
      e.dataTransfer?.setDragImage(target, 10, 10);
    };

    const onDragOver = (e: DragEvent) => {
      if ((e.target as HTMLElement)?.closest('.lexical-clip-container')) {
        e.preventDefault();
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const srcKey = dragKeyRef.current;
      const tgtEl = (e.target as HTMLElement)?.closest('.lexical-clip-container') as HTMLElement | null;
      const tgtKey = tgtEl?.getAttribute('data-lexical-node-key') || tgtEl?.getAttribute('data-lexical-key') || null;
      if (!srcKey || !tgtKey || srcKey === tgtKey) return;

      editor.update(() => {
        const srcNode = $getNodeByKey(srcKey);
        const tgtNode = $getNodeByKey(tgtKey);
        if (!(srcNode instanceof ClipContainerNode) || !(tgtNode instanceof ClipContainerNode)) return;
        // Move src BEFORE target: use target.insertBefore(source)
        tgtNode.insertBefore(srcNode);
      });
    };

    rootEl.addEventListener('dragstart', onDragStart);
    rootEl.addEventListener('dragover', onDragOver);
    rootEl.addEventListener('drop', onDrop);

    const unregister = editor.registerUpdateListener(() => refreshDraggables());
    refreshDraggables();

    return () => {
      rootEl.removeEventListener('dragstart', onDragStart);
      rootEl.removeEventListener('dragover', onDragOver);
      rootEl.removeEventListener('drop', onDrop);
      unregister();
    };
  }, [editor]);

  return null;
}
